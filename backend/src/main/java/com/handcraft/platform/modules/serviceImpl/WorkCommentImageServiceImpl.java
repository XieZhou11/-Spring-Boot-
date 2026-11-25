package com.handcraft.platform.modules.serviceImpl;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.*;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.config.OssProperties;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.exception.CommentImageErrorCode;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.WorkCommentImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.imageio.ImageIO;
import org.slf4j.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** 先短事务预留、事务外上传、再标记可用；历史引用与清理共享用户→文件锁。 */
@Service
public class WorkCommentImageServiceImpl implements WorkCommentImageService {
    private static final Logger LOGGER=LoggerFactory.getLogger(WorkCommentImageServiceImpl.class);
    private static final int MAX_BYTES=5*1024*1024;
    private final UserAccountMapper accounts;
    private final FileAssetMapper files;
    private final CommentImageMapper comments;
    private final OrderReviewMapper reviewImages;
    private final ContentReportMapper reportImages;
    private final OssProperties properties;
    private final ObjectProvider<OSS> clients;
    private final Clock clock;
    private final TransactionTemplate tx;
    private final Set<Long> active=ConcurrentHashMap.newKeySet();
    public WorkCommentImageServiceImpl(UserAccountMapper accounts,FileAssetMapper files,CommentImageMapper comments,OrderReviewMapper reviewImages,ContentReportMapper reportImages,OssProperties properties,ObjectProvider<OSS> clients,Clock clock,PlatformTransactionManager manager){
        this.accounts=accounts;this.files=files;this.comments=comments;this.reviewImages=reviewImages;this.reportImages=reportImages;this.properties=properties;this.clients=clients;this.clock=clock;
        tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }
    public ImageVO upload(Long userId,MultipartFile input){
        LOGGER.info("评论图片上传开始：userId={}",userId);FileAsset file=null;String stage="校验图片";
        try {
            Image image=image(input);stage="检查存储配置";OSS oss=client();
            stage="预留文件";file=tx.execute(s->{var user=accounts.lockById(userId);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(user.isAdmin())throw new BusinessException(CommonErrorCode.FORBIDDEN,"管理员不能上传评论图片");
                var f=new FileAsset();f.setUploaderId(userId);f.setObjectKey("work-comments/"+userId+"/"+UUID.randomUUID()+image.extension);f.setContentType(image.type);f.setByteSize(image.bytes.length);files.insert(f);return f;});
            active.add(file.getId());stage="上传私有OSS对象";var metadata=new ObjectMetadata();metadata.setContentType(image.type);metadata.setContentLength(image.bytes.length);metadata.setObjectAcl(CannedAccessControlList.Private);metadata.setCacheControl("private, max-age=300");
            oss.putObject(properties.getBucket(),file.getObjectKey(),new ByteArrayInputStream(image.bytes),metadata);
            FileAsset reserved=file;stage="确认上传结果";tx.executeWithoutResult(s->{accounts.lockById(userId);var current=files.lockById(reserved.getId());if(current==null||!"UPLOADING".equals(current.getUploadStatus()))throw new BusinessException(CommonErrorCode.CONFLICT,"图片状态已变化，请重新上传");files.updateStatus(current.getId(),"AVAILABLE");});
            LOGGER.info("评论图片上传完成：userId={}, fileId={}",userId,file.getId());return signed(file);
        } catch(RuntimeException e) {
            if(e instanceof BusinessException b)LOGGER.warn("评论图片上传失败：stage={}, userId={}, reason={}",stage,userId,b.getMessage());
            else LOGGER.error("评论图片上传异常：stage={}, userId={}",stage,userId,SafeLog.exception(e));
            if(file!=null){FileAsset candidate=file;
                try{Boolean confirmed=tx.execute(s->{accounts.lockById(userId);var current=files.lockById(candidate.getId());if(current!=null&&"AVAILABLE".equals(current.getUploadStatus()))return true;if(current!=null&&"UPLOADING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");return false;});
                    if(Boolean.TRUE.equals(confirmed))return signed(candidate);cleanup(candidate,false);
                }catch(RuntimeException problem){LOGGER.error("评论图片补偿暂未完成：userId={}, fileId={}",userId,file.getId(),SafeLog.exception(problem));}
            }
            if(e instanceof BusinessException b)throw b;throw new BusinessException(CommentImageErrorCode.STORAGE_FAILED);
        }finally{if(file!=null)active.remove(file.getId());}
    }
    public ImageVO view(Long userId,Long fileId){return BusinessLog.run(LOGGER,"评论图片读取",userId,()->{
        var user=accounts.findById(userId);var file=files.findById(fileId);
        if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        if(file==null||!file.getObjectKey().startsWith("work-comments/")||!"AVAILABLE".equals(file.getUploadStatus())||(!userId.equals(file.getUploaderId())&&comments.publicReferences(fileId)==0))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return signed(file);
    });}
    public ImageVO viewReview(Long userId,Long fileId){return BusinessLog.run(LOGGER,"评价图片读取",userId,()->{
        var user=accounts.findById(userId);var file=files.findById(fileId);
        if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        boolean related=file!=null&&(reviewImages.canReadReviewImage(userId,fileId,user.isAdmin())>0||reviewImages.canReadReportImage(userId,fileId,user.isAdmin())>0);
        if(file==null||!file.getObjectKey().startsWith("work-comments/")||!"AVAILABLE".equals(file.getUploadStatus())||(!userId.equals(file.getUploaderId())&&comments.publicReferences(fileId)==0&&!related))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return signed(file);
    });}
    @Override
    public ImageVO viewReportedComment(Long userId,Long reportId,Long fileId){return BusinessLog.run(LOGGER,"原评论证据读取",userId,()->{
        var user=accounts.findById(userId);
        var file=files.findById(fileId);
        if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        if(!user.isAdmin()||file==null||!file.getObjectKey().startsWith("work-comments/")||!"AVAILABLE".equals(file.getUploadStatus())
                ||reportImages.originalCommentImage(reportId,fileId)==0)throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return signed(file);
    });}
    /** 全类型内容举报证据：按举报人、被处理人及管理员关系核验。 */
    public ImageVO viewReport(Long userId,Long fileId){return BusinessLog.run(LOGGER,"举报证据图片读取",userId,()->{
        var user=accounts.findById(userId);var file=files.findById(fileId);
        if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        boolean related=file!=null&&(reportImages.canReadReportImage(userId,fileId,user.isAdmin())>0);
        if(file==null||!file.getObjectKey().startsWith("work-comments/")||!"AVAILABLE".equals(file.getUploadStatus())||(!userId.equals(file.getUploaderId())&&comments.publicReferences(fileId)==0&&!related))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return signed(file);
    });}
    /** 清理失败资源和超过24小时的无引用临时图；被历史评论引用的图永远跳过。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void retryFailedUploads(){if(!properties.configured()||clients.getIfAvailable()==null)return;
        try{for(var file:comments.cleanupCandidates())if(!active.contains(file.getId()))cleanup(file,true);}
        catch(RuntimeException e){LOGGER.error("评论图片恢复清理异常：stage=扫描临时资源",SafeLog.exception(e));}
    }
    private void cleanup(FileAsset candidate,boolean checkDue){
        FileAsset cleanup=tx.execute(s->{accounts.lockById(candidate.getUploaderId());var f=files.lockById(candidate.getId());
            if(f==null||"DELETED".equals(f.getUploadStatus())||comments.references(f.getId())>0||(checkDue&&!files.applicationCleanupDue(f.getId())))return null;
            if(!"CLEANUP_PENDING".equals(f.getUploadStatus()))files.updateStatus(f.getId(),"CLEANUP_PENDING");return f;});
        if(cleanup==null)return;
        try{client().deleteObject(properties.getBucket(),cleanup.getObjectKey());
            tx.executeWithoutResult(s->{accounts.lockById(cleanup.getUploaderId());var current=files.lockById(cleanup.getId());
                // 至少保留两分钟清理窗口，覆盖请求超时后远端迟到PUT；窗口结束还会再删除一次。
                if(current!=null&&"CLEANUP_PENDING".equals(current.getUploadStatus())&&files.cleanupWindowElapsed(current.getId())&&comments.references(current.getId())==0)files.updateStatus(current.getId(),"DELETED");});
            LOGGER.info("评论临时图片清理已执行：userId={}, fileId={}",cleanup.getUploaderId(),cleanup.getId());
        }catch(RuntimeException e){LOGGER.error("评论临时图片清理失败：stage=删除OSS对象，保留重试, fileId={}",cleanup.getId(),SafeLog.exception(e));}
    }
    private OSS client(){OSS client=properties.configured()?clients.getIfAvailable():null;if(client==null)throw new BusinessException(CommentImageErrorCode.STORAGE_UNAVAILABLE);return client;}
    private ImageVO signed(FileAsset file){try{OffsetDateTime expires=OffsetDateTime.now(clock).plusMinutes(15);return new ImageVO(file.getId().toString(),client().generatePresignedUrl(properties.getBucket(),file.getObjectKey(),Date.from(expires.toInstant())).toExternalForm(),expires);}catch(BusinessException e){throw e;}catch(RuntimeException e){throw new BusinessException(CommentImageErrorCode.STORAGE_UNAVAILABLE);}}
    private Image image(MultipartFile input){
        if(input==null||input.isEmpty())throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);
        if(input.getSize()>MAX_BYTES)throw new BusinessException(CommentImageErrorCode.IMAGE_TOO_LARGE);
        try(var source=input.getInputStream()){
            byte[] bytes=source.readNBytes(MAX_BYTES+1);if(bytes.length>MAX_BYTES)throw new BusinessException(CommentImageErrorCode.IMAGE_TOO_LARGE);
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
                var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);
                var reader=readers.next();try{reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                    if(!Set.of("png","jpeg","webp").contains(format))throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);
                    long width=reader.getWidth(0),height=reader.getHeight(0);
                    // 限制解码内存，避免压缩率极高的图片耗尽JVM，不按文件名或客户端MIME判型。
                    if(width<=0||height<=0||width*height>40_000_000)throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);
                    AtomicBoolean warning=new AtomicBoolean();reader.addIIOReadWarningListener((r,w)->warning.set(true));
                    if(reader.read(0)==null||warning.get())throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);
                    return new Image(bytes,"image/"+format,format.equals("jpeg")?".jpg":"."+format);
                }finally{reader.dispose();}
            }
        }catch(IOException e){throw new BusinessException(CommentImageErrorCode.INVALID_IMAGE);}
    }
    private record Image(byte[] bytes,String type,String extension){}
}
