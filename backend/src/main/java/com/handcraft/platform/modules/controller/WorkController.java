package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.WorkService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
/** 登录后浏览作品；作者和管理员操作仍由服务层按归属、资格、版本校验。 */
@RestController @Validated
public class WorkController {
    private final WorkService works;
    public WorkController(WorkService works){this.works=works;}
    @GetMapping("/api/works") public Result<PageVO<WorkVO>> browse(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute WorkQueryDTO query){return Result.ok(works.list(p.userId(),"PUBLIC",query));}
    @GetMapping("/api/works/{id}") public Result<WorkVO> publicDetail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(works.detail(p.userId(),id,"PUBLIC"));}
    @GetMapping("/api/creators/{id}") public Result<CreatorPublicVO> creator(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(works.creator(p.userId(),id));}
    @GetMapping("/api/me/works") public Result<PageVO<WorkVO>> own(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute WorkQueryDTO query){return Result.ok(works.list(p.userId(),"OWN",query));}
    @PostMapping("/api/me/works") public ResponseEntity<Result<WorkVO>> create(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody WorkCreateDTO input){var result=works.create(p.userId(),input);return ResponseEntity.status(result.created()?201:200).body(Result.ok(result.work()));}
    @GetMapping("/api/me/works/{id}") public Result<WorkVO> ownDetail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(works.detail(p.userId(),id,"OWN"));}
    @PutMapping("/api/me/works/{id}") public Result<WorkVO> save(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkSaveDTO input){return Result.ok(works.save(p.userId(),id,input));}
    @DeleteMapping("/api/me/works/{id}") public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam @PositiveOrZero Long version){works.delete(p.userId(),id,version);return ResponseEntity.noContent().build();}
    @PutMapping("/api/me/works/{id}/submission") public Result<WorkVO> submit(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkSaveDTO input){return Result.ok(works.submit(p.userId(),id,input));}
    @PutMapping("/api/me/works/{id}/withdrawal") public Result<WorkVO> withdraw(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkVersionDTO input){return Result.ok(works.withdraw(p.userId(),id,input));}
    @PatchMapping("/api/me/works/{id}/trading-settings") public Result<WorkVO> trading(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkTradingDTO input){return Result.ok(works.trading(p.userId(),id,input));}
    @PutMapping("/api/me/works/{id}/publication") public Result<WorkVO> offline(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkVersionDTO input){return Result.ok(works.offline(p.userId(),id,input,null,false));}
    @GetMapping("/api/me/work-publication-quota") public Result<WorkPublicationQuotaVO> quota(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(works.quota(p.userId()));}
    @GetMapping("/api/admin/works") public Result<PageVO<WorkVO>> queue(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute WorkQueryDTO query){return Result.ok(works.list(p.userId(),"ADMIN",query));}
    @GetMapping("/api/admin/works/{id}") public Result<WorkVO> adminDetail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(works.detail(p.userId(),id,"ADMIN"));}
    @PutMapping("/api/admin/works/{id}/review") public Result<WorkVO> review(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkReviewDTO input){return Result.ok(works.review(p.userId(),id,input));}
    @PutMapping("/api/admin/works/{id}/publication") public Result<WorkVO> adminOffline(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkPublicationDTO input){return Result.ok(works.offline(p.userId(),id,input,input.getReason(),true));}
    @GetMapping("/api/me/works/{id}/history") public Result<PageVO<WorkHistoryVO>> history(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(works.history(p.userId(),id,false,page,size));}
    @GetMapping("/api/admin/works/{id}/history") public Result<PageVO<WorkHistoryVO>> adminHistory(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(works.history(p.userId(),id,true,page,size));}
}
