package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.AdminOrderQueryDTO;
import com.handcraft.platform.modules.mapper.AdminOrderMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.mapper.TradeOrderMapper;
import com.handcraft.platform.modules.mapper.OrderPaymentMapper;
import com.handcraft.platform.modules.mapper.OrderFulfillmentMapper;
import com.handcraft.platform.modules.mapper.ConversationMapper;
import com.handcraft.platform.modules.mapper.RefundApplicationMapper;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.service.AdminOrderQueryService;
import com.handcraft.platform.modules.service.CustomRequestPolicyService;
import com.handcraft.platform.modules.vo.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** 管理员订单查询只返回管理列表必要字段，不返回收货地址或收款快照。 */
@Service
public class AdminOrderQueryServiceImpl implements AdminOrderQueryService {
    private static final Logger LOG=LoggerFactory.getLogger(AdminOrderQueryServiceImpl.class);private final AdminOrderMapper data;private final UserAccountMapper users;private final CustomRequestPolicyService policy;
    private final TradeOrderMapper orders;private final OrderPaymentMapper payments;private final OrderFulfillmentMapper fulfillment;
    private final ConversationMapper conversations;
    private final RefundApplicationMapper refunds;
    private final ObjectMapper json;
    public AdminOrderQueryServiceImpl(AdminOrderMapper data,UserAccountMapper users,CustomRequestPolicyService policy,
                                      TradeOrderMapper orders,OrderPaymentMapper payments,OrderFulfillmentMapper fulfillment,
                                      ConversationMapper conversations,RefundApplicationMapper refunds,ObjectMapper json){
        this.data=data;this.users=users;this.policy=policy;this.orders=orders;this.payments=payments;
        this.fulfillment=fulfillment;this.conversations=conversations;this.refunds=refunds;this.json=json;
    }
    @Override public PageVO<AdminOrderVO> list(Long admin,AdminOrderQueryDTO q){return BusinessLog.run(LOG,"管理员订单综合查询",admin,()->{
        var actor=users.findById(admin);if(actor==null||!actor.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅管理员可以查询全部订单");if(q.getOrderNo()!=null)q.setOrderNo(q.getOrderNo().strip());
        var now=policy.now();List<AdminOrderVO> rows=data.list(q,(q.getPage()-1)*q.getSize(),now).stream().map(r->new AdminOrderVO(text(r,"orderId"),text(r,"orderNo"),text(r,"orderType"),text(r,"status"),text(r,"title"),money(r.get("amount")),text(r,"buyerId"),text(r,"buyerNickname"),text(r,"creatorId"),text(r,"creatorNickname"),time(r.get("createdAt")),text(r,"attention"))).toList();
        return new PageVO<>(rows,data.count(q,now),q.getPage(),q.getSize());
    });}
    @Override @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ) public AdminOrderDetailVO detail(Long admin,Long orderId){return BusinessLog.run(LOG,"管理员订单详情查询",admin,()->{
        requireAdmin(admin);var order=orders.find(orderId);if(order==null)throw new BusinessException(CommonErrorCode.NOT_FOUND,"订单不存在");
        var buyer=users.findById(order.getBuyerId());var creator=users.findById(order.getCreatorId());var payment=payments.payment(orderId);var settlement=payments.settlement(orderId);var chat=conversations.linkedOrder(order);
        var paymentSummary=new LinkedHashMap<String,Object>();if(payment!=null){paymentSummary.put("flowNo",payment.getFlowNo());paymentSummary.put("amount",money(payment.getAmount()));paymentSummary.put("occurredAt",time(payment.getOccurredAt()));}
        var settlementSummary=new LinkedHashMap<String,Object>();if(settlement!=null){settlementSummary.put("paidAmount",money(settlement.getPaidAmount()));settlementSummary.put("status",settlement.getStatus());}
        var nodes=payments.nodes(orderId).stream().map(n->{var records=fulfillment.records(n.getId()).stream().map(r->new OrderProgressRecordVO(r.getId().toString(),r.getRequestKey(),r.getRecordType(),r.getContent(),ids(r.getImageIds()),r.getSkipReason(),time(r.getCreatedAt()))).toList();long deviation=n.getPlannedFinishDate()==null?0:java.time.temporal.ChronoUnit.DAYS.between(n.getPlannedFinishDate(),n.getHandledAt()==null?policy.now().toLocalDate():n.getHandledAt().toLocalDate());return new OrderProgressNodeVO(n.getId().toString(),n.getNodeCode(),n.getSortOrder(),n.getPlannedFinishDate(),n.getStatus(),time(n.getHandledAt()),records,false,false,false,deviation,n.getHandledAt()==null&&deviation>0);}).toList();
        // 付款期限已到的订单与管理列表同口径展示，查询不执行取消或库存释放。
        String status="PENDING_PAY".equals(order.getStatus())&&!policy.now().isBefore(order.getPayDeadlineAt())?"CANCELLED":order.getStatus();
        var orderView=new AdminRefundOrderVO(orderId.toString(),order.getOrderNo(),order.getOrderType(),order.getTitleSnapshot(),status,order.getBuyerId().toString(),buyer==null?null:buyer.getNickname(),order.getCreatorId().toString(),creator==null?null:creator.getNickname(),text(order.getRequestId()),text(order.getQuoteId()),money(order.getTotalAmount()),map(order.getAgreementSnapshot()),safeAddress(order),time(order.getPaidAt()),time(order.getStartedAt()),time(order.getShipDeadlineAt()),order.getTrackingNo(),time(order.getShippedAt()),time(order.getAutoConfirmAt()),time(order.getOriginalCompletedAt()),chat==null?null:chat.getId().toString(),paymentSummary,settlementSummary,nodes);
        var flows=payments.successfulFlows(orderId).stream().map(f->{var m=new LinkedHashMap<String,Object>();m.put("flowNo",f.getFlowNo());m.put("type",f.getFlowType());m.put("amount",money(f.getAmount()));m.put("occurredAt",time(f.getOccurredAt()));return (Map<String,Object>)m;}).toList();
        var summary=chat==null?null:new AdminOrderConversationSummaryVO(text(chat.getId()),text(chat.getLastMessageSeq()),
                chat.getLastMessageSeq()>0?time(chat.getLastMessageAt()):null,time(chat.getArchivedAt()));
        return new AdminOrderDetailVO(orderView,flows,List.of(),order.getOrderType(),summary,refundApplicationId(order));
    });}
    /** 有待处理申请时直达该申请，否则仅在可查历史唯一时提供直达入口。 */
    private String refundApplicationId(TradeOrder order){
        var candidates=refunds.adminLinkCandidates(order);
        if(candidates.isEmpty())return null;
        var first=candidates.getFirst();
        return candidates.size()==1||"WAIT_ADMIN".equals(first.status())?text(first.id()):null;
    }
    private void requireAdmin(Long id){var actor=users.findById(id);if(actor==null||!actor.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅管理员可以查询全部订单");}
    private List<String> ids(String raw){return raw==null?List.of():json.readValue(raw,new TypeReference<List<String>>(){});}
    private Map<String,Object> map(String raw){return raw==null?Map.of():json.readValue(raw,new TypeReference<Map<String,Object>>(){});}
    private Map<String,Object> safeAddress(TradeOrder order){var source=map(order.getAddressSnapshot());var result=new LinkedHashMap<String,Object>();for(String key:List.of("recipientName","phone","province","city","district","detailAddress"))if(source.containsKey(key))result.put(key,source.get(key));return result;}
    private String text(Long value){return value==null?null:value.toString();}
    private String money(BigDecimal value){return value==null?null:value.setScale(2).toPlainString();}
    private OffsetDateTime time(LocalDateTime value){return value==null?null:value.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();}
    private String text(Map<String,Object> r,String key){Object v=r.get(key);if(v==null)for(var e:r.entrySet())if(e.getKey().equalsIgnoreCase(key)){v=e.getValue();break;}return v==null?null:v.toString();}
    private String money(Object v){BigDecimal n=v instanceof BigDecimal b?b:new BigDecimal(v.toString());return n.setScale(2).toPlainString();}
    private OffsetDateTime time(Object v){if(v instanceof LocalDateTime t)return t.atOffset(ZoneOffset.ofHours(8));if(v instanceof java.sql.Timestamp t)return t.toLocalDateTime().atOffset(ZoneOffset.ofHours(8));return null;}
}
