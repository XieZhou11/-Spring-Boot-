package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;

/** 订单评价、创作者公开口碑及评价举报治理。 */
public interface OrderReviewService {
    /** 查看订单评价及当前买家的评价资格。 */ OrderReviewVO orderReview(Long userId,Long orderId);
    /** 买家对符合窗口的已完成订单提交唯一评价。 */ OrderReviewVO create(Long userId,Long orderId,OrderReviewDTO input);
    /** 查询创作者公开评价及口碑统计。 */ PageVO<CreatorReviewVO> creatorReviews(Long userId,Long creatorId,int page,int size);
    /** 买家举报评价；同一待处理举报重复提交只追加证据。 */ ReviewReportVO report(Long userId,Long reviewId,ReviewReportDTO input);
    /** 按举报人与交易参与方权限读取举报核查详情。 */ ReviewReportDetailVO reportDetail(Long userId,Long reportId);
    /** 举报人补充材料，交易参与方对已处理结论提交异议。 */ ReviewReportDetailVO addEvidence(Long userId,Long reportId,ReviewReportEvidenceDTO input);
    /** 查看本人举报记录。 */ PageVO<ReviewReportVO> myReports(Long userId,int page,int size);
    /** 查询本人举报或本人交易评价关联的举报记录。 */ java.util.List<ReviewReportVO> reviewReports(Long userId,Long reviewId);
    /** 管理员查询评价举报队列。 */ PageVO<ReviewReportVO> adminReports(Long adminId,String status,int page,int size);
    /** 管理员查阅并处理评价举报。 */ ReviewReportVO decide(Long adminId,Long reportId,AdminReviewReportDecisionDTO input);
    /** 评价图片能否公开读取或由本人读取。 */ ImageVO image(Long userId,Long fileId);
}
