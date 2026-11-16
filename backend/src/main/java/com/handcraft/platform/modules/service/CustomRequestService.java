package com.handcraft.platform.modules.service;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;
/** 定制需求的资格、隐私、额度与生命周期业务入口。 */
public interface CustomRequestService {
    /** 创建允许不完整的私人草稿，重试键及首次内容同时校验。 */
    Creation create(Long userId,CustomRequestCreateDTO input);
    /** 保存本人草稿，版本冲突拒绝覆盖，发布后正文不可修改。 */
    CustomRequestVO save(Long userId,Long id,CustomRequestSaveDTO input);
    /** 完整校验后发布，在用户行锁内限制最多五条开放需求。 */
    CustomRequestVO publish(Long userId,Long id,CustomRequestPublicationDTO input);
    /** 仅删除本人草稿，保留历史记录和图片引用。 */
    void delete(Long userId,Long id,Long version);
    /** 定标前关闭本人需求，同事务失效报价、归档未成单会话与通知。 */
    CustomRequestVO close(Long userId,Long id,Long version);
    /** 复制关闭或过期的本人需求，只带正文及本人参考图。 */
    Creation copy(Long userId,Long id,String requestKey);
    /** 只读查询本人或有权访问的已发布详情，计算有效过期状态。 */
    CustomRequestVO detail(Long userId,Long id,boolean ownOnly);
    /** 按本人、认证大厅或定向邀约权限查询分页。 */
    PageVO<CustomRequestVO> list(Long userId,String mode,CustomRequestQueryDTO query);
    /** 计算当前有效开放数量及暂停等发布限制。 */
    CustomRequestQuotaVO quota(Long userId);
    /** @param request 草稿视图 @param created 是否新建 */
    record Creation(CustomRequestVO request,boolean created) {}
}
