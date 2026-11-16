-- 保留既有记录和更新时间，为需求重试、乐观并发与草稿删除补充持久字段。
ALTER TABLE custom_request
    ADD COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '买家范围创建幂等键' AFTER buyer_id,
    ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '实际变更递增的保存版本' AFTER create_request_key,
    ADD COLUMN deleted_at DATETIME(3) NULL COMMENT '草稿逻辑删除时间，历史图片引用保留';
UPDATE custom_request SET create_request_key=UUID(),updated_at=updated_at WHERE create_request_key IS NULL;
ALTER TABLE custom_request
    MODIFY COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '买家范围创建幂等键',
    ADD UNIQUE KEY uk_request_buyer_key (buyer_id,create_request_key);

-- 冷却属于会话双方的持久状态，返回429时同样提交，重试和重启不能绕过。
ALTER TABLE conversation
    ADD COLUMN buyer_cooldown_until DATETIME(3) NULL COMMENT '买家超限后发送冷却截止时间',
    ADD COLUMN creator_cooldown_until DATETIME(3) NULL COMMENT '创作者超限后发送冷却截止时间';
