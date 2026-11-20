package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;
/** 作品展示、作者管理与管理员审核的业务入口。 */
public interface WorkService {
    /** 创建可不完整的草稿，作者范围内请求键保证重试幂等。 */
    Creation create(Long userId,WorkCreateDTO input);
    /** 保存草稿或修订已驳回、已下架作品；待审核须先撤回。 */
    WorkVO save(Long userId,Long id,WorkSaveDTO input);
    /** 完整字段提交审核，首次提交才计自然日额度。 */
    WorkVO submit(Long userId,Long id,WorkSaveDTO input);
    /** 本人撤回待审核作品，回到草稿。 */
    WorkVO withdraw(Long userId,Long id,WorkVersionDTO input);
    /** 仅逻辑删除本人草稿，不返还首次提交额度。 */
    void delete(Long userId,Long id,Long version);
    /** 已上架交易设置即时生效且不能重置已锁定、已售出状态。 */
    WorkVO trading(Long userId,Long id,WorkTradingDTO input);
    /** 作者或管理员下架，管理员原因必填并发送通知。 */
    WorkVO offline(Long userId,Long id,WorkVersionDTO input,String reason,boolean admin);
    /** 审核待审核版本，通知、状态与内容快照同事务保存。 */
    WorkVO review(Long userId,Long id,WorkReviewDTO input);
    /** 按PUBLIC、OWN、ADMIN查询对应权限详情。 */
    WorkVO detail(Long userId,Long id,String mode);
    /** 查询公开组合筛选或有权限的管理列表。 */
    PageVO<WorkVO> list(Long userId,String mode,WorkQueryDTO query);
    /** 查询本人或管理员可见的不可变历史。 */
    PageVO<WorkHistoryVO> history(Long userId,Long id,boolean admin,int page,int size);
    /** 查询北京时间首次提交额度及当前发布资格。 */
    WorkPublicationQuotaVO quota(Long userId);
    /** 公开创作者主页不返回认证私密材料。 */
    CreatorPublicVO creator(Long userId,Long creatorId);
    /** 定向需求表单按末级品类选择同主品类且可接单的非本人创作者。 */
    PageVO<CreatorPublicVO> customCandidates(Long userId,Long categoryId,String keyword,int page,int size);
    /** 查询本人买家已同意公开的定制订单摘要，供手动关联案例。 */
    java.util.List<PublicationOrderOptionVO> approvedPublicationOrders(Long userId);
    /** @param work 草稿视图 @param created 是否首次创建 */
    record Creation(WorkVO work,boolean created) {}
}
