package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.CustomRequestService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
/** 需求写入受CSRF与服务端身份/归属保护，所有GET仅查询。 */
@RestController @Validated
public class CustomRequestController {
    private final CustomRequestService requests;
    public CustomRequestController(CustomRequestService requests){this.requests=requests;}
    @GetMapping("/api/custom-requests") public Result<PageVO<CustomRequestVO>> hall(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute CustomRequestQueryDTO q){return Result.ok(requests.list(p.userId(),"PUBLIC",q));}
    @GetMapping("/api/custom-requests/{id}") public Result<CustomRequestVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(requests.detail(p.userId(),id,false));}
    @GetMapping("/api/me/custom-requests") public Result<PageVO<CustomRequestVO>> mine(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute CustomRequestQueryDTO q){return Result.ok(requests.list(p.userId(),"OWN",q));}
    @PostMapping("/api/me/custom-requests") public ResponseEntity<Result<CustomRequestVO>> create(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody CustomRequestCreateDTO input){var r=requests.create(p.userId(),input);return ResponseEntity.status(r.created()?201:200).body(Result.ok(r.request()));}
    @GetMapping("/api/me/custom-requests/{id}") public Result<CustomRequestVO> ownDetail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(requests.detail(p.userId(),id,true));}
    @PutMapping("/api/me/custom-requests/{id}") public Result<CustomRequestVO> save(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody CustomRequestSaveDTO input){return Result.ok(requests.save(p.userId(),id,input));}
    @DeleteMapping("/api/me/custom-requests/{id}") public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam @PositiveOrZero Long version){requests.delete(p.userId(),id,version);return ResponseEntity.noContent().build();}
    @PutMapping("/api/me/custom-requests/{id}/publication") public Result<CustomRequestVO> publish(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody CustomRequestPublicationDTO input){return Result.ok(requests.publish(p.userId(),id,input));}
    @PutMapping("/api/me/custom-requests/{id}/closure") public Result<CustomRequestVO> close(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody CustomRequestVersionDTO input){return Result.ok(requests.close(p.userId(),id,input.getVersion()));}
    @PostMapping("/api/me/custom-requests/{id}/copies") public ResponseEntity<Result<CustomRequestVO>> copy(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody RequestKeyDTO input){var r=requests.copy(p.userId(),id,input.getRequestKey());return ResponseEntity.status(r.created()?201:200).body(Result.ok(r.request()));}
    @GetMapping("/api/me/custom-request-quota") public Result<CustomRequestQuotaVO> quota(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(requests.quota(p.userId()));}
    @GetMapping("/api/me/custom-request-invitations") public Result<PageVO<CustomRequestVO>> invitations(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute CustomRequestQueryDTO q){return Result.ok(requests.list(p.userId(),"INVITED",q));}
}
