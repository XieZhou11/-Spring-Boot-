package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.modules.dto.AdminDashboardQueryDTO;
import com.handcraft.platform.modules.mapper.AdminDashboardMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.AdminDashboardService;
import com.handcraft.platform.modules.service.CustomRequestPolicyService;
import com.handcraft.platform.modules.vo.AdminDashboardVO;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.slf4j.*;
import org.springframework.stereotype.Service;

/** 看板统计始终从当前业务表和成功资金流水读取，不缓存过期口径。 */
@Service
public class AdminDashboardServiceImpl implements AdminDashboardService {
    private static final Logger LOG=LoggerFactory.getLogger(AdminDashboardServiceImpl.class);
    private final AdminDashboardMapper data;private final UserAccountMapper users;private final CustomRequestPolicyService policy;
    public AdminDashboardServiceImpl(AdminDashboardMapper data,UserAccountMapper users,CustomRequestPolicyService policy){this.data=data;this.users=users;this.policy=policy;}
    @Override public AdminDashboardVO dashboard(Long admin,AdminDashboardQueryDTO q){return BusinessLog.run(LOG,"后台数据看板查询",admin,()->{
        var actor=users.findById(admin);if(actor==null||!actor.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅管理员可以查看数据看板");
        ZoneId zone=ZoneId.of("Asia/Shanghai");LocalDate today=LocalDate.now(zone);LocalDate from=q.getFrom()==null||q.getFrom().isBlank()?today:LocalDate.parse(q.getFrom());LocalDate to=q.getTo()==null||q.getTo().isBlank()?today:LocalDate.parse(q.getTo());
        LocalDateTime start=from.atStartOfDay(),end=to.plusDays(1).atStartOfDay();
        var now=policy.now();Map<String,Long> works=group(data.works()),requests=group(data.requests()),orders=group(data.orders(now));
        Map<String,Long> todos=new LinkedHashMap<>();todos.put("creatorApplications",data.pendingApplications());todos.put("works",data.pendingWorks());todos.put("reports",data.pendingReports());todos.put("refunds",data.pendingRefunds());todos.put("total",todos.values().stream().mapToLong(Long::longValue).sum());
        LOG.info("后台看板关键统计完成：adminId={}, from={}, to={}",admin,from,to);
        return new AdminDashboardVO(now.atOffset(ZoneOffset.ofHours(8)),data.users(),data.newUsers(start,end),data.creators(),data.newCreators(start,end),works,requests,orders,money(data.payments()),money(data.refunds()),money(data.pending()),money(data.settled()),todos,from.toString(),to.toString());
    });}
    private Map<String,Long> group(List<Map<String,Object>> rows){Map<String,Long> result=new LinkedHashMap<>();for(var row:rows){Object key=value(row,"status");Object total=value(row,"total");if(key!=null&&total!=null)result.put(key.toString(),((Number)total).longValue());}return result;}
    private Object value(Map<String,Object> row,String key){Object found=row.get(key);if(found!=null)return found;for(var entry:row.entrySet())if(entry.getKey().equalsIgnoreCase(key))return entry.getValue();return null;}
    private String money(BigDecimal value){return value.setScale(2,java.math.RoundingMode.UNNECESSARY).toPlainString();}
}
