package com.handcraft.platform.modules.serviceImpl;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.exception.WorkImageErrorCode;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.*;
import com.handcraft.platform.modules.vo.ImageVO;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
/** 复用字节解码/OSS协议；短事务预留和补偿、关系鉴权与历史引用保留在本业务内。 */
@Service
public class CustomRequestImageServiceImpl implements CustomRequestImageService {
    private static final Logger LOGGER=LoggerFactory.getLogger(CustomRequestImageServiceImpl.class);
    private final FileAssetMapper files;private final CustomRequestMapper requests;private final ConversationMapper conversations;private final CustomRequestPolicyService policy;private final ConversationService chat;private final PrivateImageStorage storage;private final TransactionTemplate tx;private final Set<Long> active=ConcurrentHashMap.newKeySet();
    public CustomRequestImageServiceImpl(FileAssetMapper files,CustomRequestMapper requests,ConversationMapper conversations,CustomRequestPolicyService policy,ConversationService chat,PrivateImageStorage storage,PlatformTransactionManager manager){this.files=files;this.requests=requests;this.conversations=conversations;this.policy=policy;this.chat=chat;this.storage=storage;tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);}
    public ImageVO uploadRequest(Long userId,MultipartFile file){return upload(userId,null,file);}
    public ImageVO uploadConversation(Long userId,Long conversationId,MultipartFile file){return upload(userId,conversationId,file);}
    private ImageVO upload(Long userId,Long conversationId,MultipartFile input){LOGGER.info("需求沟通图片上传开始：userId={}, conversationId={}",userId,conversationId);FileAsset f=null;String stage="校验图片";try{
        var image=storage.image(input);storage.client();stage="预留文件";f=tx.execute(s->{policy.lockUsers(userId);policy.user(userId);if(conversationId!=null)writable(userId,conversationId);var file=new FileAsset();file.setUploaderId(userId);file.setObjectKey((conversationId==null?"custom-requests/"+userId:"conversations/"+conversationId+"/"+userId)+"/"+UUID.randomUUID()+image.extension());file.setContentType(image.type());file.setByteSize(image.bytes().length);files.insert(file);return file;});active.add(f.getId());stage="私有OSS上传";storage.put(f,image);FileAsset reserved=f;stage="确认可用状态";tx.executeWithoutResult(s->{policy.lockUsers(userId);if(conversationId!=null)writable(userId,conversationId);var current=files.lockById(reserved.getId());if(current==null||!"UPLOADING".equals(current.getUploadStatus()))throw new BusinessException(CommonErrorCode.CONFLICT,"图片上传状态已变化");files.updateStatus(current.getId(),"AVAILABLE");});LOGGER.info("需求沟通图片上传完成：userId={}, fileId={}, conversationId={}",userId,f.getId(),conversationId);return storage.signed(f);
    }catch(RuntimeException e){if(e instanceof BusinessException b)LOGGER.warn("需求沟通图片上传失败：stage={}, userId={}, conversationId={}, reason={}",stage,userId,conversationId,b.getMessage());else LOGGER.error("需求沟通图片上传失败：stage={}, userId={}, conversationId={}",stage,userId,conversationId,SafeLog.exception(e));if(f!=null){var reserved=f;try{Boolean confirmed=tx.execute(s->{policy.lockUsers(userId);var current=files.lockById(reserved.getId());if(current!=null&&"AVAILABLE".equals(current.getUploadStatus()))return true;if(current!=null&&"UPLOADING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");return false;});if(Boolean.TRUE.equals(confirmed))return storage.signed(reserved);cleanup(reserved,false);}catch(RuntimeException failure){LOGGER.error("需求沟通图片补偿失败：stage=保留重试, fileId={}",f.getId(),SafeLog.exception(failure));}}if(e instanceof BusinessException b)throw b;throw new BusinessException(WorkImageErrorCode.STORAGE_FAILED);
    }finally{if(f!=null)active.remove(f.getId());}}
    public ImageVO requestImage(Long userId,Long fileId){return BusinessLog.run(LOGGER,"需求参考图签名读取",userId,()->{policy.user(userId);var f=available(fileId,"custom-requests/");if(!userId.equals(f.getUploaderId())){boolean allowed=false;for(var r:requests.imageRequests(fileId))try{policy.visible(userId,r,false);allowed=true;break;}catch(BusinessException denied){if(denied.getErrorCode()!=CommonErrorCode.NOT_FOUND)throw denied;}if(!allowed)throw missing();}return storage.signed(f);});}
    public ImageVO conversationImage(Long userId,Long fileId){return BusinessLog.run(LOGGER,"会话图片签名读取",userId,()->{policy.user(userId);var f=available(fileId,"conversations/");Long id;try{id=Long.valueOf(f.getObjectKey().split("/")[1]);}catch(RuntimeException e){throw missing();}var c=conversations.find(id);if(c==null||!userId.equals(c.getBuyerId())&&!userId.equals(c.getCreatorId()))throw missing();
        // 临时图片仅上传者可预览；发送后按本会话历史消息授权，归档后仍可读取。
        if(!userId.equals(f.getUploaderId())&&conversations.conversationImageReferences(id,fileId)==0)throw missing();return storage.signed(f);});}
    private void writable(Long userId,Long id){var initial=conversations.find(id);if(initial==null)throw missing();if(initial.getRequestId()!=null)requests.lock(initial.getRequestId());conversations.lock(id);if(!chat.detail(userId,id).canSend())throw new BusinessException(CommonErrorCode.CONFLICT,"会话已归档，不能上传新图片");}
    private FileAsset available(Long id,String prefix){var f=files.findById(id);if(f==null||!f.getObjectKey().startsWith(prefix)||!"AVAILABLE".equals(f.getUploadStatus()))throw missing();return f;}
    /** 无当前或历史引用的临时图片才允许清理；历史消息图片永久跳过。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void cleanupUnused(){try{for(var f:files.findInterruptedRequests())if(!active.contains(f.getId()))cleanup(f,true);}catch(RuntimeException e){LOGGER.error("需求沟通图片清理失败：stage=扫描或清理",SafeLog.exception(e));}}
    private boolean referenced(FileAsset f){return requests.imageReferences(f.getUploaderId(),f.getId())>0||conversations.imageReferences(f.getId())>0;}
    private void cleanup(FileAsset candidate,boolean checkDue){var f=tx.execute(s->{policy.lockUsers(candidate.getUploaderId());var current=files.lockById(candidate.getId());if(current==null||"DELETED".equals(current.getUploadStatus())||referenced(current)||checkDue&&!files.applicationCleanupDue(current.getId()))return null;if(!"CLEANUP_PENDING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");return current;});if(f==null)return;storage.delete(f);tx.executeWithoutResult(s->{policy.lockUsers(f.getUploaderId());var current=files.lockById(f.getId());if(current!=null&&"CLEANUP_PENDING".equals(current.getUploadStatus())&&files.cleanupWindowElapsed(f.getId())&&!referenced(current))files.updateStatus(f.getId(),"DELETED");});LOGGER.info("需求沟通临时图片已清理：userId={}, fileId={}",f.getUploaderId(),f.getId());}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
