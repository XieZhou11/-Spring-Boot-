package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.RefundApplicationService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
/** 事务提交后读取最新申请；新创建201，同一请求键核验200。 */
@RestController @RequestMapping("/api")
public class RefundApplicationController {
    private final RefundApplicationService refunds;
    public RefundApplicationController(RefundApplicationService refunds){this.refunds=refunds;}
    @PostMapping("/orders/{orderId}/refund-applications") public ResponseEntity<Result<RefundApplicationVO>> create(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long orderId,@Valid @RequestBody RefundApplicationDTO input){return created(p,refunds.create(p.userId(),orderId,input));}
    @GetMapping("/orders/{orderId}/refund-applications") public Result<PageVO<RefundApplicationVO>> list(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long orderId,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String requestKey){return Result.ok(refunds.list(p.userId(),orderId,page,size,requestKey));}
    @GetMapping("/refund-applications/{id}") public Result<RefundApplicationVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(refunds.detail(p.userId(),id));}
    @GetMapping("/refund-applications/{id}/evidence") public Result<RefundEvidencePageVO> evidence(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(defaultValue="0")long afterId,@RequestParam(defaultValue="20")int size,@RequestParam(required=false)String requestKey){return Result.ok(refunds.evidence(p.userId(),id,afterId,size,requestKey));}
    @PostMapping("/refund-applications/{id}/evidence") public ResponseEntity<Result<RefundApplicationVO>> supplement(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody RefundEvidenceDTO input){return created(p,refunds.supplement(p.userId(),id,input));}
    @PutMapping("/refund-applications/{id}/withdrawal") public Result<RefundApplicationVO> withdraw(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){refunds.withdraw(p.userId(),id);return Result.ok(refunds.detail(p.userId(),id));}
    private ResponseEntity<Result<RefundApplicationVO>> created(AccountPrincipal p,RefundApplicationService.Creation result){return ResponseEntity.status(result.created()?201:200).body(Result.ok(refunds.detail(p.userId(),result.id())));}
}
