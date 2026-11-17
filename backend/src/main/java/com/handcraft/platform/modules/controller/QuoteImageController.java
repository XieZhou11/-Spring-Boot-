package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.QuoteImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 报价图片续签每次核验当前登录账号和真实历史关系。 */
@RestController
@RequestMapping("/api/quote-images")
public class QuoteImageController {
    private final QuoteImageService images;

    public QuoteImageController(QuoteImageService images) { this.images = images; }

    @PostMapping
    public ResponseEntity<Result<ImageVO>> upload(@AuthenticationPrincipal AccountPrincipal principal,
                                                 @RequestPart MultipartFile file) {
        return ResponseEntity.status(201).body(Result.ok(images.upload(principal.userId(), file)));
    }

    @GetMapping("/{id}")
    public Result<ImageVO> image(@AuthenticationPrincipal AccountPrincipal principal, @PathVariable Long id) {
        return Result.ok(images.image(principal.userId(), id));
    }
}
