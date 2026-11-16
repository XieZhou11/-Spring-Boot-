package com.handcraft.platform.modules.controller;

import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.NotificationService;
import com.handcraft.platform.modules.vo.*;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** 通知只能由接收人查询与标已读，操作保留CSRF防护。 */
@RestController @RequestMapping("/api/me/notifications")
public class NotificationController {
    private final NotificationService notices;
    public NotificationController(NotificationService notices){this.notices=notices;}
    @GetMapping public Result<PageVO<NotificationVO>> list(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(notices.list(p.userId(),page,size));}
    @GetMapping("/unread-count") public Result<Map<String,Long>> unread(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(Map.of("count",notices.unread(p.userId())));}
    @PutMapping("/{id}/read") public Result<NotificationVO> read(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(notices.read(p.userId(),id));}
}
