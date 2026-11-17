package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.QuoteService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 报价与对比入口，服务端按买家和报价作者关系裁剪结果。 */
@RestController
public class QuoteController {
    private final QuoteService quotes;
    public QuoteController(QuoteService quotes){this.quotes=quotes;}
    @PostMapping("/api/custom-requests/{id}/quotes")
    public ResponseEntity<Result<QuoteVO>> create(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@Valid @RequestBody QuoteCreateDTO input) {
        var result=quotes.create(principal.userId(),id,input);return ResponseEntity.status(result.created()?201:200).body(Result.ok(result.quote()));
    }
    @GetMapping("/api/custom-requests/{id}/quotes")
    public Result<PageVO<QuoteVO>> requestQuotes(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@Valid @ModelAttribute QuoteQueryDTO query) {
        return Result.ok(quotes.list(principal.userId(),id,query));
    }
    @GetMapping("/api/custom-requests/{id}/quote-comparison")
    public Result<QuoteComparisonVO> comparison(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@RequestParam(defaultValue="AMOUNT") String sort) {
        return Result.ok(quotes.comparison(principal.userId(),id,sort));
    }
    @GetMapping("/api/me/quotes")
    public Result<PageVO<QuoteVO>> mine(@AuthenticationPrincipal AccountPrincipal principal,@Valid @ModelAttribute QuoteQueryDTO query) {
        return Result.ok(quotes.list(principal.userId(),null,query));
    }
    @GetMapping("/api/me/quote-quota")
    public Result<QuoteQuotaVO> quota(@AuthenticationPrincipal AccountPrincipal principal){return Result.ok(quotes.quota(principal.userId()));}
    @GetMapping("/api/quotes/{id}")
    public Result<QuoteVO> detail(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id){return Result.ok(quotes.detail(principal.userId(),id));}
    @PutMapping("/api/quotes/{id}/withdrawal")
    public Result<QuoteVO> withdraw(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id){return Result.ok(quotes.withdraw(principal.userId(),id));}
}
