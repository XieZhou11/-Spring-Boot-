package com.handcraft.platform.modules.security;

import com.handcraft.platform.modules.entity.UserAccount;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

/** 会话中的服务端身份；不保存明文密码或可用于登录的密码哈希。 */
public final class AccountPrincipal implements java.security.Principal, Serializable {
    private static final long serialVersionUID = 1L;
    private final Long userId;
    private final String credentialFingerprint;
    private final Instant expiresAt;
    private final String activeRole;

    public AccountPrincipal(UserAccount account, Instant issuedAt) {
        this.userId = account.getId();
        this.credentialFingerprint = fingerprint(account.getPasswordHash());
        this.expiresAt = issuedAt.plusSeconds(7 * 24 * 60 * 60);
        this.activeRole = account.isAdmin() ? "ADMIN" : "BUYER";
    }

    @Override
    public String getName() {
        return userId.toString();
    }

    public Long userId() {
        return userId;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public String activeRole() {
        return activeRole;
    }

    public boolean matches(String passwordHash) {
        return MessageDigest.isEqual(
                credentialFingerprint.getBytes(StandardCharsets.US_ASCII),
                fingerprint(passwordHash).getBytes(StandardCharsets.US_ASCII));
    }

    public static List<String> roles(UserAccount account) {
        if (account.isAdmin()) {
            return List.of("ADMIN");
        }
        return "APPROVED".equals(account.getCertificationStatus())
                ? List.of("BUYER", "CREATOR")
                : List.of("BUYER");
    }

    private static String fingerprint(String hash) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(hash.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("无法核对登录凭证", exception);
        }
    }
}
