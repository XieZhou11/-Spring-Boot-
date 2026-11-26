package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.entity.*;
import java.time.LocalDateTime;
import java.util.*;
/** 需求、会话和私有图片共用的身份、可见性及有效状态规则。 */
public interface CustomRequestPolicyService {
    /** 读取实际账号，管理员不能作为交易主体。 */
    UserAccount user(Long userId);
    /** 按账号编号升序加锁，资格和暂停变化不能穿透新业务校验。 */
    void lockUsers(Long... userIds);
    /** 查询已认证主品类编号。 */
    List<Long> mainCategories(UserAccount user);
    /** 返回创作者认证、暂停和品类资格的拒绝原因，合格返回空。 */
    String creatorReason(UserAccount user,Long categoryId);
    /** 锁定待发布需求的启用末级品类，返回一级主品类。 */
    Long lockPublicationCategory(Long categoryId);
    /** 锁定存量业务引用的启用品类，允许原一级已新增子类，返回一级主品类。 */
    Long lockTradingCategory(Long categoryId);
    /** 在当前服务器时刻计算有效状态，不写数据库。 */
    String effectiveStatus(CustomRequest request);
    /** 校验本人或公开/定向可见性；隐藏资源统一返回404。 */
    void visible(Long userId,CustomRequest request,boolean ownOnly);
    /** 开放且未有效过期才允许开展新咨询。 */
    void open(CustomRequest request);
    /** 当前北京时间，统一期限与消息时间依据。 */
    LocalDateTime now();
}
