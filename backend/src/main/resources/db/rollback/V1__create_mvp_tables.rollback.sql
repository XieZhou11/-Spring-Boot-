-- 人工结构回退脚本，仅编写，尚未执行。
-- 不属于 Flyway 自动版本迁移，不可将此目录加入 flyway.locations。
-- 仅用于没有业务数据的专用初始化库，或已确认可丢弃的初始化残留表。
-- 必须先核对目标 schema、表清单、数据及备份；存在业务数据时改用补偿迁移或备份恢复。
-- DROP TABLE 会隐式提交；本文件无法提供整个结构回退的事务原子性。
-- 每条 DROP 均独立生效，中途失败须核对剩余表后继续处理。
-- 不删除数据库，不关闭关联校验，不删除或篡改 Flyway 历史记录。
-- 完整 V1 已被登记成功时，手动删表不会撤销该版本；通常应重建专用空库再由 Flyway 初始化。
-- V1 失败时先核对并清理本次创建残留，再按实际 Flyway 状态决定是否人工 repair；repair 不会恢复结构。

DROP TABLE IF EXISTS operation_log;
DROP TABLE IF EXISTS report_evidence;
DROP TABLE IF EXISTS report;
DROP TABLE IF EXISTS system_notification;
DROP TABLE IF EXISTS chat_message;
DROP TABLE IF EXISTS conversation;
DROP TABLE IF EXISTS order_review;
DROP TABLE IF EXISTS order_settlement;
DROP TABLE IF EXISTS fund_flow;
DROP TABLE IF EXISTS refund_evidence;
DROP TABLE IF EXISTS refund_application;
DROP TABLE IF EXISTS order_progress_record;
DROP TABLE IF EXISTS order_progress_node;
DROP TABLE IF EXISTS trade_order;
DROP TABLE IF EXISTS quote;
DROP TABLE IF EXISTS custom_request;
DROP TABLE IF EXISTS creator_follow;
DROP TABLE IF EXISTS work_comment;
DROP TABLE IF EXISTS work_reaction;
DROP TABLE IF EXISTS work;
DROP TABLE IF EXISTS file_asset;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS creator_application_category;
DROP TABLE IF EXISTS creator_application;
DROP TABLE IF EXISTS email_verification_code;
DROP TABLE IF EXISTS shipping_address;
DROP TABLE IF EXISTS user_account;
