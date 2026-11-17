-- 历史报价保留方案、状态和原更新时间，补齐提交重试键。
ALTER TABLE quote ADD COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '创作者范围提交幂等键' AFTER creator_id;
UPDATE quote SET create_request_key=UUID(),updated_at=updated_at WHERE create_request_key IS NULL;
ALTER TABLE quote
    MODIFY COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '创作者范围提交幂等键',
    ADD UNIQUE KEY uk_quote_creator_key (creator_id,create_request_key);
