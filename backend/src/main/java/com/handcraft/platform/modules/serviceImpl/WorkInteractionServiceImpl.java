package com.handcraft.platform.modules.serviceImpl;
import com.aliyun.oss.OSS;
import com.handcraft.platform.common.content.PlainTextPolicy;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.config.OssProperties;
import com.handcraft.platform.modules.dto.WorkCommentDTO;
import com.handcraft.platform.modules.entity.*;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.*;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import org.slf4j.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
/** 关系由用户行锁串行化；评论绑定按用户→作品→文件编号顺序加锁。 */
@Service
public class WorkInteractionServiceImpl implements WorkInteractionService {
 private static final Logger LOG=LoggerFactory.getLogger(WorkInteractionServiceImpl.class);
 // 拦截脚本载荷、明显辱骂与带联系方式的站外引流，正常讨论不按敏感单字拒绝。
 private static final Pattern BLOCKED=Pattern.compile("(?is)<\\s*(script|iframe|object|embed)\\b|javascript\\s*:|on(?:error|load|click)\\s*=|傻[逼屄]|操你妈|去死|(?:加|联系|私加).{0,10}(?:微信|微.?信|QQ|qq|vx|VX)|https?://|www\\.");
 private final WorkInteractionMapper mapper; private final UserAccountMapper accounts; private final FileAssetMapper files;
 private final AvatarService avatars; private final WorkCommentImageService images; private final ObjectMapper json;
 private final OssProperties ossProperties; private final ObjectProvider<OSS> oss; private final Clock clock;
 public WorkInteractionServiceImpl(WorkInteractionMapper mapper,UserAccountMapper accounts,FileAssetMapper files,AvatarService avatars,WorkCommentImageService images,ObjectMapper json,OssProperties ossProperties,ObjectProvider<OSS> oss,Clock clock){this.mapper=mapper;this.accounts=accounts;this.files=files;this.avatars=avatars;this.images=images;this.json=json;this.ossProperties=ossProperties;this.oss=oss;this.clock=clock;}
 private <T>T logged(String name,Long user,Supplier<T> action){return BusinessLog.run(LOG,name,user,action);}
 private void page(int page,int size){if(page<1||page>1_000_000||size<1||size>50)throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"分页参数无效");}
 private UserAccount account(Long id,boolean locked){if(id==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);var a=locked?accounts.lockById(id):accounts.findById(id);if(a==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);return a;}
 private void writable(UserAccount a){if(a.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"管理员不能参与互动");}
 private boolean available(InteractionWork w){return w!=null&&w.getDeletedAt()==null&&"ONLINE".equals(w.getReviewStatus());}
 private InteractionWork publicWork(Long id,boolean locked){var w=locked?mapper.lockWork(id):mapper.work(id);if(!available(w))throw new BusinessException(CommonErrorCode.NOT_FOUND,"作品不存在或已下架");return w;}
 private WorkInteractionStatsVO counts(Long u,Long w){return new WorkInteractionStatsVO(mapper.reactionCount(w,"LIKE"),mapper.reactionCount(w,"FAVORITE"),mapper.commentCount(w),u!=null&&mapper.reaction(u,w,"LIKE")>0,u!=null&&mapper.reaction(u,w,"FAVORITE")>0);}
 @Override public WorkInteractionStatsVO stats(Long userId,Long workId){return logged("作品互动统计",userId,()->{account(userId,false);publicWork(workId,false);return counts(userId,workId);});}
 @Override @Transactional(rollbackFor=Exception.class)
 public WorkReactionStateVO reaction(Long userId,Long workId,String type,boolean add){return logged(add?"添加作品关系":"取消作品关系",userId,()->{
  if(!Set.of("LIKE","FAVORITE").contains(type))throw new BusinessException(CommonErrorCode.INVALID_REQUEST);
  writable(account(userId,true));if(add)publicWork(workId,true);else mapper.lockWork(workId);
  LOG.info("作品关系校验完成：userId={}, workId={}, type={}, add={}",userId,workId,type,add);
  if(add)mapper.addReaction(userId,workId,type);else mapper.deleteReaction(userId,workId,type);
  return new WorkReactionStateVO(add);
 });}
 @Override public PageVO<FavoriteWorkVO> favorites(Long userId,int page,int size){return logged("本人收藏查询",userId,()->{account(userId,false);page(page,size);var list=mapper.favorites(userId,(page-1)*size,size).stream().map(r->{Long id=((Number)r.get("work_id")).longValue();var w=mapper.work(id);var at=time((LocalDateTime)r.get("created_at"));if(!available(w))return new FavoriteWorkVO(id.toString(),false,null,null,null,null,at);var a=accounts.findById(w.getCreatorId());var ids=ids(w.getMainImageIds());return new FavoriteWorkVO(id.toString(),true,w.getTitle(),w.getCreatorId().toString(),a==null?null:a.getNickname(),ids.isEmpty()?null:cover(w,Long.valueOf(ids.getFirst())),at);}).toList();return new PageVO<>(list,mapper.favoritesCount(userId),page,size);});}
 @Override public PageVO<WorkCommentVO> comments(Long userId,Long workId,int page,int size){return logged("作品评论查询",userId,()->{account(userId,false);page(page,size);publicWork(workId,false);return new PageVO<>(mapper.comments(workId,(page-1)*size,size).stream().map(c->view(userId,c)).toList(),mapper.commentCount(workId),page,size);});}
 @Override @Transactional(rollbackFor=Exception.class)
 public WorkCommentVO comment(Long userId,Long workId,WorkCommentDTO input){return logged("发表作品评论",userId,()->{
  writable(account(userId,true));publicWork(workId,true);
  // Java String按UTF-16存储，补充平面字符占两个单元；业务字数统一按Unicode码点计算。
  String content=input.getContent()==null?"":input.getContent().strip();int length=content.codePointCount(0,content.length());
  if(length<10||length>500)throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"评论须为10至500字");
  // 统一站内文本治理，同时保留评论既有的独有拦截词，避免集成后放宽规则。
  if(!PlainTextPolicy.safe(content)||BLOCKED.matcher(content).find())throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"评论包含违规内容，请修改后提交");
  List<String> ids=input.getImageIds()==null?List.of():input.getImageIds();
  if(ids.size()>3||new HashSet<>(ids).size()!=ids.size())throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"评论最多三张且不能重复");
  List<Long> sorted=new ArrayList<>();for(String id:ids){try{if(id==null||!id.matches("[1-9][0-9]{0,18}"))throw new NumberFormatException();sorted.add(Long.valueOf(id));}catch(NumberFormatException e){throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"评论图片编号无效");}}
  sorted.sort(Long::compareTo);for(Long id:sorted){var f=files.lockById(id);if(f==null||!userId.equals(f.getUploaderId())||!"AVAILABLE".equals(f.getUploadStatus())||!f.getObjectKey().startsWith("work-comments/"))throw new BusinessException(CommonErrorCode.INVALID_REQUEST,"评论图片不可用");}
  LOG.info("评论文本及图片校验完成：userId={}, workId={}, imageCount={}",userId,workId,ids.size());
  var c=new InteractionComment();c.setWorkId(workId);c.setAuthorId(userId);c.setContent(content);c.setImageIds(json.writeValueAsString(ids));mapper.addComment(c);return view(userId,mapper.comment(c.getId()));
 });}
 @Override @Transactional(rollbackFor=Exception.class)
 public void deleteComment(Long userId,Long commentId){logged("删除本人评论",userId,()->{writable(account(userId,true));var c=mapper.comment(commentId);if(c==null||!userId.equals(c.getAuthorId()))throw new BusinessException(CommonErrorCode.NOT_FOUND);mapper.lockWork(c.getWorkId());mapper.deleteComment(userId,commentId);LOG.info("本人评论已标记删除：userId={}, commentId={}",userId,commentId);return null;});}
 @Override public CreatorFollowStateVO followState(Long userId,Long creatorId){return logged("关注状态查询",userId,()->{account(userId,false);return new CreatorFollowStateVO(mapper.following(userId,creatorId)>0);});}
 @Override @Transactional(rollbackFor=Exception.class)
 public CreatorFollowStateVO follow(Long userId,Long creatorId,boolean add){return logged(add?"关注创作者":"取消关注",userId,()->{
  // 交叉关注按编号排序锁定双方，允许认证创作者关注本人。
  UserAccount me,target;if(userId<=creatorId){me=account(userId,true);target=userId.equals(creatorId)?me:accounts.lockById(creatorId);}else{target=accounts.lockById(creatorId);me=account(userId,true);}writable(me);
  if(add&&(target==null||target.isAdmin()||!"APPROVED".equals(target.getCertificationStatus())))throw new BusinessException(CommonErrorCode.NOT_FOUND,"创作者不存在或认证失效");
  LOG.info("关注资格校验完成：userId={}, creatorId={}, add={}",userId,creatorId,add);
  if(add)mapper.addFollow(userId,creatorId);else mapper.deleteFollow(userId,creatorId);return new CreatorFollowStateVO(add);
 });}
 @Override public PageVO<FollowedCreatorVO> follows(Long userId,int page,int size){return logged("本人关注查询",userId,()->{account(userId,false);page(page,size);var list=mapper.follows(userId,(page-1)*size,size).stream().map(r->{Long id=((Number)r.get("creator_id")).longValue();var a=accounts.findById(id);boolean valid=a!=null&&!a.isAdmin()&&"APPROVED".equals(a.getCertificationStatus());var av=valid?avatars.view(id,a.getAvatarFileId()):null;return new FollowedCreatorVO(id.toString(),valid?a.getNickname():null,valid?a.getBio():null,av==null?null:av.url(),av==null?null:av.expiresAt(),valid&&(a.isCreatorPaused()||a.isAdminBusinessPaused()),valid,time((LocalDateTime)r.get("created_at")));}).toList();return new PageVO<>(list,mapper.followsCount(userId),page,size);});}
 private WorkCommentVO view(Long userId,InteractionComment c){var a=accounts.findById(c.getAuthorId());var avatar=a==null?null:avatars.view(a.getId(),a.getAvatarFileId());var ids=ids(c.getImageIds());var pics=ids.stream().map(id->images.view(userId,Long.valueOf(id))).filter(Objects::nonNull).toList();return new WorkCommentVO(c.getId().toString(),c.getWorkId().toString(),c.getAuthorId().toString(),a==null?null:a.getNickname(),avatar==null?null:avatar.url(),avatar==null?null:avatar.expiresAt(),c.getContent(),ids,pics,time(c.getCreatedAt()),Objects.equals(userId,c.getAuthorId()));}
 private List<String> ids(String value){return value==null?List.of():json.readValue(value,new TypeReference<List<String>>(){});}
 private static OffsetDateTime time(LocalDateTime value){return value==null?null:value.atZone(ZoneId.of("Asia/Shanghai")).toOffsetDateTime();}
 /** 仅为已确认公开作品的实际主图生成签名，绝不提供通用文件签名接口。 */
 private ImageVO cover(InteractionWork w,Long id){if(!ossProperties.configured())return null;var client=oss.getIfAvailable();if(client==null)return null;var f=files.findById(id);if(f==null||!w.getCreatorId().equals(f.getUploaderId())||!"AVAILABLE".equals(f.getUploadStatus())||!f.getObjectKey().startsWith("works/"))return null;try{var expires=OffsetDateTime.now(clock).plusMinutes(15);return new ImageVO(id.toString(),client.generatePresignedUrl(ossProperties.getBucket(),f.getObjectKey(),Date.from(expires.toInstant())).toExternalForm(),expires);}catch(RuntimeException e){LOG.error("收藏封面签名失败：stage=生成签名, workId={}, fileId={}",w.getId(),id,SafeLog.exception(e));return null;}}
}
