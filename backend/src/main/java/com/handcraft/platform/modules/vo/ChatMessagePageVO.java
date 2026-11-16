package com.handcraft.platform.modules.vo;
import java.util.List;
import java.time.*;
/**
 * @param items 按序号升序的消息
 * @param hasMore 当前方向是否仍有下一页
 */
public record ChatMessagePageVO(List<ChatMessageVO> items,boolean hasMore) {}
