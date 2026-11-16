package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.CreatorImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 私有入驻图片，签名接口每次重新验证读取权限。 */
@RestController @RequestMapping("/api/creator-application-images")
public class CreatorImageController {
    private final CreatorImageService images;
    public CreatorImageController(CreatorImageService images){this.images=images;}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Result<ImageVO> upload(@AuthenticationPrincipal AccountPrincipal p,@RequestPart("file")MultipartFile file){return Result.ok(images.upload(p.userId(),file));}
    @GetMapping("/{id}") public Result<ImageVO> view(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(images.view(p.userId(),id));}
}
