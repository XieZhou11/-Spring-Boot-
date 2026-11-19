-- 历史节点记录保留空键，新图文操作按创作者范围隔离并发重试。
ALTER TABLE order_progress_record
    ADD COLUMN request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '创作者范围图文提交幂等键，历史记录可空' AFTER creator_id,
    ADD UNIQUE KEY uk_progress_creator_request (creator_id,request_key);
