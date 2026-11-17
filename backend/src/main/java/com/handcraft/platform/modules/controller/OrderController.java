package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.OrderService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 定标与待付款订单资源，不接受客户端计算的成交金额或地址快照。 */
@RestController
public class OrderController {
    private final OrderService orders;
    public OrderController(OrderService orders){this.orders=orders;}
    @PutMapping("/api/custom-requests/{id}/award")
    public ResponseEntity<Result<OrderVO>> award(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@Valid @RequestBody AwardDTO input) {
        var result=orders.award(principal.userId(),id,input);return ResponseEntity.status(result.created()?201:200).body(Result.ok(result.order()));
    }
    @GetMapping("/api/me/orders")
    public Result<PageVO<OrderVO>> mine(@AuthenticationPrincipal AccountPrincipal principal,@Valid @ModelAttribute OrderQueryDTO query) {
        return Result.ok(orders.list(principal.userId(),query));
    }
    @GetMapping("/api/orders/{id}")
    public Result<OrderVO> detail(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id){return Result.ok(orders.detail(principal.userId(),id));}
    @PutMapping("/api/orders/{id}/cancellation")
    public Result<OrderVO> cancel(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id){return Result.ok(orders.cancel(principal.userId(),id));}
}
