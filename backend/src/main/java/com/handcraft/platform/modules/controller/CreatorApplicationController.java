package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.CreatorApplicationService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 入驻申请资源，审核、撤回及提交的写入通过显式HTTP方法进行。 */
@RestController
public class CreatorApplicationController {
    private final CreatorApplicationService applications;
    public CreatorApplicationController(CreatorApplicationService applications){this.applications=applications;}
    @GetMapping("/api/me/creator-certification") public Result<CreatorCertificationVO> certification(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(applications.certification(p.userId()));}
    @GetMapping("/api/me/creator-applications") public Result<PageVO<ApplicationSummaryVO>> own(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(applications.list(p.userId(),false,null,page,size));}
    @PostMapping("/api/me/creator-applications") public ResponseEntity<Result<CreatorApplicationVO>> submit(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody CreatorApplicationDTO input){var result=applications.submit(p.userId(),input);return ResponseEntity.status(result.created()?201:200).body(Result.ok(result.application()));}
    @GetMapping("/api/me/creator-applications/{id}") public Result<CreatorApplicationVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(applications.detail(p.userId(),id,false));}
    @PutMapping("/api/me/creator-applications/{id}/withdrawal") public Result<CreatorApplicationVO> withdraw(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(applications.withdraw(p.userId(),id));}
    @GetMapping("/api/admin/creator-applications") public Result<PageVO<ApplicationSummaryVO>> queue(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="PENDING")String status,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(applications.list(p.userId(),true,status,page,size));}
    @GetMapping("/api/admin/creator-applications/{id}") public Result<CreatorApplicationVO> adminDetail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(applications.detail(p.userId(),id,true));}
    @PutMapping("/api/admin/creator-applications/{id}/review") public Result<CreatorApplicationVO> review(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody CreatorReviewDTO input){return Result.ok(applications.review(p.userId(),id,input));}
}
