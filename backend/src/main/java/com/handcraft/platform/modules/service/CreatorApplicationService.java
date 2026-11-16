package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;

/** 入驻材料、历史、审核及归属规则，认证状态以数据库为准。 */
public interface CreatorApplicationService {
    /** 返回本人认证状态及当前/已通过申请引用。 */
    CreatorCertificationVO certification(Long userId);
    /** 按身份读取本人历史或管理员状态队列。 */
    PageVO<ApplicationSummaryVO> list(Long userId,boolean admin,String status,int page,int size);
    /** 校验归属后返回完整材料，管理员模式必须重新校验权限。 */
    CreatorApplicationVO detail(Long userId,Long id,boolean admin);
    /** 新增不可变材料，按请求键去重；结果包含是否首次创建。 */
    Submission submit(Long userId,CreatorApplicationDTO input);
    /** 仅本人可撤回待审核申请，保留历史。 */
    CreatorApplicationVO withdraw(Long userId,Long id);
    /** 单管理员原子产生最终结论、账号资格、通知与操作历史。 */
    CreatorApplicationVO review(Long adminId,Long id,CreatorReviewDTO input);
    /** @param application 申请详情 @param created 是否首次创建，决定201或200 */
    record Submission(CreatorApplicationVO application,boolean created) {}
}
