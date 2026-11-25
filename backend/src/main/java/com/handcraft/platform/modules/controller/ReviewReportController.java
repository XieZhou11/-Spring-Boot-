package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.OrderReviewService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 评价举报及管理员处理资源。 */
@RestController
public class ReviewReportController {
    private final OrderReviewService reviews;
    public ReviewReportController(OrderReviewService reviews){this.reviews=reviews;}
    @PostMapping("/api/reviews/{id}/reports") public Result<ReviewReportVO> report(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ReviewReportDTO input){return Result.ok(reviews.report(p.userId(),id,input));}
    @GetMapping("/api/reviews/{id}/reports") public Result<java.util.List<ReviewReportVO>> reviewReports(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reviews.reviewReports(p.userId(),id));}
    @GetMapping("/api/review-reports/{id}") public Result<ReviewReportDetailVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reviews.reportDetail(p.userId(),id));}
    @PostMapping("/api/review-reports/{id}/evidence") public Result<ReviewReportDetailVO> evidence(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ReviewReportEvidenceDTO input){return Result.ok(reviews.addEvidence(p.userId(),id,input));}
    @GetMapping("/api/me/review-reports") public Result<PageVO<ReviewReportVO>> mine(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(reviews.myReports(p.userId(),page,size));}
    @GetMapping("/api/admin/review-reports") public Result<PageVO<ReviewReportVO>> admin(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="PENDING")String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(reviews.adminReports(p.userId(),status,page,size));}
    @GetMapping("/api/admin/review-reports/{id}/messages")
    public Result<ChatMessagePageVO> adminMessages(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,
            @RequestParam(required=false) Long before,@RequestParam(required=false) Long after,
            @RequestParam(defaultValue="20") int size){
        return Result.ok(reviews.adminReportMessages(principal.userId(),id,before,after,size));
    }
    @GetMapping("/api/admin/review-reports/{id}/images/{fileId}")
    public Result<ImageVO> adminImage(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@PathVariable Long fileId){
        return Result.ok(reviews.adminReportImage(principal.userId(),id,fileId));
    }
    @PutMapping("/api/admin/review-reports/{id}/decision") public Result<ReviewReportVO> decision(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody AdminReviewReportDecisionDTO input){return Result.ok(reviews.decide(p.userId(),id,input));}
    @GetMapping("/api/review-images/{id}") public Result<ImageVO> image(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reviews.image(p.userId(),id));}
}
