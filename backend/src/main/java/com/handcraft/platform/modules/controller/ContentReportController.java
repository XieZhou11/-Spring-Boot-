package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.ContentReportService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 内容举报资源：作品、评论与创作者主页举报及管理员处置；评价举报走既有端点。 */
@RestController
public class ContentReportController {
    private final ContentReportService reports;
    public ContentReportController(ContentReportService reports){this.reports=reports;}
    @PostMapping("/api/works/{id}/reports") public ResponseEntity<Result<ContentReportVO>> work(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ContentReportDTO input){return ResponseEntity.status(201).body(Result.ok(reports.submitWorkReport(p.userId(),id,input)));}
    @PostMapping("/api/work-comments/{id}/reports") public ResponseEntity<Result<ContentReportVO>> comment(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ContentReportDTO input){return ResponseEntity.status(201).body(Result.ok(reports.submitCommentReport(p.userId(),id,input)));}
    @PostMapping("/api/creators/{id}/reports") public ResponseEntity<Result<ContentReportVO>> creator(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ContentReportDTO input){return ResponseEntity.status(201).body(Result.ok(reports.submitProfileReport(p.userId(),id,input)));}
    @GetMapping("/api/reports/{id}") public Result<ContentReportDetailVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reports.detail(p.userId(),id));}
    @PostMapping("/api/reports/{id}/evidence") public Result<ContentReportDetailVO> evidence(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ReviewReportEvidenceDTO input){return Result.ok(reports.addEvidence(p.userId(),id,input));}
    @GetMapping("/api/me/reports") public Result<PageVO<ContentReportVO>> mine(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(reports.myReports(p.userId(),page,size));}
    @GetMapping("/api/admin/reports") public Result<PageVO<ContentReportVO>> admin(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="PENDING")String status,@RequestParam(defaultValue="ALL")String type,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(reports.adminReports(p.userId(),status,type,page,size));}
    @PutMapping("/api/admin/reports/{id}/decision") public Result<ContentReportVO> decision(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody AdminContentReportDecisionDTO input){return Result.ok(reports.decide(p.userId(),id,input));}
    @GetMapping("/api/report-images/{id}") public Result<ImageVO> image(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reports.image(p.userId(),id));}
}
