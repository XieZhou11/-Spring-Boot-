package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.WorkCommentImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/** 评论图片只经服务层鉴权签发私有访问地址。 */
@RestController
@RequestMapping("/api/work-comment-images")
public class WorkCommentImageController {
    private final WorkCommentImageService images;
    public WorkCommentImageController(WorkCommentImageService images){this.images=images;}
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public Result<ImageVO> upload(@AuthenticationPrincipal AccountPrincipal user,@RequestPart("file")MultipartFile file){return Result.ok(images.upload(user.userId(),file));}
    @GetMapping("/{id}")
    public Result<ImageVO> view(@AuthenticationPrincipal AccountPrincipal user,@PathVariable Long id){return Result.ok(images.view(user.userId(),id));}
}
