package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.AdminSettlementQueryDTO;
import com.handcraft.platform.modules.dto.SettlementQueryDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.SettlementQueryService;
import com.handcraft.platform.modules.vo.AdminSettlementVO;
import com.handcraft.platform.modules.vo.CreatorSettlementVO;
import com.handcraft.platform.modules.vo.PageVO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/** 结算记录查询：本人收入记录与管理员资金记录均为只读。 */
@RestController @Validated
public class SettlementQueryController {
    private final SettlementQueryService settlements;
    public SettlementQueryController(SettlementQueryService settlements){this.settlements=settlements;}

    /** 创作者本人收入记录。 */
    @GetMapping("/api/me/settlements")
    public Result<PageVO<CreatorSettlementVO>> mine(@AuthenticationPrincipal AccountPrincipal principal,@Valid @ModelAttribute SettlementQueryDTO query){
        return Result.ok(settlements.mine(principal.userId(),query));
    }

    /** 管理员资金记录。 */
    @GetMapping("/api/admin/settlements")
    public Result<PageVO<AdminSettlementVO>> admin(@AuthenticationPrincipal AccountPrincipal principal,@Valid @ModelAttribute AdminSettlementQueryDTO query){
        return Result.ok(settlements.admin(principal.userId(),query));
    }
}
