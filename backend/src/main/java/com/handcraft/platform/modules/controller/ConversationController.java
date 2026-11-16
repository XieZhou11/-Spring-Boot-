package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.*;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.ConversationService;
import com.handcraft.platform.modules.vo.*;
import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
/** 仅需求与订单双方可沟通，不接受任意接收人编号。 */
@RestController
public class ConversationController {
    private final ConversationService conversations;
    public ConversationController(ConversationService conversations){this.conversations=conversations;}
    @PostMapping("/api/custom-requests/{id}/conversations") public ResponseEntity<Result<ConversationVO>> create(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){var r=conversations.create(p.userId(),id);return ResponseEntity.status(r.created()?201:200).body(Result.ok(r.conversation()));}
    @GetMapping("/api/me/conversations") public Result<PageVO<ConversationVO>> list(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(conversations.list(p.userId(),page,size));}
    @GetMapping("/api/me/conversations/unread-count") public Result<Map<String,Long>> unread(@AuthenticationPrincipal AccountPrincipal p){return Result.ok(Map.of("count",conversations.unread(p.userId())));}
    @GetMapping("/api/conversations/{id}") public Result<ConversationVO> detail(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(conversations.detail(p.userId(),id));}
    @GetMapping("/api/conversations/{id}/messages") public Result<ChatMessagePageVO> messages(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(required=false)Long beforeSeq,@RequestParam(required=false)Long afterSeq,@RequestParam(defaultValue="50")int size){return Result.ok(conversations.messages(p.userId(),id,beforeSeq,afterSeq,size));}
    @PostMapping("/api/conversations/{id}/messages") public ResponseEntity<Result<ChatMessageVO>> send(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ChatMessageDTO input){var r=conversations.send(p.userId(),id,input);return ResponseEntity.status(r.created()?201:200).body(Result.ok(r.message()));}
    @PutMapping("/api/conversations/{id}/read-cursor") public Result<ConversationVO> read(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody ChatReadDTO input){return Result.ok(conversations.read(p.userId(),id,input.getLastReadSeq()));}
}
