package com.handcraft.platform.modules.entity;

import lombok.Getter;
import lombok.Setter;

/** 账号认证所需持久化字段；不生成包含邮箱和密码摘要的 toString。 */
@Getter
@Setter
public class UserAccount {
    /** 账号主键，由数据库生成；对外返回时转为字符串。 */
    private Long id;

    /** 规范化后的唯一登录邮箱，仅支持 QQ 和 163 邮箱。 */
    private String email;

    /** BCrypt 密码摘要，不保存明文，也不向客户端返回。 */
    private String passwordHash;

    /** 用户昵称，按 Unicode 字符计为 2—8 字。 */
    private String nickname;

    /** 本人头像文件编号，关联 file_asset，不保存签名地址。 */
    private Long avatarFileId;

    /** 对外展示的个人简介，最多 200 字，未填写时可为空。 */
    private String bio;

    /** 管理员标记，对应 is_admin；仅由服务端维护。 */
    private boolean admin;

    /** 创作者认证状态：NONE 未申请、PENDING 待审核、APPROVED 已通过、REJECTED 已拒绝。 */
    private String certificationStatus;
}
