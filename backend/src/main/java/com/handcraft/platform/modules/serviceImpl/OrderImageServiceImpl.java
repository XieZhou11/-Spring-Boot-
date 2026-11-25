package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.common.logging.*;
import com.handcraft.platform.modules.entity.*;
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
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** OSS调用在事务外执行；历史绑定和临时回收用相同上传者、文件锁互斥。 */
@Service
public class OrderImageServiceImpl implements OrderImageService {
    private static final Logger LOGGER=LoggerFactory.getLogger(OrderImageServiceImpl.class);
    private final FileAssetMapper files;
    private final OrderImageMapper references;
    private final CustomRequestPolicyService policy;
    private final PrivateImageStorage storage;
    private final TransactionTemplate transaction;
    private final Set<Long> activeUploads=ConcurrentHashMap.newKeySet();

    public OrderImageServiceImpl(FileAssetMapper files,OrderImageMapper references,CustomRequestPolicyService policy,
                                 PrivateImageStorage storage,PlatformTransactionManager manager){
        this.files=files;this.references=references;this.policy=policy;this.storage=storage;
        transaction=new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Override
    public ImageVO upload(Long userId,Long orderId,String purpose,MultipartFile input){
        LOGGER.info("订单私有图片上传开始：userId={}, orderId={}, purpose={}",userId,orderId,purpose);
        FileAsset reserved=null;String stage="校验订单与图片";
        try{
            uploadAllowed(userId,references.order(orderId),purpose);
            var decoded=storage.image(input);storage.client();
            stage="预留文件";
            reserved=transaction.execute(status->{
                lockUpload(userId,orderId,purpose);
                var file=new FileAsset();file.setUploaderId(userId);
                file.setObjectKey(prefix(purpose)+orderId+"/"+userId+"/"+UUID.randomUUID()+decoded.extension());
                file.setContentType(decoded.type());file.setByteSize(decoded.bytes().length);files.insert(file);return file;
            });
            activeUploads.add(reserved.getId());stage="私有OSS上传";storage.put(reserved,decoded);
            stage="确认文件可用";FileAsset uploaded=reserved;
            transaction.executeWithoutResult(status->{
                lockUpload(userId,orderId,purpose);var current=files.lockById(uploaded.getId());
                if(current==null||!"UPLOADING".equals(current.getUploadStatus()))throw conflict("图片上传状态已变化");
                files.updateStatus(current.getId(),"AVAILABLE");
            });
            ImageVO result=storage.signed(reserved);
            LOGGER.info("订单私有图片上传完成：userId={}, orderId={}, purpose={}, fileId={}",userId,orderId,purpose,reserved.getId());return result;
        }catch(RuntimeException exception){
            if(exception instanceof BusinessException business)LOGGER.warn("订单私有图片上传失败：stage={}, userId={}, orderId={}, purpose={}, reason={}",stage,userId,orderId,purpose,business.getMessage());
            else LOGGER.error("订单私有图片上传失败：stage={}, userId={}, orderId={}, purpose={}",stage,userId,orderId,purpose,SafeLog.exception(exception));
            if(reserved!=null){FileAsset failed=reserved;try{
                Boolean confirmed=transaction.execute(status->{
                    policy.lockUsers(userId);var current=files.lockById(failed.getId());
                    if(current!=null&&"AVAILABLE".equals(current.getUploadStatus()))return true;
                    if(current!=null&&"UPLOADING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");
                    return false;
                });
                // 提交结果未知时先回读；已经可用的对象不能因响应失败被补偿删除。
                if(Boolean.TRUE.equals(confirmed)){
                    ImageVO result=storage.signed(failed);LOGGER.info("订单私有图片上传结果回读完成：userId={}, orderId={}, fileId={}",userId,orderId,failed.getId());return result;
                }
                cleanup(failed,false);
            }catch(RuntimeException failure){LOGGER.error("订单私有图片补偿失败：stage=保留清理重试, userId={}, orderId={}, fileId={}",userId,orderId,failed.getId(),SafeLog.exception(failure));}}
            if(exception instanceof BusinessException business)throw business;
            throw new BusinessException(WorkImageErrorCode.STORAGE_FAILED);
        }finally{if(reserved!=null)activeUploads.remove(reserved.getId());}
    }

    @Override
    public ImageVO image(Long userId,Long fileId,String purpose){return BusinessLog.run(LOGGER,"订单私有图片签名读取",userId,()->{
        policy.user(userId);var file=files.findById(fileId);
        if(file==null||!file.getObjectKey().startsWith(prefix(purpose))||!"AVAILABLE".equals(file.getUploadStatus()))throw missing();
        if(!userId.equals(file.getUploaderId())&&!references.readable(userId,fileId))throw missing();
        return storage.signed(file);
    });}

    @Override
    @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
    public ImageVO stockSnapshot(Long userId,Long orderId,Long fileId) {
        return BusinessLog.run(LOGGER,"现货订单快照图片读取",userId,()->{
            var order=references.order(orderId);
            if(order==null||!"STOCK".equals(order.getOrderType())
                    ||(!userId.equals(order.getBuyerId())&&!userId.equals(order.getCreatorId())))throw missing();
            policy.user(userId);
            var file=references.stockSnapshotImage(orderId,fileId);
            if(file==null)throw missing();
            LOGGER.info("现货快照图片引用校验完成：userId={}, orderId={}, fileId={}",userId,orderId,fileId);
            return storage.signed(file);
        });
    }

    @Override
    @Transactional(propagation=Propagation.MANDATORY,rollbackFor=Exception.class)
    public void validate(Long userId,Long orderId,String purpose,List<String> imageIds){
        BusinessLog.run(LOGGER,"订单图片绑定校验",userId,()->{
            String expected=prefix(purpose)+orderId+"/"+userId+"/";
            int limit="PROGRESS".equals(purpose)?6:3;
            if(imageIds==null||imageIds.size()>limit||new HashSet<>(imageIds).size()!=imageIds.size())throw invalid("图片数量超限或包含重复图片");
            imageIds.stream().map(OrderImageServiceImpl::number).sorted().forEach(id->{
                var file=files.lockById(id);
                if(file==null||!userId.equals(file.getUploaderId())||!file.getObjectKey().startsWith(expected)
                        ||!"AVAILABLE".equals(file.getUploadStatus()))throw invalid("图片须为本人在当前订单上传的对应用途可用图片");
            });
            LOGGER.info("订单图片归属与状态校验完成：userId={}, orderId={}, purpose={}, count={}",userId,orderId,purpose,imageIds.size());return null;
        });
    }

    /** 仅回收超过保留期且没有任何历史记录引用的临时图；单文件失败不阻塞后续候选。 */
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void cleanupUnused(){
        try{for(var file:references.cleanupCandidates()){
            if(activeUploads.contains(file.getId()))continue;
            try{cleanup(file,true);}catch(RuntimeException exception){LOGGER.error("订单临时图片清理失败：stage=单文件补偿, userId={}, fileId={}",file.getUploaderId(),file.getId(),SafeLog.exception(exception));}
        }}catch(RuntimeException exception){LOGGER.error("订单临时图片清理失败：stage=扫描",SafeLog.exception(exception));}
    }

    private void cleanup(FileAsset candidate,boolean checkDue){
        var file=transaction.execute(status->{
            policy.lockUsers(candidate.getUploaderId());var current=files.lockById(candidate.getId());
            if(current==null||"DELETED".equals(current.getUploadStatus())||references.referenced(current.getId())
                    ||checkDue&&!files.applicationCleanupDue(current.getId()))return null;
            if(!"CLEANUP_PENDING".equals(current.getUploadStatus()))files.updateStatus(current.getId(),"CLEANUP_PENDING");return current;
        });
        if(file==null)return;storage.delete(file);
        transaction.executeWithoutResult(status->{
            policy.lockUsers(file.getUploaderId());var current=files.lockById(file.getId());
            if(current!=null&&"CLEANUP_PENDING".equals(current.getUploadStatus())&&files.cleanupWindowElapsed(current.getId())&&!references.referenced(current.getId()))files.updateStatus(current.getId(),"DELETED");
        });
        LOGGER.info("订单临时图片清理完成：userId={}, fileId={}",file.getUploaderId(),file.getId());
    }

    private void lockUpload(Long userId,Long orderId,String purpose){
        var initial=references.order(orderId);uploadAllowed(userId,initial,purpose);
        policy.lockUsers(initial.getBuyerId(),initial.getCreatorId());
        if(initial.getRequestId()!=null)references.lockRequest(initial.getRequestId());
        uploadAllowed(userId,references.lockOrder(orderId),purpose);
    }

    private void uploadAllowed(Long userId,TradeOrder order,String purpose){
        prefix(purpose);policy.user(userId);
        if(!OrdinaryRefundPolicy.supports(order)||!userId.equals(order.getBuyerId())&&!userId.equals(order.getCreatorId()))throw missing();
        if("PROGRESS".equals(purpose)){
            if(!"CUSTOM".equals(order.getOrderType()))throw missing();
            if(!userId.equals(order.getCreatorId()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅本单创作者可上传制作进度图片");
            if(!Set.of("IN_PRODUCTION","PENDING_SHIP","SHIPPED").contains(order.getStatus()))throw conflict("当前订单阶段不可上传制作进度图片");
        }else{
            if("AFTER_SALE".equals(order.getStatus())&&references.normalRefundPending(order.getId()))return;
            if(!userId.equals(order.getBuyerId()))throw new BusinessException(CommonErrorCode.FORBIDDEN,"仅买家可上传初次退款凭证；双方可在处理中补证");
            if(!OrdinaryRefundPolicy.eligible(order,policy.now()))throw conflict("当前订单不在可申请普通售后的阶段或原七天窗口");
        }
    }
    private static String prefix(String purpose){return switch(purpose){case "PROGRESS"->"order-progress/";case "REFUND"->"order-refunds/";default->throw invalid("订单图片用途无效");};}
    private static Long number(String value){try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw invalid("图片编号无效");}
    private static BusinessException invalid(String message){return new BusinessException(CommonErrorCode.INVALID_REQUEST,message);}
    private static BusinessException conflict(String message){return new BusinessException(CommonErrorCode.CONFLICT,message);}
    private static BusinessException missing(){return new BusinessException(CommonErrorCode.NOT_FOUND);}
}
