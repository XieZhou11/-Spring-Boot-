package com.handcraft.platform.common.content;
import java.util.regex.Pattern;
/** 作品、需求与会话共用基础文本治理，不记录或改写用户原文。 */
public final class PlainTextPolicy {
    private PlainTextPolicy() {}
    // 普通公开文案按保守规则阻止脚本、联系方式、外链及明显引流，人工审核处理图片及原创性。
    private static final Pattern UNSAFE=Pattern.compile("(?is)<\\s*(script|iframe|object|embed|svg)|javascript\\s*:|on(?:error|load|click)\\s*=|https?://|www\\.|[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}|(?<![0-9])1[3-9][0-9]{9}(?![0-9])|微信|薇信|微\\s*信|加\\s*[vV]|[qQ]{2}|[vV][xX]|联系方式|淘宝|天猫|拼多多|闲鱼|抖音|小红书|京东|傻逼|操你|去死|\\b(?:[a-z0-9-]+\\.)+(?:com|cn|net|org)\\b");
    /** 是否符合普通站内文本的脚本、联系方式和站外引流限制。 */
    public static boolean safe(String value){return value==null||!UNSAFE.matcher(value).find();}
}
