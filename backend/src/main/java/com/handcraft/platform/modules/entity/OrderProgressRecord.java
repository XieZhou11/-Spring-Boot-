package com.handcraft.platform.modules.entity;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;
/** 只追加的制作图文和跳过依据。 */
@Getter @Setter
public class OrderProgressRecord {
    /** 记录编号。 */ private Long id;
    /** 所属节点编号。 */ private Long nodeId;
    /** 提交创作者编号。 */ private Long creatorId;
    /** 创作者范围幂等键。 */ private String requestKey;
    /** CHECKIN、SKIP或SUPPLEMENT。 */ private String recordType;
    /** 原始说明。 */ private String content;
    /** 按顺序保存的文件编号JSON数组。 */ private String imageIds;
    /** 打样不适用原因。 */ private String skipReason;
    /** 原始提交时刻。 */ private LocalDateTime createdAt;
}
