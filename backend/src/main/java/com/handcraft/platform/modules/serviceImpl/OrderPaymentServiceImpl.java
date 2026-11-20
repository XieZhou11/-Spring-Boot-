package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.dto.OrderPaymentDTO;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.OrderPaymentPreviewVO;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import tools.jackson.databind.ObjectMapper;

/** 沿用双方账号→需求→订单锁序，使付款、取消和扫描只能一个生效。 */
@Service
public class OrderPaymentServiceImpl implements OrderPaymentService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderPaymentServiceImpl.class);
    private static final String TERMS_VERSION="CUSTOM_PAYMENT_V1";
    private static final String STOCK_TERMS_VERSION="STOCK_PAYMENT_V1";
    private static final String STOCK_TERMS_TEXT="本次为模拟支付，不发生真实扣款。现货支付成功后订单直接进入待发货，创作者应在支付后48小时内发货；请核对商品与收货地址，现货按平台售后规则处理。";
    private static final String TERMS_TEXT="本次为模拟支付，不发生真实扣款。定制工期从支付次日零时按自然日计算，包含等待开工时间，不含物流；约定发货日及节点参考计划在支付成功时固定。制作开始后不支持单方无理由退款，普通退款按平台售后规则处理。支付满48小时仍未开工，买家可申请无责全额退款，由系统校验后执行。";
    private static final String[] NODE_CODES={"MATERIAL","SAMPLE","MAKING","QC","SHIPPING"};
    private static final int[] NODE_PERCENT={15,35,80,90,100};
    private final TradeOrderMapper orders;
    private final WorkMapper works;
    private final OrderPaymentMapper payments;
    private final CustomRequestMapper requests;
    private final QuoteMapper quotes;
    private final CreatorApplicationMapper applications;
    private final CustomRequestPolicyService policy;
    private final PaymentAccountCryptoService crypto;
    private final QuoteLifecycleService lifecycle;
    private final OperationLogService logs;
    private final NotificationService notifications;
    private final ConversationService conversations;
    private final ObjectMapper json;

    public OrderPaymentServiceImpl(TradeOrderMapper orders,WorkMapper works,OrderPaymentMapper payments,CustomRequestMapper requests,QuoteMapper quotes,
            CreatorApplicationMapper applications,CustomRequestPolicyService policy,PaymentAccountCryptoService crypto,
            QuoteLifecycleService lifecycle,OperationLogService logs,NotificationService notifications,
            ConversationService conversations,ObjectMapper json){
        this.orders=orders;this.works=works;this.payments=payments;this.requests=requests;this.quotes=quotes;this.applications=applications;
        this.policy=policy;this.crypto=crypto;this.lifecycle=lifecycle;this.logs=logs;this.notifications=notifications;
        this.conversations=conversations;this.json=json;
    }

    @Transactional(rollbackFor=Exception.class,isolation=Isolation.READ_COMMITTED)
    public boolean pay(Long userId,Long orderId,OrderPaymentDTO input){
        return BusinessLog.run(LOGGER,"订单模拟支付",userId,()->{
            try {
            var initial=orders.find(orderId);buyer(userId,initial);
            policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
            var work="STOCK".equals(initial.getOrderType())?works.lock(initial.getWorkId()):null;
            var request="CUSTOM".equals(initial.getOrderType())?requests.lock(initial.getRequestId()):null;var order=orders.lock(orderId);buyer(userId,order);
            policy.user(userId);
            // 等待全部竞争锁结束后再取时间；MySQL DATETIME(3)与边界判断统一到毫秒。
            LocalDateTime now=policy.now().truncatedTo(ChronoUnit.MILLIS);
            var successful=payments.payment(orderId);
            if(successful!=null){LOGGER.info("支付成功结果复用：orderId={}, stage=自然幂等校验",orderId);return false;}
            if(!"PENDING_PAY".equals(order.getStatus()))throw conflict("订单当前状态不允许支付");
            boolean stock="STOCK".equals(order.getOrderType());
            if(stock){
                if(work==null)throw new BusinessException(CommonErrorCode.NOT_FOUND);
                if(!orderId.equals(work.getStockOrderId())||!"RESERVED".equals(work.getStockStatus())||!order.getCreatorId().equals(work.getCreatorId()))throw conflict("订单与现货锁定关系不一致，请联系平台处理");
            }else{
                if(request==null||!"AWARDED".equals(request.getStatus()))throw conflict("订单当前状态不允许支付");
                var quote=quotes.find(order.getQuoteId());
                if(!order.getBuyerId().equals(request.getBuyerId())||quote==null||!order.getRequestId().equals(quote.getRequestId())||!order.getCreatorId().equals(quote.getCreatorId()))throw conflict("订单与原需求或中标方案的关联不一致，请联系平台处理");
            }
            if(!now.isBefore(order.getPayDeadlineAt()))throw conflict("订单付款期限已到，请刷新订单确认状态");
            var preview=stock?stockPreview(now):preview(now.toLocalDate(),order.getDurationDays());
            if(!preview.termsVersion().equals(input.getTermsVersion())||(!stock&&!preview.shipDate().equals(input.getConfirmedShipDate())))throw conflict("支付条款或约定发货日期已变化，请刷新后重新确认");
            if(!Boolean.TRUE.equals(input.getTermsConfirmed()))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"请确认支付条款");
            var creator=policy.user(order.getCreatorId());
            var application=creator.getApprovedApplicationId()==null?null:applications.find(creator.getApprovedApplicationId());
            if(application==null||!creator.getId().equals(application.getUserId())||!"APPROVED".equals(application.getStatus()))throw conflict("创作者已审核收款资料不可用，暂不能支付");
            // 验证密文确实可按本人归属解密，快照仅保存编码密文，不能静默接受损坏账户。
            String account=crypto.decrypt(creator.getId(),application.getAlipayAccountCiphertext());
            if(account.isBlank()||application.getRealName()==null||application.getRealName().isBlank())throw conflict("创作者已审核收款资料不可用，暂不能支付");
            LOGGER.info("支付关键校验完成：orderId={}, orderType={}, stage=期限条款及收款资料",orderId,order.getOrderType());
            var flow=new FundFlow();flow.setFlowNo(UUID.randomUUID().toString().replace("-",""));flow.setOrderId(orderId);
            flow.setFlowType("PAYMENT");flow.setAmount(order.getTotalAmount());flow.setResult("SUCCESS");
            flow.setIdempotencyKey("PAYMENT:ORDER:"+orderId);flow.setOccurredAt(now);payments.insertPayment(flow);
            var settlement=new OrderSettlement();settlement.setOrderId(orderId);settlement.setPaidAmount(order.getTotalAmount());
            settlement.setStatus("PENDING");settlement.setCreatedAt(now);
            settlement.setPayeeSnapshot(json.writeValueAsString(Map.of("approved_application_id",application.getId().toString(),
                    "real_name",application.getRealName(),"alipay_account_ciphertext",Base64.getEncoder().encodeToString(application.getAlipayAccountCiphertext()))));
            payments.insertSettlement(settlement);
            order.setPaidAt(now);order.setTermsConfirmedAt(now);order.setShipDeadlineAt(preview.shipDeadlineAt().toLocalDateTime());order.setUpdatedAt(now);
            order.setStatus(stock?"PENDING_SHIP":"PAID");
            if(orders.pay(order)!=1)throw conflict("订单状态已变化，请刷新后重试");
            if(stock){if(works.sellStock(work.getId(),orderId,now)!=1)throw conflict("现货锁定状态已变化，请刷新订单后重试");}
            else lifecycle.state(request,"IN_TRADE",userId);
            for(int index=0;!stock&&index<NODE_CODES.length;index++){
                var node=new OrderProgressNode();node.setOrderId(orderId);node.setNodeCode(NODE_CODES[index]);node.setSortOrder(index+1);
                // 工期从次日开始，第ceil(N×累计占比)日即支付日期加相应天数。
                node.setPlannedFinishDate(now.toLocalDate().plusDays((order.getDurationDays()*NODE_PERCENT[index]+99)/100));
                node.setStatus("NOT_STARTED");node.setCreatedAt(now);payments.insertNode(node);
            }
            logs.record(userId,false,"ORDER",orderId,"PAY","PENDING_PAY",order.getStatus(),null,
                    Map.of("occurredAt",now.toString(),"termsVersion",preview.termsVersion(),"termsText",preview.termsText()));
            notifications.tradeChanged(order.getBuyerId(),"ORDER_PAID","ORDER",orderId,order.getRequestId());
            notifications.tradeChanged(order.getCreatorId(),"ORDER_PAID","ORDER",orderId,order.getRequestId());
            conversations.orderChanged(order);
            LOGGER.info("订单支付原子结果已准备：orderId={}, orderType={}, stage=流水结算通知，等待事务提交",orderId,order.getOrderType());
            return true;
            }catch(BusinessException failure){
                LOGGER.warn("订单支付拒绝：stage=锁后规则与资料校验, userId={}, orderId={}, code={}, reason={}",userId,orderId,failure.getErrorCode().code(),failure.getMessage());throw failure;
            }catch(RuntimeException failure){
                LOGGER.error("订单支付异常：stage=支付数据持久化, userId={}, orderId={}",userId,orderId,SafeLog.exception(failure));throw failure;
            }
        });
    }

    public OrderPaymentPreviewVO preview(LocalDate paymentDate,int durationDays){
        LocalDate shipDate=paymentDate.plusDays(durationDays);
        return new OrderPaymentPreviewVO(shipDate,shipDate.plusDays(1).atStartOfDay().atOffset(ZoneOffset.ofHours(8)),TERMS_VERSION,TERMS_TEXT);
    }
    public OrderPaymentPreviewVO stockPreview(LocalDateTime now){var deadline=now.plusHours(48).atOffset(ZoneOffset.ofHours(8));return new OrderPaymentPreviewVO(deadline.toLocalDate(),deadline,STOCK_TERMS_VERSION,STOCK_TERMS_TEXT);}
    private static void buyer(Long userId,TradeOrder order){
        if(order==null||!Set.of("CUSTOM","STOCK").contains(order.getOrderType())||!userId.equals(order.getBuyerId())&&!userId.equals(order.getCreatorId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        if(!userId.equals(order.getBuyerId()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅订单买家可以支付");
    }
    private static BusinessException conflict(String reason){return new BusinessException(CommonErrorCode.CONFLICT,reason);}
}
