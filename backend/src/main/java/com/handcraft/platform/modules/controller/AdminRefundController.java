package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.AdminRefundService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
/** 管理员售后资源不复用交易参与方控制器或写权限。 */
@RestController @RequestMapping("/api/admin/refund-applications")
public class AdminRefundController {
    private final AdminRefundService refunds;
    public AdminRefundController(AdminRefundService refunds){this.refunds=refunds;}
    @GetMapping public Result<PageVO<AdminRefundQueueVO>> list(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute AdminRefundQueryDTO q){return Result.ok(refunds.list(p.userId(),q));}
    @GetMapping("/{id}") public Result<AdminRefundDetailVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(refunds.detail(p.userId(),id));}
    @GetMapping("/{id}/evidence") public Result<RefundEvidencePageVO> evidence(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(required=false)Long cursor,@RequestParam(defaultValue="20")int size){return Result.ok(refunds.evidence(p.userId(),id,cursor,size));}
    @GetMapping("/{id}/messages") public Result<ChatMessagePageVO> messages(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(required=false)Long before,@RequestParam(required=false)Long after,@RequestParam(defaultValue="20")int size){return Result.ok(refunds.messages(p.userId(),id,before,after,size));}
    @GetMapping("/{id}/images/{fileId}") public Result<ImageVO> image(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@PathVariable Long fileId){return Result.ok(refunds.image(p.userId(),id,fileId));}
    @PutMapping("/{id}/decision") public Result<AdminRefundDetailVO> decision(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody AdminRefundDecisionDTO input){refunds.decide(p.userId(),id,input);return Result.ok(refunds.detail(p.userId(),id));}
}
