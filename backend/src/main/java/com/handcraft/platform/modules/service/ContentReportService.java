package com.handcraft.platform.modules.service;

import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.vo.*;

/** 作品、评论与创作者主页举报及管理员处置；评价举报仍由 OrderReviewService 处理。 */
public interface ContentReportService {
    /** 举报已上架作品，处理中重复提交合并为补充证据。 */ ContentReportVO submitWorkReport(Long userId,Long workId,ContentReportDTO input);
    /** 举报可见评论，作品作者与普通用户均可提交，评论作者本人除外。 */ ContentReportVO submitCommentReport(Long userId,Long commentId,ContentReportDTO input);
    /** 举报已认证创作者主页，创作者本人除外。 */ ContentReportVO submitProfileReport(Long userId,Long creatorId,ContentReportDTO input);
    /** 举报详情：目标快照、证据、处置历史及当前用户可执行动作。 */ ContentReportDetailVO detail(Long userId,Long reportId);
    /** 举报人处理中补证或被处理人对已处理结论提出异议。 */ ContentReportDetailVO addEvidence(Long userId,Long reportId,ReviewReportEvidenceDTO input);
    /** 本人全部类型举报分页，最新优先。 */ PageVO<ContentReportVO> myReports(Long userId,int page,int size);
    /** 管理员举报队列，可按目标类型与状态筛选。 */ PageVO<ContentReportVO> adminReports(Long adminId,String status,String type,int page,int size);
    /** 管理员处置或更正：作品下架/恢复、评论隐藏/恢复、主页暂停/恢复新业务、不成立。 */ ContentReportVO decide(Long adminId,Long reportId,AdminContentReportDecisionDTO input);
    /** 举报人、被处理人和管理员按举报关系读取私有证据图片。 */ ImageVO image(Long userId,Long fileId);
}
