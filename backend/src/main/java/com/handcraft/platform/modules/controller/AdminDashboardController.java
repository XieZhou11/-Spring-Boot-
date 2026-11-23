package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.AdminDashboardQueryDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.AdminDashboardService;
import com.handcraft.platform.modules.vo.AdminDashboardVO;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 后台首页基础数据统计。 */
@RestController
public class AdminDashboardController {
    private final AdminDashboardService dashboard;
    public AdminDashboardController(AdminDashboardService dashboard){this.dashboard=dashboard;}
    @GetMapping("/api/admin/dashboard") public Result<AdminDashboardVO> dashboard(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute AdminDashboardQueryDTO q){return Result.ok(dashboard.dashboard(p.userId(),q));}
}
