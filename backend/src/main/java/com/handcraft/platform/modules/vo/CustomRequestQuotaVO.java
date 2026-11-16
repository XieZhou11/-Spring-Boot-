package com.handcraft.platform.modules.vo;
import java.util.List;
import java.time.*;
/**
 * @param used 同时开放需求数
 * @param limit 上限数量
 * @param remaining 剩余数量
 * @param canPublish 当前是否可发布
 * @param reason 禁止发布原因
 */
public record CustomRequestQuotaVO(long used,long limit,long remaining,boolean canPublish,String reason) {}
