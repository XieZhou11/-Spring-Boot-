package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.CustomRequestImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
/** 私有参考图和会话图签名每次都重新验证业务关系。 */
@RestController
public class CustomRequestImageController {
    private final CustomRequestImageService images;
    public CustomRequestImageController(CustomRequestImageService images){this.images=images;}
    @PostMapping("/api/custom-request-images") public ResponseEntity<Result<ImageVO>> upload(@AuthenticationPrincipal AccountPrincipal p,@RequestPart MultipartFile file){return ResponseEntity.status(201).body(Result.ok(images.uploadRequest(p.userId(),file)));}
    @GetMapping("/api/custom-request-images/{id}") public Result<ImageVO> requestImage(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(images.requestImage(p.userId(),id));}
    @PostMapping("/api/conversations/{id}/images") public ResponseEntity<Result<ImageVO>> uploadChat(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestPart MultipartFile file){return ResponseEntity.status(201).body(Result.ok(images.uploadConversation(p.userId(),id,file)));}
    @GetMapping("/api/conversation-images/{id}") public Result<ImageVO> chatImage(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(images.conversationImage(p.userId(),id));}
}
