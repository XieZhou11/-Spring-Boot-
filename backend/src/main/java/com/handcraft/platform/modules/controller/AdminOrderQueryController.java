package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.AdminOrderQueryDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.AdminOrderQueryService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 管理员全局订单只读列表。 */
@RestController
public class AdminOrderQueryController {
    private final AdminOrderQueryService orders;
    public AdminOrderQueryController(AdminOrderQueryService orders){this.orders=orders;}
    @GetMapping("/api/admin/orders") public Result<PageVO<AdminOrderVO>> list(@AuthenticationPrincipal AccountPrincipal p,@Valid @ModelAttribute AdminOrderQueryDTO q){return Result.ok(orders.list(p.userId(),q));}
    @GetMapping("/api/admin/orders/{id}") public Result<AdminOrderDetailVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(orders.detail(p.userId(),id));}
}
