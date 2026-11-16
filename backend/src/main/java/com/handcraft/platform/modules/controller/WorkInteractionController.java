package com.handcraft.platform.modules.controller;
import com.handcraft.platform.common.api.Result;
import com.handcraft.platform.modules.dto.WorkCommentDTO;
import com.handcraft.platform.modules.security.AccountPrincipal;
import com.handcraft.platform.modules.service.WorkInteractionService;
import com.handcraft.platform.modules.vo.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
/** 会话身份驱动互动，不接受客户端用户编号。 */
@RestController @RequestMapping("/api")
public class WorkInteractionController {
 private final WorkInteractionService service;
 public WorkInteractionController(WorkInteractionService service){this.service=service;}
 private Long user(AccountPrincipal p){return p==null?null:p.userId();}
 @GetMapping("/works/{id}/interactions") public Result<WorkInteractionStatsVO> stats(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(service.stats(user(p),id));}
 @PutMapping("/me/work-likes/{id}") public Result<WorkReactionStateVO> like(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(service.reaction(user(p),id,"LIKE",true));}
 @DeleteMapping("/me/work-likes/{id}") public ResponseEntity<Void> unlike(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){service.reaction(user(p),id,"LIKE",false);return ResponseEntity.noContent().build();}
 @GetMapping("/me/favorite-works") public Result<PageVO<FavoriteWorkVO>> favorites(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(service.favorites(user(p),page,size));}
 @PutMapping("/me/favorite-works/{id}") public Result<WorkReactionStateVO> favorite(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(service.reaction(user(p),id,"FAVORITE",true));}
 @DeleteMapping("/me/favorite-works/{id}") public ResponseEntity<Void> unfavorite(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){service.reaction(user(p),id,"FAVORITE",false);return ResponseEntity.noContent().build();}
 @GetMapping("/works/{id}/comments") public Result<PageVO<WorkCommentVO>> comments(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(service.comments(user(p),id,page,size));}
 @PostMapping("/works/{id}/comments") public ResponseEntity<Result<WorkCommentVO>> comment(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id,@Valid @RequestBody WorkCommentDTO input){return ResponseEntity.status(201).body(Result.ok(service.comment(user(p),id,input)));}
 @DeleteMapping("/me/work-comments/{id}") public ResponseEntity<Void> deleteComment(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){service.deleteComment(user(p),id);return ResponseEntity.noContent().build();}
 @GetMapping("/me/followed-creators") public Result<PageVO<FollowedCreatorVO>> follows(@AuthenticationPrincipal AccountPrincipal p,@RequestParam(defaultValue="1")int page,@RequestParam(defaultValue="20")int size){return Result.ok(service.follows(user(p),page,size));}
 @GetMapping("/me/followed-creators/{id}") public Result<CreatorFollowStateVO> followState(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(service.followState(user(p),id));}
 @PutMapping("/me/followed-creators/{id}") public Result<CreatorFollowStateVO> follow(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){return Result.ok(service.follow(user(p),id,true));}
 @DeleteMapping("/me/followed-creators/{id}") public ResponseEntity<Void> unfollow(@AuthenticationPrincipal AccountPrincipal p,@PathVariable Long id){service.follow(user(p),id,false);return ResponseEntity.noContent().build();}
}
