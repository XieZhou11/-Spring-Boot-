-- 为既有作品补齐创建幂等键后再设非空；保留原业务更新时间，不改写 V1/V2。
ALTER TABLE work
    ADD COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '创作者范围创建幂等键' AFTER creator_id,
    ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '每次实际变更递增的乐观版本' AFTER create_request_key;

-- MySQL UUID() 对每条旧作品生成独立值；显式自赋值防止更新时间被回填改写。
UPDATE work SET create_request_key=UUID(),updated_at=updated_at WHERE create_request_key IS NULL;

ALTER TABLE work
    MODIFY COLUMN create_request_key VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '创作者范围创建幂等键',
    ADD UNIQUE KEY uk_work_creator_request (creator_id,create_request_key);
