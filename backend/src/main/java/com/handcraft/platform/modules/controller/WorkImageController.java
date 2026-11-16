package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.WorkImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
/** 上传与续签使用独立资源，签名URL不写入作品正文。 */
@RestController
public class WorkImageController {
    private final WorkImageService images;
    public WorkImageController(WorkImageService images){this.images=images;}
    @PostMapping("/api/work-images") public ResponseEntity<Result<ImageVO>> upload(@AuthenticationPrincipal AccountPrincipal p,@RequestPart MultipartFile file){return ResponseEntity.status(201).body(Result.ok(images.upload(p.userId(),file)));}
    @GetMapping("/api/work-images/{id}") public Result<ImageVO> view(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(images.view(p.userId(),id));}
}
