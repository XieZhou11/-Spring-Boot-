-- 申请提交请求键跨重试保持稳定，历史记录补齐独立键；不改写已执行的 V1。
ALTER TABLE creator_application ADD COLUMN request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '客户端生成的提交请求键，用户范围内唯一';
UPDATE creator_application SET request_key=UUID() WHERE request_key IS NULL;
ALTER TABLE creator_application MODIFY COLUMN request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '客户端生成的提交请求键，用户范围内唯一', ADD UNIQUE KEY uk_application_user_request (user_id,request_key);
