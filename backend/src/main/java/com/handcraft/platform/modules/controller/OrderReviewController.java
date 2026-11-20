package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.OrderReviewDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.OrderReviewService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 买家订单评价及创作者公开评价资源。 */
@RestController
public class OrderReviewController {
    private final OrderReviewService reviews;
    public OrderReviewController(OrderReviewService reviews){this.reviews=reviews;}
    @GetMapping("/api/orders/{id}/review") public Result<OrderReviewVO> order(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(reviews.orderReview(p.userId(),id));}
    @PostMapping("/api/orders/{id}/reviews") public ResponseEntity<Result<OrderReviewVO>> create(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody OrderReviewDTO input){return ResponseEntity.status(201).body(Result.ok(reviews.create(p.userId(),id,input)));}
    @GetMapping("/api/creators/{id}/reviews") public Result<PageVO<CreatorReviewVO>> creator(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(reviews.creatorReviews(p.userId(),id,page,size));}
}
