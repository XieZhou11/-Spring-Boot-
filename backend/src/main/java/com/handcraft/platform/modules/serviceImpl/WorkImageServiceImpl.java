package com.handcraft.platform.modules.serviceImpl;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.*;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.config.OssProperties;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.exception.WorkImageErrorCode;
import com.handcraft.platform.modules.mapper.*;
import com.handcraft.platform.modules.service.WorkImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** 先短事务预留、事务外上传、再标记可用；历史引用与清理共享用户→文件锁。 */
@Service
public class WorkImageServiceImpl implements WorkImageService {
    private static final Logger LOGGER=LoggerFactory.getLogger(WorkImageServiceImpl.class);
    private static final int MAX_BYTES=5*1024*1024;
    private final UserAccountMapper accounts;
    private final FileAssetMapper files;
    private final WorkMapper works;
    private final OssProperties properties;
    private final ObjectProvider<OSS> clients;
    private final Clock clock;
    private final PrivateImageStorage storage;
    private final TransactionTemplate tx;
    private final Set<Long> active=ConcurrentHashMap.newKeySet();
    public WorkImageServiceImpl(UserAccountMapper accounts,FileAssetMapper files,WorkMapper works,OssProperties properties,ObjectProvider<OSS> clients,Clock clock,PlatformTransactionManager manager,PrivateImageStorage storage){
        this.accounts=accounts;this.files=files;this.works=works;this.properties=properties;this.clients=clients;this.clock=clock;this.storage=storage;
        tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }
    public ImageVO upload(Long userId,MultipartFile input){
        LOGGER.info("作品图片上传开始：userId={}",userId);FileAsset file=null;String stage="校验图片";
        try {
            var image=storage.image(input);stage="检查存储配置";OSS oss=client();
            stage="预留文件";file=tx.execute(s->{var user=accounts.lockById(userId);if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);if(user.isAdmin()||!"APPROVED".equals(user.getCertificationStatus()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅认证创作者可上传作品图片");
                var f=new FileAsset();f.setUploaderId(userId);f.setObjectKey("works/"+userId+"/"+UUID.randomUUID()+image.extension());f.setContentType(image.type());f.setByteSize(image.bytes().length);files.insert(f);return f;});
            active.add(file.getId());stage="上传私有OSS对象";storage.put(file,image);
            FileAsset reserved=file;stage="确认上传结果";tx.executeWithoutResult(s->{accounts.lockById(userId);var current=files.lockById(reserved.getId());if(current==null||!"UPLOADING".equals(current.getUploadStatus()))throw new BusinessException(CommonErrorCode.CONFLICT,"图片状态已变化，请重新上传");files.updateStatus(current.getId(),"AVAILABLE");});
            LOGGER.info("作品图片上传完成：userId={}, fileId={}",userId,file.getId());return signed(file);
        } catch(RuntimeException e) {
            if(e instanceof BusinessException b)LOGGER.warn("作品图片上传失败：stage={}, userId={}, reason={}",stage,userId,b.getMessage());
            else LOGGER.error("作品图片上传异常：stage={}, userId={}",stage,userId,SafeLog.exception(e));
            if(file!=null){FileAsset candidate=file;
                try{Boolean confirmed=tx.execute(s->{accounts.lockById(userId);var current=files.lockById(candidate.getId());if(current!=null&&"AVAILABLE".equals(current.getUploadStatus()))return true;if(current!=null&&"UPLOADING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");return false;});
                    if(Boolean.TRUE.equals(confirmed))return signed(candidate);cleanup(candidate,false);
                }catch(RuntimeException problem){LOGGER.error("作品图片补偿暂未完成：userId={}, fileId={}",userId,file.getId(),SafeLog.exception(problem));}
            }
            if(e instanceof BusinessException b)throw b;throw new BusinessException(WorkImageErrorCode.STORAGE_FAILED);
        }finally{if(file!=null)active.remove(file.getId());}
    }
    public ImageVO view(Long userId,Long fileId){return BusinessLog.run(LOGGER,"作品图片读取",userId,()->{
        var user=accounts.findById(userId);var file=files.findById(fileId);
        if(user==null)throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
        if(file==null||!file.getObjectKey().startsWith("works/")||!"AVAILABLE".equals(file.getUploadStatus())||(!userId.equals(file.getUploaderId())&&works.countPublicImageReferences(fileId)==0&&(!user.isAdmin()||works.countImageReferences(file.getUploaderId(),fileId)==0)))throw new BusinessException(CommonErrorCode.NOT_FOUND);
        return signed(file);
    });}
    /** 清理失败资源和超过24小时的无引用临时图；被历史作品引用的图永远跳过。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void retryFailedUploads(){if(!properties.configured()||clients.getIfAvailable()==null)return;
        try{for(var file:files.findInterruptedWorks())if(!active.contains(file.getId()))cleanup(file,true);}
        catch(RuntimeException e){LOGGER.error("作品图片恢复清理异常：stage=扫描临时资源",SafeLog.exception(e));}
    }
    private void cleanup(FileAsset candidate,boolean checkDue){
        FileAsset cleanup=tx.execute(s->{accounts.lockById(candidate.getUploaderId());var f=files.lockById(candidate.getId());
            if(f==null||"DELETED".equals(f.getUploadStatus())||works.countImageReferences(f.getUploaderId(),f.getId())>0||(checkDue&&!files.applicationCleanupDue(f.getId())))return null;
            if(!"CLEANUP_PENDING".equals(f.getUploadStatus()))files.updateStatus(f.getId(),"CLEANUP_PENDING");return f;});
        if(cleanup==null)return;
        try{client().deleteObject(properties.getBucket(),cleanup.getObjectKey());
            tx.executeWithoutResult(s->{accounts.lockById(cleanup.getUploaderId());var current=files.lockById(cleanup.getId());
                // 至少保留两分钟清理窗口，覆盖请求超时后远端迟到PUT；窗口结束还会再删除一次。
                if(current!=null&&"CLEANUP_PENDING".equals(current.getUploadStatus())&&files.cleanupWindowElapsed(current.getId())&&works.countImageReferences(current.getUploaderId(),current.getId())==0)files.updateStatus(current.getId(),"DELETED");});
            LOGGER.info("作品临时图片清理已执行：userId={}, fileId={}",cleanup.getUploaderId(),cleanup.getId());
        }catch(RuntimeException e){LOGGER.error("作品临时图片清理失败：stage=删除OSS对象，保留重试, fileId={}",cleanup.getId(),SafeLog.exception(e));}
    }
    private OSS client(){return storage.client();}
    private ImageVO signed(FileAsset file){return storage.signed(file);}
}
