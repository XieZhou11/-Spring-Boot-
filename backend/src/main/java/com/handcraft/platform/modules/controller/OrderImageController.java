package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.OrderImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 履约图和退款凭证使用独立资源路径，实际归属和状态由服务层复核。 */
@RestController
@RequestMapping("/api")
public class OrderImageController {
    private final OrderImageService images;
    public OrderImageController(OrderImageService images){this.images=images;}

    @PostMapping("/orders/{orderId}/progress-images")
    public ResponseEntity<Result<ImageVO>> progress(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long orderId,@RequestPart MultipartFile file){
        return ResponseEntity.status(201).body(Result.ok(images.upload(principal.userId(),orderId,"PROGRESS",file)));
    }
    @PostMapping("/orders/{orderId}/refund-images")
    public ResponseEntity<Result<ImageVO>> refund(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long orderId,@RequestPart MultipartFile file){
        return ResponseEntity.status(201).body(Result.ok(images.upload(principal.userId(),orderId,"REFUND",file)));
    }
    @GetMapping("/order-progress-images/{fileId}")
    public Result<ImageVO> progress(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long fileId){
        return Result.ok(images.image(principal.userId(),fileId,"PROGRESS"));
    }
    @GetMapping("/order-refund-images/{fileId}")
    public Result<ImageVO> refund(@AuthenticationPrincipal AccountPrincipal principal,@PathVariable Long fileId){
        return Result.ok(images.image(principal.userId(),fileId,"REFUND"));
    }
}
