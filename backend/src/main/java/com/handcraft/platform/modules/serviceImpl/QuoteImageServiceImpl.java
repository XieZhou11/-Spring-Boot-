package com.handcraft.platform.modules.serviceImpl;

import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.BusinessLog;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.exception.WorkImageErrorCode;
import com.handcraft.platform.modules.mapper.FileAssetMapper;
import com.handcraft.platform.modules.mapper.QuoteImageMapper;
import com.handcraft.platform.modules.service.CustomRequestPolicyService;
import com.handcraft.platform.modules.service.QuoteImageService;
import com.handcraft.platform.modules.vo.ImageVO;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** 短事务预留文件，OSS请求在事务外执行；引用绑定和清理共享用户→文件锁序。 */
@Service
public class QuoteImageServiceImpl implements QuoteImageService {
    private static final Logger LOGGER = LoggerFactory.getLogger(QuoteImageServiceImpl.class);
    private final FileAssetMapper files;
    private final QuoteImageMapper references;
    private final CustomRequestPolicyService policy;
    private final PrivateImageStorage storage;
    private final TransactionTemplate transaction;
    private final Set<Long> activeUploads = ConcurrentHashMap.newKeySet();

    public QuoteImageServiceImpl(FileAssetMapper files, QuoteImageMapper references,
                                CustomRequestPolicyService policy, PrivateImageStorage storage,
                                PlatformTransactionManager manager) {
        this.files = files;
        this.references = references;
        this.policy = policy;
        this.storage = storage;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    @Override
    public ImageVO upload(Long userId, MultipartFile input) {
        LOGGER.info("报价图片上传开始：userId={}", userId);
        FileAsset reserved = null;
        String stage = "校验资格与图片";
        try {
            qualified(userId);
            var decoded = storage.image(input);
            storage.client();
            stage = "预留文件";
            reserved = transaction.execute(status -> {
                policy.lockUsers(userId);
                qualified(userId);
                var file = new FileAsset();
                file.setUploaderId(userId);
                file.setObjectKey("quotes/" + userId + "/" + UUID.randomUUID() + decoded.extension());
                file.setContentType(decoded.type());
                file.setByteSize(decoded.bytes().length);
                files.insert(file);
                return file;
            });
            activeUploads.add(reserved.getId());
            stage = "私有OSS上传";
            storage.put(reserved, decoded);
            stage = "确认文件可用";
            FileAsset uploaded = reserved;
            transaction.executeWithoutResult(status -> {
                policy.lockUsers(userId);
                qualified(userId);
                var current = files.lockById(uploaded.getId());
                if (current == null || !"UPLOADING".equals(current.getUploadStatus())) {
                    throw new BusinessException(CommonErrorCode.CONFLICT, "图片上传状态已变化");
                }
                files.updateStatus(current.getId(), "AVAILABLE");
            });
            ImageVO result = storage.signed(reserved);
            LOGGER.info("报价图片上传完成：userId={}, fileId={}", userId, reserved.getId());
            return result;
        } catch (RuntimeException exception) {
            if (exception instanceof BusinessException business) {
                LOGGER.warn("报价图片上传失败：stage={}, userId={}, reason={}", stage, userId, business.getMessage());
            } else {
                LOGGER.error("报价图片上传失败：stage={}, userId={}", stage, userId, SafeLog.exception(exception));
            }
            if (reserved != null) {
                FileAsset failed = reserved;
                try {
                    Boolean confirmed = transaction.execute(status -> {
                        policy.lockUsers(userId);
                        var current = files.lockById(failed.getId());
                        if (current != null && "AVAILABLE".equals(current.getUploadStatus())) return true;
                        if (current != null && "UPLOADING".equals(current.getUploadStatus())) {
                            files.updateStatus(current.getId(), "CLEANUP_PENDING");
                        }
                        return false;
                    });
                    // 数据库提交结果未知时先回读，已确认可用的对象不能作为失败上传删除。
                    if (Boolean.TRUE.equals(confirmed)) {
                        ImageVO result = storage.signed(failed);
                        LOGGER.info("报价图片上传结果回读完成：userId={}, fileId={}", userId, failed.getId());
                        return result;
                    }
                    cleanup(failed, false);
                } catch (RuntimeException failure) {
                    LOGGER.error("报价图片补偿失败：stage=保留清理重试, userId={}, fileId={}",
                            userId, failed.getId(), SafeLog.exception(failure));
                }
            }
            if (exception instanceof BusinessException business) throw business;
            throw new BusinessException(WorkImageErrorCode.STORAGE_FAILED);
        } finally {
            if (reserved != null) activeUploads.remove(reserved.getId());
        }
    }

    @Override
    public ImageVO image(Long userId, Long fileId) {
        return BusinessLog.run(LOGGER, "报价图片签名读取", userId, () -> {
            policy.user(userId);
            var file = files.findById(fileId);
            if (file == null || !file.getObjectKey().startsWith("quotes/")
                    || !"AVAILABLE".equals(file.getUploadStatus())) throw missing();
            if (!userId.equals(file.getUploaderId()) && !references.readable(userId, fileId)) throw missing();
            return storage.signed(file);
        });
    }

    /** 历史引用在扫描及锁内均检查；只回收超过临时保留期且无人引用的报价图片。 */
    @Scheduled(fixedDelay = 60000, initialDelay = 60000)
    public void cleanupUnused() {
        try {
            for (var file : files.findInterruptedQuotes()) {
                if (!activeUploads.contains(file.getId())) cleanup(file, true);
            }
        } catch (RuntimeException exception) {
            LOGGER.error("报价图片清理失败：stage=扫描或清理", SafeLog.exception(exception));
        }
    }

    private void cleanup(FileAsset candidate, boolean checkDue) {
        var file = transaction.execute(status -> {
            policy.lockUsers(candidate.getUploaderId());
            var current = files.lockById(candidate.getId());
            if (current == null || "DELETED".equals(current.getUploadStatus())
                    || references.referenced(current.getId())
                    || checkDue && !files.applicationCleanupDue(current.getId())) return null;
            if (!"CLEANUP_PENDING".equals(current.getUploadStatus())) {
                files.updateStatus(current.getId(), "CLEANUP_PENDING");
            }
            return current;
        });
        if (file == null) return;
        storage.delete(file);
        transaction.executeWithoutResult(status -> {
            policy.lockUsers(file.getUploaderId());
            var current = files.lockById(file.getId());
            if (current != null && "CLEANUP_PENDING".equals(current.getUploadStatus())
                    && files.cleanupWindowElapsed(current.getId()) && !references.referenced(current.getId())) {
                files.updateStatus(current.getId(), "DELETED");
            }
        });
        LOGGER.info("报价临时图片清理完成：userId={}, fileId={}", file.getUploaderId(), file.getId());
    }

    private void qualified(Long userId) {
        String reason = policy.creatorReason(policy.user(userId), null);
        if (reason != null) throw new BusinessException(CommonErrorCode.FORBIDDEN, reason);
    }

    private static BusinessException missing() { return new BusinessException(CommonErrorCode.NOT_FOUND); }
}
