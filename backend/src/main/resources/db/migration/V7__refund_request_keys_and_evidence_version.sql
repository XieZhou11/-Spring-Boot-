-- 普通售后及补证使用身份范围请求键；保留历史记录空键，不回填原创建时间。
ALTER TABLE refund_application
    ADD COLUMN create_request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '买家范围申请幂等键',
    ADD COLUMN version BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已提交补证递增版本',
    ADD UNIQUE KEY uk_refund_buyer_request (buyer_id, create_request_key);
ALTER TABLE refund_evidence
    ADD COLUMN request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '提交者范围补证幂等键',
    ADD UNIQUE KEY uk_refund_evidence_submitter_request (submitter_id, request_key);
