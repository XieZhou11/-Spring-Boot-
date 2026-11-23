package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.AdminUserService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 管理员用户检索和新业务暂停处置。 */
@RestController
public class AdminUserController {
    private final AdminUserService users;
    public AdminUserController(AdminUserService users){this.users=users;}
    @GetMapping("/api/admin/users") public Result<PageVO<java.util.Map<String,Object>>> list(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute AdminUserQueryDTO q){return Result.ok(users.list(p.userId(),q));}
    @GetMapping("/api/admin/users/{id}") public Result<AdminUserDetailVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(users.detail(p.userId(),id));}
    @PutMapping("/api/admin/users/{id}/business-pause") public Result<AdminUserBusinessVO> pause(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody AdminBusinessPauseDTO input){return Result.ok(users.setBusinessPause(p.userId(),id,input));}
    @GetMapping("/api/me/creator-pause") public Result<AdminUserBusinessVO> creatorState(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(users.creatorState(p.userId()));}
    @PutMapping("/api/me/creator-pause") public Result<AdminUserBusinessVO> creatorPause(@AuthenticationPrincipal AccountPrincipal p,@Valid @RequestBody CreatorPauseDTO input){return Result.ok(users.setCreatorPause(p.userId(),input));}
}
