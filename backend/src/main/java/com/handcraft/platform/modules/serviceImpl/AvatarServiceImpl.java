package com.handcraft.platform.modules.serviceImpl;

import static com.handcraft.platform.modules.exception.AvatarErrorCode.*;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.CannedAccessControlList;
import com.handcraft.platform.common.exception.BusinessException;
import com.handcraft.platform.common.exception.CommonErrorCode;
import com.handcraft.platform.common.logging.SafeLog;
import com.handcraft.platform.config.OssProperties;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.mapper.FileAssetMapper;
import com.handcraft.platform.modules.mapper.UserAccountMapper;
import com.handcraft.platform.modules.service.AvatarService;
import com.handcraft.platform.modules.vo.AvatarVO;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** OSS 网络调用不占数据库事务；先预留文件，再以用户→文件行锁原子绑定。 */
@Service
public class AvatarServiceImpl implements AvatarService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AvatarServiceImpl.class);
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final UserAccountMapper accounts;
    private final FileAssetMapper files;
    private final OssProperties properties;
    private final ObjectProvider<OSS> client;
    private final Clock clock;
    private final TransactionTemplate transaction;
    // 避免本进程调度器回收尚在网络调用中的上传；重启后由超时记录恢复。
    private final Set<Long> activeUploads = ConcurrentHashMap.newKeySet();

    public AvatarServiceImpl(UserAccountMapper accounts, FileAssetMapper files, OssProperties properties,
            ObjectProvider<OSS> client, Clock clock, PlatformTransactionManager manager) {
        this.accounts = accounts; this.files = files; this.properties = properties;
        this.client = client; this.clock = clock;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Override
    public void upload(Long userId, MultipartFile input) {
        LOGGER.info("头像上传开始：userId={}", userId);
        FileAsset file = null;
        String stage = "校验图片";
        try {
            Image image = image(input);
            stage = "检查存储配置";
            OSS oss = requireClient();
            stage = "预留文件元数据";
            file = reserve(userId, image);
            activeUploads.add(file.getId());
            LOGGER.info("头像文件已预留：userId={}, fileId={}", userId, file.getId());
            stage = "上传私有对象";
            var metadata = new ObjectMetadata();
            metadata.setContentType(image.contentType());
            metadata.setContentLength(image.bytes().length);
            metadata.setCacheControl("private, max-age=300");
            metadata.setObjectAcl(CannedAccessControlList.Private);
            oss.putObject(properties.getBucket(), file.getObjectKey(), new ByteArrayInputStream(image.bytes()), metadata);
            stage = "绑定本人头像";
            FileAsset reserved = file;
            transaction.executeWithoutResult(status -> {
                if (accounts.lockById(userId) == null) throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
                FileAsset locked = files.lockById(reserved.getId());
                if (locked == null || !userId.equals(locked.getUploaderId()) || !"UPLOADING".equals(locked.getUploadStatus())) {
                    throw new BusinessException(AVATAR_STATE_CONFLICT);
                }
                if (files.updateStatus(locked.getId(), "AVAILABLE") != 1
                        || accounts.updateAvatar(userId, locked.getId()) != 1) {
                    throw new IllegalStateException("头像绑定未生效");
                }
            });
            // execute 返回后事务已提交；旧头像可能被历史业务引用，绝不在替换时删除。
            LOGGER.info("头像上传绑定成功：userId={}, fileId={}", userId, file.getId());
        } catch (BusinessException exception) {
            LOGGER.warn("头像上传失败：stage={}, userId={}, fileId={}, code={}, reason={}", stage, userId,
                    file == null ? null : file.getId(), exception.getErrorCode().code(), exception.getMessage());
            if (file != null && compensate(file)) {
                LOGGER.info("头像上传绑定结果已确认成功：userId={}, fileId={}", userId, file.getId());
                return;
            }
            throw exception;
        } catch (RuntimeException exception) {
            LOGGER.error("头像上传异常：stage={}, userId={}, fileId={}", stage, userId,
                    file == null ? null : file.getId(), SafeLog.exception(exception));
            if (file != null && compensate(file)) {
                LOGGER.info("头像上传绑定结果已确认成功：userId={}, fileId={}", userId, file.getId());
                return;
            }
            throw new BusinessException(AVATAR_UPLOAD_FAILED);
        } finally {
            if (file != null) activeUploads.remove(file.getId());
        }
    }

    @Override
    public AvatarVO view(Long userId, Long fileId) {
        if (fileId == null || !properties.configured()) return null;
        LOGGER.info("本人头像读取开始：userId={}, fileId={}", userId, fileId);
        try {
            var account = accounts.findById(userId);
            FileAsset file = files.findById(fileId);
            if (account == null || !fileId.equals(account.getAvatarFileId()) || file == null
                    || !userId.equals(file.getUploaderId()) || !"AVAILABLE".equals(file.getUploadStatus())) {
                LOGGER.warn("本人头像读取拒绝：stage=校验归属及状态, userId={}, fileId={}", userId, fileId);
                return null;
            }
            OSS oss = client.getIfAvailable();
            if (oss == null) return null;
            OffsetDateTime expires = OffsetDateTime.now(clock).plusMinutes(15);
            String url = oss.generatePresignedUrl(properties.getBucket(), file.getObjectKey(),
                    Date.from(expires.toInstant())).toExternalForm();
            LOGGER.info("本人头像签名完成：userId={}, fileId={}", userId, fileId);
            return new AvatarVO(url, expires);
        } catch (RuntimeException exception) {
            // 签名失败不阻断其他资料读取；日志中不输出 SDK 携带的 URL 或密钥。
            LOGGER.error("本人头像读取异常：stage=生成访问签名, userId={}, fileId={}",
                    userId, fileId, SafeLog.exception(exception));
            return null;
        }
    }

    /** 持久化恢复进程中断及删除失败；只处理本业务从未成功绑定的头像。 */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void retryFailedUploads() {
        if (!properties.configured() || client.getIfAvailable() == null) return;
        try {
            for (FileAsset file : files.findInterruptedAvatars()) {
                if (!activeUploads.contains(file.getId())) compensate(file);
            }
        } catch (RuntimeException exception) {
            LOGGER.error("头像失败补偿扫描异常：stage=查询中断上传", SafeLog.exception(exception));
        }
    }

    private FileAsset reserve(Long userId, Image image) {
        return transaction.execute(status -> {
            if (accounts.lockById(userId) == null) throw new BusinessException(CommonErrorCode.UNAUTHORIZED);
            FileAsset file = new FileAsset();
            file.setUploaderId(userId);
            file.setObjectKey("avatars/" + userId + "/" + UUID.randomUUID() + ("image/png".equals(image.contentType()) ? ".png" : ".jpg"));
            file.setContentType(image.contentType()); file.setByteSize(image.bytes().length);
            file.setUploadStatus("UPLOADING");
            if (files.insert(file) != 1) throw new IllegalStateException("文件预留未生效");
            return file;
        });
    }

    private OSS requireClient() {
        OSS oss = properties.configured() ? client.getIfAvailable() : null;
        if (oss == null) throw new BusinessException(AVATAR_STORAGE_UNAVAILABLE);
        return oss;
    }

    private boolean compensate(FileAsset candidate) {
        try {
            // 绑定提交结果未知时，重新加锁读取；AVAILABLE 一律保留，查询失败一律不删。
            CleanupDecision decision = transaction.execute(status -> {
                var account = accounts.lockById(candidate.getUploaderId());
                FileAsset locked = files.lockById(candidate.getId());
                if (locked == null || !candidate.getUploaderId().equals(locked.getUploaderId())) return new CleanupDecision(null, false);
                if ("AVAILABLE".equals(locked.getUploadStatus())) {
                    // 成功提交但响应丢失时，以同事务重新确认当前引用，恢复正确的成功响应。
                    return new CleanupDecision(null, account != null && locked.getId().equals(account.getAvatarFileId()));
                }
                if (
                        !candidate.getUploaderId().equals(locked.getUploaderId())
                        || !locked.getObjectKey().matches("avatars/" + locked.getUploaderId() + "/[a-f0-9-]{36}\\.(png|jpg)")
                        || files.countAvatarReferences(locked.getId()) != 0) return new CleanupDecision(null, false);
                // 即使先前超时清理为 DELETED，迟到的 PUT 也要再清理一次，避免重建孤儿对象。
                // 已待清理的行不重复刷新 updated_at，否则稳定窗口永远无法结束。
                if (!"CLEANUP_PENDING".equals(locked.getUploadStatus())) files.updateStatus(locked.getId(), "CLEANUP_PENDING");
                return new CleanupDecision(locked, false);
            });
            FileAsset pending = decision.file();
            if (pending == null) return decision.bound();
            LOGGER.info("头像失败补偿开始：userId={}, fileId={}", pending.getUploaderId(), pending.getId());
            requireClient().deleteObject(properties.getBucket(), pending.getObjectKey());
            boolean completed = Boolean.TRUE.equals(transaction.execute(status -> {
                accounts.lockById(pending.getUploaderId());
                FileAsset locked = files.lockById(pending.getId());
                if (locked != null && "CLEANUP_PENDING".equals(locked.getUploadStatus())
                        && files.countAvatarReferences(locked.getId()) == 0 && files.cleanupWindowElapsed(locked.getId())) {
                    files.updateStatus(locked.getId(), "DELETED");
                    return true;
                }
                return false;
            }));
            if (completed) LOGGER.info("头像失败补偿完成：userId={}, fileId={}", pending.getUploaderId(), pending.getId());
            else LOGGER.info("头像对象本轮已删除，稳定窗口内继续保留补偿状态：userId={}, fileId={}", pending.getUploaderId(), pending.getId());
            return false;
        } catch (RuntimeException exception) {
            LOGGER.error("头像失败补偿异常：stage=核对记录或删除对象, userId={}, fileId={}，保留状态等待重试",
                    candidate.getUploaderId(), candidate.getId(), SafeLog.exception(exception));
            return false;
        }
    }

    private Image image(MultipartFile input) {
        if (input == null || input.isEmpty()) throw new BusinessException(AVATAR_INVALID);
        if (input.getSize() > MAX_BYTES) throw new BusinessException(AVATAR_TOO_LARGE);
        try (var source = input.getInputStream()) {
            byte[] bytes = source.readNBytes(MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new BusinessException(AVATAR_TOO_LARGE);
            try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers = ImageIO.getImageReaders(stream);
                if (!readers.hasNext()) throw new BusinessException(AVATAR_INVALID);
                var reader = readers.next();
                try {
                    String format = reader.getFormatName();
                    if (!"png".equalsIgnoreCase(format) && !"jpeg".equalsIgnoreCase(format)) throw new BusinessException(AVATAR_INVALID);
                    reader.setInput(stream, true, true);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width <= 0 || height <= 0) throw new BusinessException(AVATAR_INVALID);
                    // 大尺寸压缩图采用采样解码，限制内存分配，同时让解码器实际处理图片数据。
                    int sample = (int) Math.max(1L, (Math.max((long) width, height) + 2047) / 2048);
                    var parameters = reader.getDefaultReadParam();
                    parameters.setSourceSubsampling(sample, sample, 0, 0);
                    var warning = new AtomicBoolean();
                    reader.addIIOReadWarningListener((ignored, message) -> warning.set(true));
                    var decoded = reader.read(0, parameters);
                    if (decoded == null || warning.get()) throw new BusinessException(AVATAR_INVALID);
                    decoded.flush();
                    return new Image(bytes, "png".equalsIgnoreCase(format) ? "image/png" : "image/jpeg");
                } finally { reader.dispose(); }
            }
        } catch (IOException exception) {
            throw new BusinessException(AVATAR_INVALID);
        }
    }

    private record Image(byte[] bytes, String contentType) {}
    private record CleanupDecision(FileAsset file, boolean bound) {}
}
