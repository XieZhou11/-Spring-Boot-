package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.AdminSettlementQueryDTO;
import com.handcraft.platform.modules.dto.SettlementQueryDTO;
import com.handcraft.platform.modules.entity.OrderSettlement;
import com.handcraft.platform.modules.entity.TradeOrder;
import com.handcraft.platform.modules.mapper.OrderSettlementMapper;
import com.handcraft.platform.modules.mapper.TradeOrderMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.CustomRequestPolicyService;
import com.handcraft.platform.modules.service.PayeeSnapshotService;
import com.handcraft.platform.modules.service.SettlementQueryService;
import com.handcraft.platform.modules.vo.AdminSettlementVO;
import com.handcraft.platform.modules.vo.CreatorSettlementVO;
import com.handcraft.platform.modules.vo.PageVO;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;

/** 收入与资金记录查询：创作者仅本人且账户脱敏，管理员凭身份查看快照明文。 */
@Service
public class SettlementQueryServiceImpl implements SettlementQueryService {
    private static final Logger LOGGER=LoggerFactory.getLogger(SettlementQueryServiceImpl.class);
    private final OrderSettlementMapper settlements;
    private final TradeOrderMapper orders;
    private final UserAccountMapper users;
    private final CustomRequestPolicyService policy;
    private final PayeeSnapshotService payees;
    public SettlementQueryServiceImpl(OrderSettlementMapper settlements,TradeOrderMapper orders,UserAccountMapper users,
            CustomRequestPolicyService policy,PayeeSnapshotService payees){
        this.settlements=settlements;this.orders=orders;this.users=users;this.policy=policy;this.payees=payees;
    }

    @Override
    public PageVO<CreatorSettlementVO> mine(Long actor,SettlementQueryDTO query){
        return BusinessLog.run(LOGGER,"创作者收入记录查询",actor,()->{
            policy.user(actor);
            var rows=settlements.listForCreator(actor,query,(query.getPage()-1)*query.getSize());
            long total=settlements.countForCreator(actor,query);
            List<CreatorSettlementVO> items=rows.stream().map(s->{
                var order=orders.find(s.getOrderId());
                return new CreatorSettlementVO(text(s.getOrderId()),order.getOrderNo(),order.getTitleSnapshot(),
                        s.getPaidAmount().setScale(2).toPlainString(),s.getStatus(),time(s.getSettledAt()),payees.masked(s.getPayeeSnapshot(),order.getCreatorId()));
            }).toList();
            return new PageVO<>(items,total,query.getPage(),query.getSize());
        });
    }

    @Override
    public PageVO<AdminSettlementVO> admin(Long actor,AdminSettlementQueryDTO query){
        return BusinessLog.run(LOGGER,"管理员资金记录查询",actor,()->{
            admin(actor);
            // API 直调时统一去除首尾空白，与前端输入口径一致。
            if(query.getOrderNo()!=null)query.setOrderNo(query.getOrderNo().strip());
            var rows=settlements.listForAdmin(query,(query.getPage()-1)*query.getSize());
            long total=settlements.countForAdmin(query);
            List<AdminSettlementVO> items=rows.stream().map(s->{
                var order=orders.find(s.getOrderId());
                var snapshot=payees.parse(s.getPayeeSnapshot());
                return new AdminSettlementVO(text(s.getOrderId()),order.getOrderNo(),order.getTitleSnapshot(),order.getOrderType(),
                        text(order.getBuyerId()),text(order.getCreatorId()),s.getPaidAmount().setScale(2).toPlainString(),
                        s.getStatus(),time(s.getSettledAt()),time(s.getCancelledAt()),snapshot.realName(),payees.plaintextAccount(s.getPayeeSnapshot(),order.getCreatorId()),time(s.getCreatedAt()));
            }).toList();
            return new PageVO<>(items,total,query.getPage(),query.getSize());
        });
    }

    private void admin(Long actor){
        var user=users.findById(actor);
        if(user==null||!user.isAdmin())throw forbidden("仅管理员可以查看资金记录");
    }
    private static String text(Long value){return value==null?null:value.toString();}
    private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atOffset(ZoneOffset.ofHours(8));}
    private static BusinessException forbidden(String reason){return new BusinessException(CommonErrorCode.FORBIDDEN,reason);}
}
