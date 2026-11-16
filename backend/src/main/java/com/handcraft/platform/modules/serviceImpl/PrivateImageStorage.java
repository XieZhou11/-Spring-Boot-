package com.handcraft.platform.modules.serviceImpl;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.*;
import com.handcraft.platform.common.exception.*;
import com.handcraft.platform.config.OssProperties;
import com.handcraft.platform.modules.entity.FileAsset;
import com.handcraft.platform.modules.exception.WorkImageErrorCode;
import com.handcraft.platform.modules.vo.ImageVO;
import java.io.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
/** 图片存储协议共用设施；业务归属、引用和事务仍由各自服务负责。 */
@Component
public class PrivateImageStorage {
    private static final int MAX_BYTES=5*1024*1024;
    private final OssProperties properties;private final ObjectProvider<OSS> clients;private final Clock clock;
    public PrivateImageStorage(OssProperties properties,ObjectProvider<OSS> clients,Clock clock){this.properties=properties;this.clients=clients;this.clock=clock;}
    /** 确认当前存储配置可用，业务预留前调用。 */
    public OSS client(){OSS client=properties.configured()?clients.getIfAvailable():null;if(client==null)throw new BusinessException(WorkImageErrorCode.STORAGE_UNAVAILABLE);return client;}
    /** 使用服务端确认的MIME并明确设置私有ACL，忽略客户端文件名。 */
    public void put(FileAsset file,Image image){var metadata=new ObjectMetadata();metadata.setContentType(image.type());metadata.setContentLength(image.bytes().length);metadata.setObjectAcl(CannedAccessControlList.Private);metadata.setCacheControl("private, max-age=300");client().putObject(properties.getBucket(),file.getObjectKey(),new ByteArrayInputStream(image.bytes()),metadata);}
    /** 生成十五分钟私有读签名，数据库只保存随机对象键。 */
    public ImageVO signed(FileAsset file){try{OffsetDateTime expires=OffsetDateTime.now(clock).withOffsetSameInstant(ZoneOffset.ofHours(8)).plusMinutes(15);return new ImageVO(file.getId().toString(),client().generatePresignedUrl(properties.getBucket(),file.getObjectKey(),Date.from(expires.toInstant())).toExternalForm(),expires);}catch(BusinessException e){throw e;}catch(RuntimeException e){throw new BusinessException(WorkImageErrorCode.STORAGE_UNAVAILABLE);}}
    /** 删除不再被任何当前或历史业务引用的对象，重试时可重复调用。 */
    public void delete(FileAsset file){client().deleteObject(properties.getBucket(),file.getObjectKey());}
    /** 解码实际图片并检查体积、尺寸和损坏数据。 */
    public Image image(MultipartFile input){
        if(input==null||input.isEmpty())throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);
        if(input.getSize()>MAX_BYTES)throw new BusinessException(WorkImageErrorCode.IMAGE_TOO_LARGE);
        try(var source=input.getInputStream()){
            byte[] bytes=source.readNBytes(MAX_BYTES+1);if(bytes.length>MAX_BYTES)throw new BusinessException(WorkImageErrorCode.IMAGE_TOO_LARGE);
            try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))){
                var readers=ImageIO.getImageReaders(stream);if(!readers.hasNext())throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);
                var reader=readers.next();try{reader.setInput(stream);String format=reader.getFormatName().toLowerCase(Locale.ROOT);
                    if(!Set.of("png","jpeg","webp").contains(format))throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);
                    long width=reader.getWidth(0),height=reader.getHeight(0);
                    // 限制解码内存，避免压缩率极高的图片耗尽JVM，不按文件名或客户端MIME判型。
                    if(width<=0||height<=0||width*height>40_000_000)throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);
                    AtomicBoolean warning=new AtomicBoolean();reader.addIIOReadWarningListener((r,w)->warning.set(true));
                    if(reader.read(0)==null||warning.get())throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);
                    return new Image(bytes,"image/"+format,format.equals("jpeg")?".jpg":"."+format);
                }finally{reader.dispose();}
            }
        }catch(IOException e){throw new BusinessException(WorkImageErrorCode.INVALID_IMAGE);}
    }
    /** @param bytes 已解码确认的原始字节 @param type 真实MIME @param extension 服务端扩展名 */
    public record Image(byte[] bytes,String type,String extension){}
}
