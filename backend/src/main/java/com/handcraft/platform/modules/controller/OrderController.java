package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.OrderService;
import com.handcraft.platform.modules.service.OrderPaymentService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 定标与待付款订单资源，不接受客户端计算的成交金额或地址快照。 */
@RestController
public class OrderController {
    private final OrderService orders;
    private final OrderPaymentService payments;
    public OrderController(OrderService orders,OrderPaymentService payments){this.orders=orders;this.payments=payments;}
    /** 首次现货建单201；相同请求键重试返回原订单200。 */
    @PostMapping("/api/works/{id}/orders")
    public ResponseEntity<Result<OrderVO>> createStock(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@Valid @RequestBody StockOrderDTO input){
        var result=orders.createStock(principal.userId(),id,input);return ResponseEntity.status(result.created()?201:200).body(Result.ok(result.order()));
    }
    /** 写事务已提交后再读取完整详情；响应失败时可按订单重试确认原支付。 */
    @PutMapping("/api/orders/{id}/payment")
    public ResponseEntity<Result<OrderVO>> payment(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long id,@Valid @RequestBody OrderPaymentDTO input){
        boolean created=payments.pay(principal.userId(),id,input);
        return ResponseEntity.status(created?201:200).body(Result.ok(orders.detail(principal.userId(),id)));
    }
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
