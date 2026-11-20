package com.handcraft.platform.modules.vo;
import java.util.List;
/** @param items 按编号升序的不可变补证 @param nextCursor 下一页排他编号游标 @param hasMore 是否存在更多记录 */
public record RefundEvidencePageVO(List<RefundEvidenceVO> items,String nextCursor,boolean hasMore) {}
