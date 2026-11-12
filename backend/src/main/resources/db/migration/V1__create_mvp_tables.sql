-- MySQL 8.4 / InnoDB / utf8mb4。仅编写，尚未执行。
-- 业务依据：docs/requirements/requirements.md（当前 V1.5）；设计：docs/design/数据库表结构.md。
-- 共 27 张业务表；关联由应用层校验，不建立数据库外键。
-- 本脚本只包含结构定义，不创建数据库、账号、演示数据或 Flyway 历史表。
-- MySQL DDL 会隐式提交，不用 START TRANSACTION 包装建表以冒充整体原子性。
-- 业务 DML 回滚约定见设计第 6 章；人工结构回退在 ../rollback/，不得加入迁移扫描目录。

-- 用户账号表：统一保存买家、创作者和管理员账号，以及认证资格、暂停业务标记。
CREATE TABLE user_account (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户编号',
    email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT '去首尾空格并转小写后的邮箱',
    password_hash VARCHAR(100) NOT NULL COMMENT '加盐密码哈希，不保存明文密码',
    nickname VARCHAR(8) NOT NULL COMMENT '昵称，2至8字',
    avatar_file_id BIGINT UNSIGNED NULL COMMENT '头像文件编号',
    bio VARCHAR(200) NULL COMMENT '个人简介',
    is_admin TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '管理员标记，1是0否',
    certification_status VARCHAR(24) NOT NULL DEFAULT 'NONE' COMMENT '认证状态：NONE/PENDING/APPROVED/REJECTED',
    approved_application_id BIGINT UNSIGNED NULL COMMENT '已通过的申请编号',
    creator_paused TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '本人暂停接单，1暂停0未暂停',
    admin_business_paused TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '后台暂停新业务，1暂停0未暂停',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '注册时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_email (email),
    UNIQUE KEY uk_user_approved_application (approved_application_id),
    KEY idx_user_certification_created (certification_status, created_at, id),
    KEY idx_user_created (created_at, id),
    CONSTRAINT ck_user_flags CHECK (is_admin IN (0, 1) AND creator_paused IN (0, 1) AND admin_business_paused IN (0, 1)),
    CONSTRAINT ck_user_certification CHECK (certification_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT ck_user_nickname CHECK (CHAR_LENGTH(nickname) BETWEEN 2 AND 8)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='统一账号与业务资格';

-- 收货地址表：保存用户地址及默认地址设置，订单另存地址快照。
CREATE TABLE shipping_address (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '收货地址编号',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '所属用户编号',
    recipient_name VARCHAR(50) NOT NULL COMMENT '收件人姓名',
    phone CHAR(11) NOT NULL COMMENT '大陆收货手机号',
    province VARCHAR(50) NOT NULL COMMENT '省',
    city VARCHAR(50) NOT NULL COMMENT '市',
    district VARCHAR(50) NOT NULL COMMENT '区县',
    detail_address VARCHAR(255) NOT NULL COMMENT '详细地址',
    is_default TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '默认地址，1是0否',
    default_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN is_default = 1 THEN user_id ELSE NULL END) STORED COMMENT '仅默认地址参与用户唯一约束',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_address_default_user (default_user_id),
    KEY idx_address_user (user_id, id),
    CONSTRAINT ck_address_default CHECK (is_default IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户收货地址，订单另存不可变快照';

-- 邮箱验证码表：保存注册和找回密码共用的最新验证码摘要、发送状态及有效期。
CREATE TABLE email_verification_code (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '验证码记录编号',
    email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT '规范化邮箱，每邮箱一条最新记录',
    send_request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '当前发送请求标识，隔离并发发送回调',
    code_digest VARBINARY(32) NOT NULL COMMENT '验证码摘要，不保存验证码原文',
    send_status VARCHAR(24) NOT NULL DEFAULT 'SENDING' COMMENT '发送状态：SENDING/SENT/FAILED/UNKNOWN',
    expires_at DATETIME(3) NOT NULL COMMENT '失效时刻，到达即失效',
    used_at DATETIME(3) NULL COMMENT '成功消费时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '记录创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最新发送或消费更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_email_code_email (email),
    UNIQUE KEY uk_email_code_request (send_request_key),
    KEY idx_email_code_expiry (expires_at, id),
    CONSTRAINT ck_email_code_send_status CHECK (send_status IN ('SENDING', 'SENT', 'FAILED', 'UNKNOWN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='注册和找回共用的最新邮箱验证码';

-- 创作者认证申请表：保存历次入驻材料、收款资料及审核结果。
CREATE TABLE creator_application (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '认证申请编号，每次重提新增',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '申请人编号',
    real_name VARCHAR(20) NOT NULL COMMENT '明文申请人及收款人姓名，提交时校验一致',
    contact_phone CHAR(11) NOT NULL COMMENT '联系手机号',
    province VARCHAR(50) NOT NULL COMMENT '所在地省',
    city VARCHAR(50) NOT NULL COMMENT '所在地市',
    district VARCHAR(50) NOT NULL COMMENT '所在地区县',
    experience_years TINYINT UNSIGNED NOT NULL COMMENT '从业年限，0至70年',
    introduction VARCHAR(500) NOT NULL COMMENT '创作者介绍，50至500字',
    original_works JSON NOT NULL COMMENT '3至5件作品，每件含finished_image_ids和process_image_ids数组',
    alipay_account_ciphertext VARBINARY(512) NOT NULL COMMENT '支付宝账号密文，含加密版本及随机参数',
    supporting_description TEXT NULL COMMENT '选填补充说明，不提供补充证明附件',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT '申请记录状态：PENDING/APPROVED/REJECTED/WITHDRAWN',
    pending_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN user_id ELSE NULL END) STORED COMMENT '仅待审核申请参与用户唯一约束',
    approved_user_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'APPROVED' THEN user_id ELSE NULL END) STORED COMMENT '每个用户至多一份通过申请',
    submitted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '提交时间',
    reviewer_id BIGINT UNSIGNED NULL COMMENT '审核管理员编号',
    review_reason TEXT NULL COMMENT '审核结论和原因',
    reviewed_at DATETIME(3) NULL COMMENT '审核时间',
    withdrawn_at DATETIME(3) NULL COMMENT '撤回时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_application_pending_user (pending_user_id),
    UNIQUE KEY uk_application_approved_user (approved_user_id),
    KEY idx_application_user_submitted (user_id, submitted_at, id),
    KEY idx_application_review_queue (status, submitted_at, id),
    CONSTRAINT ck_application_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    CONSTRAINT ck_application_material CHECK (CHAR_LENGTH(real_name) BETWEEN 2 AND 20 AND experience_years <= 70 AND CHAR_LENGTH(introduction) BETWEEN 50 AND 500),
    CONSTRAINT ck_application_works CHECK (JSON_TYPE(original_works) = 'ARRAY' AND JSON_LENGTH(original_works) BETWEEN 3 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='创作者认证申请及历次材料';

-- 认证申请主品类关联表：记录每份认证申请选择的一级主品类。
CREATE TABLE creator_application_category (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申请品类关系编号',
    application_id BIGINT UNSIGNED NOT NULL COMMENT '认证申请编号',
    category_id BIGINT UNSIGNED NOT NULL COMMENT '一级主品类编号',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '建立时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_application_category (application_id, category_id),
    KEY idx_application_category_category (category_id, application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='每份申请的1至3个一级主品类';

-- 作品品类表：维护两级手工品类、显示顺序及启停状态。
CREATE TABLE category (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '品类编号',
    parent_id BIGINT UNSIGNED NULL COMMENT '父一级品类编号，一级为空',
    name VARCHAR(50) NOT NULL COMMENT '品类名称',
    enabled TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '是否启用，1启用0停用',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '同级显示顺序',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_category_parent_enabled_sort (parent_id, enabled, sort_order, id),
    CONSTRAINT ck_category_enabled CHECK (enabled IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='两级手工品类，停用保留历史引用';

-- 文件资源表：保存私有 OSS 文件的对象键、上传人、大小及可用状态。
CREATE TABLE file_asset (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '文件编号',
    uploader_id BIGINT UNSIGNED NOT NULL COMMENT '上传人编号',
    object_key VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'OSS对象键，区分大小写，不存签名URL',
    content_type VARCHAR(64) NOT NULL COMMENT '实际文件MIME类型',
    byte_size INT UNSIGNED NOT NULL COMMENT '实际文件字节数',
    upload_status VARCHAR(24) NOT NULL DEFAULT 'UPLOADING' COMMENT 'UPLOADING/AVAILABLE/CLEANUP_PENDING/DELETED',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '上传记录创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '上传或清理更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_file_object_key (object_key),
    KEY idx_file_uploader_created (uploader_id, created_at, id),
    KEY idx_file_cleanup (upload_status, updated_at, id),
    CONSTRAINT ck_file_status CHECK (upload_status IN ('UPLOADING', 'AVAILABLE', 'CLEANUP_PENDING', 'DELETED')),
    CONSTRAINT ck_file_size CHECK (byte_size > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='私有OSS文件元数据，业务字段保存文件引用';

-- 作品表：保存展示内容、审核状态、现货销售与接受定制开关，以及单件现货状态。
CREATE TABLE work (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '作品编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '创作者编号',
    category_id BIGINT UNSIGNED NULL COMMENT '末级品类编号，草稿可空',
    title VARCHAR(30) NULL COMMENT '作品标题，发布时2至30字',
    main_image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '主图文件数组，发布时1至9张',
    material VARCHAR(20) NULL COMMENT '材质，草稿可空',
    specification TEXT NULL COMMENT '尺寸规格，草稿可空',
    specification_image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '选填尺寸图文件数组',
    description VARCHAR(2000) NULL COMMENT '作品描述，发布时20至2000字',
    process_description VARCHAR(1000) NULL COMMENT '选填制作过程说明',
    sale_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '出售现货开关',
    custom_enabled TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '接受同类定制开关',
    stock_price DECIMAL(12,2) NULL COMMENT '现货售价，开启销售时0.01至99999元',
    custom_reference_days SMALLINT UNSIGNED NULL COMMENT '定制参考自然日，开启接受定制时3至180',
    review_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/PENDING/ONLINE/REJECTED/OFFLINE',
    stock_status VARCHAR(24) NULL COMMENT '从未启用现货时可空，否则AVAILABLE/RESERVED/SOLD_OUT',
    stock_order_id BIGINT UNSIGNED NULL COMMENT '当前锁定或售出的直购订单，退款不自动清空',
    source_order_id BIGINT UNSIGNED NULL COMMENT '成品案例来源定制订单，需买家按钮授权',
    first_submitted_at DATETIME(3) NULL COMMENT '首次提交时间，每日5件额度依据，删除不清空',
    submitted_at DATETIME(3) NULL COMMENT '本轮提交审核时间',
    online_at DATETIME(3) NULL COMMENT '最近上架时间',
    deleted_at DATETIME(3) NULL COMMENT '草稿逻辑删除时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_work_creator_list (creator_id, review_status, created_at, id),
    KEY idx_work_first_submission (creator_id, first_submitted_at, id),
    KEY idx_work_review_queue (review_status, submitted_at, id),
    KEY idx_work_public_latest (review_status, deleted_at, online_at, id),
    KEY idx_work_public_category (category_id, review_status, deleted_at, online_at, id),
    KEY idx_work_stock_price (review_status, deleted_at, sale_enabled, stock_status, stock_price, id),
    KEY idx_work_source_order (source_order_id, id),
    CONSTRAINT ck_work_flags CHECK (sale_enabled IN (0, 1) AND custom_enabled IN (0, 1)),
    CONSTRAINT ck_work_review_status CHECK (review_status IN ('DRAFT', 'PENDING', 'ONLINE', 'REJECTED', 'OFFLINE')),
    CONSTRAINT ck_work_stock_status CHECK (stock_status IS NULL OR stock_status IN ('AVAILABLE', 'RESERVED', 'SOLD_OUT')),
    CONSTRAINT ck_work_price CHECK (stock_price IS NULL OR stock_price BETWEEN 0.01 AND 99999.00),
    CONSTRAINT ck_work_duration CHECK (custom_reference_days IS NULL OR custom_reference_days BETWEEN 3 AND 180),
    CONSTRAINT ck_work_images CHECK (JSON_TYPE(main_image_ids) = 'ARRAY' AND JSON_LENGTH(main_image_ids) <= 9 AND JSON_TYPE(specification_image_ids) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='作品展示、独立交易开关与单件现货状态';

-- 作品互动表：保存用户对作品的点赞和收藏关系。
CREATE TABLE work_reaction (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '互动关系编号',
    user_id BIGINT UNSIGNED NOT NULL COMMENT '用户编号',
    work_id BIGINT UNSIGNED NOT NULL COMMENT '作品编号',
    reaction_type VARCHAR(16) NOT NULL COMMENT 'LIKE点赞/FAVORITE收藏',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '互动时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_reaction_user_work_type (user_id, work_id, reaction_type),
    KEY idx_reaction_work_type (work_id, reaction_type),
    KEY idx_reaction_user_list (user_id, reaction_type, created_at, id),
    CONSTRAINT ck_reaction_type CHECK (reaction_type IN ('LIKE', 'FAVORITE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='作品点赞与收藏，可取消';

-- 作品评论表：保存公开图文评论，并分别记录用户删除与管理员隐藏状态。
CREATE TABLE work_comment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '评论编号',
    work_id BIGINT UNSIGNED NOT NULL COMMENT '作品编号',
    author_id BIGINT UNSIGNED NOT NULL COMMENT '评论作者编号',
    content VARCHAR(500) NOT NULL COMMENT '评论文字，10至500字',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '0至3张图片文件数组',
    user_deleted_at DATETIME(3) NULL COMMENT '作者自行删除时间',
    moderation_status VARCHAR(24) NOT NULL DEFAULT 'VISIBLE' COMMENT 'VISIBLE正常/HIDDEN管理员隐藏',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '发表时间',
    PRIMARY KEY (id),
    KEY idx_comment_public_list (work_id, user_deleted_at, moderation_status, created_at, id),
    KEY idx_comment_author (author_id, created_at, id),
    CONSTRAINT ck_comment_content CHECK (CHAR_LENGTH(content) BETWEEN 10 AND 500),
    CONSTRAINT ck_comment_status CHECK (moderation_status IN ('VISIBLE', 'HIDDEN')),
    CONSTRAINT ck_comment_images CHECK (JSON_TYPE(image_ids) = 'ARRAY' AND JSON_LENGTH(image_ids) <= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='作品图文评论，用户删除与管理员隐藏独立';

-- 创作者关注表：保存用户与被关注创作者之间的关注关系。
CREATE TABLE creator_follow (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '关注关系编号',
    follower_id BIGINT UNSIGNED NOT NULL COMMENT '关注人编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '被关注创作者编号',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '关注时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_follow_pair (follower_id, creator_id),
    KEY idx_follow_user_list (follower_id, created_at, id),
    KEY idx_follow_creator (creator_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='关注关系，不产生陌生人私聊权限';

-- 定制需求表：保存买家公开或定向发布的需求内容、唯一受邀者及业务状态。
CREATE TABLE custom_request (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '定制需求编号',
    buyer_id BIGINT UNSIGNED NOT NULL COMMENT '发布买家编号',
    title VARCHAR(30) NULL COMMENT '标题，发布时5至30字',
    category_id BIGINT UNSIGNED NULL COMMENT '末级品类编号，草稿可空',
    purpose TEXT NULL COMMENT '用途，发布时必填',
    material_preference TEXT NULL COMMENT '材质偏好，发布时必填',
    specification TEXT NULL COMMENT '尺寸规格，发布时必填',
    budget_min DECIMAL(12,2) NULL COMMENT '预算下限，50至50000元',
    budget_max DECIMAL(12,2) NULL COMMENT '预算上限，不低于下限',
    expected_ship_date DATE NULL COMMENT '期望发货日期，发布时校验7至180天',
    reference_image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '0至9张参考图文件数组',
    description VARCHAR(2000) NULL COMMENT '需求描述，发布时20至2000字',
    visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC' COMMENT 'PUBLIC公开/DIRECTED定向',
    invited_creator_id BIGINT UNSIGNED NULL COMMENT '唯一受邀创作者编号，定向发布必填',
    source_work_id BIGINT UNSIGNED NULL COMMENT '参考作品编号，不占用其现货',
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT/OPEN/QUOTING/AWARDED/IN_TRADE/COMPLETED/CLOSED/EXPIRED',
    published_at DATETIME(3) NULL COMMENT '发布时间',
    no_quote_expire_at DATETIME(3) NULL COMMENT '发布满7天，仅无有效报价时过期',
    closed_at DATETIME(3) NULL COMMENT '主动关闭、取消或退款关闭时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_request_buyer_status (buyer_id, status, created_at, id),
    KEY idx_request_public_latest (visibility, status, published_at, id),
    KEY idx_request_public_category (category_id, visibility, status, published_at, id),
    KEY idx_request_invited (invited_creator_id, status, published_at, id),
    KEY idx_request_expiry (status, no_quote_expire_at, id),
    CONSTRAINT ck_request_status CHECK (status IN ('DRAFT', 'OPEN', 'QUOTING', 'AWARDED', 'IN_TRADE', 'COMPLETED', 'CLOSED', 'EXPIRED')),
    CONSTRAINT ck_request_visibility CHECK (visibility IN ('PUBLIC', 'DIRECTED') AND (visibility <> 'PUBLIC' OR invited_creator_id IS NULL)),
    CONSTRAINT ck_request_budget CHECK ((budget_min IS NULL OR budget_min BETWEEN 50.00 AND 50000.00) AND (budget_max IS NULL OR budget_max BETWEEN 50.00 AND 50000.00) AND (budget_min IS NULL OR budget_max IS NULL OR budget_max >= budget_min)),
    CONSTRAINT ck_request_images CHECK (JSON_TYPE(reference_image_ids) = 'ARRAY' AND JSON_LENGTH(reference_image_ids) <= 9)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='公开或单人定向定制需求，发布后正文锁定';

-- 定制报价表：保存创作者报价方案、金额、工期，以及撤回、重报和定标历史。
CREATE TABLE quote (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '报价编号，每次重报新增',
    request_id BIGINT UNSIGNED NOT NULL COMMENT '定制需求编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '报价创作者编号',
    goods_amount DECIMAL(12,2) NOT NULL COMMENT '报价成交金额，50至50000元',
    duration_days SMALLINT UNSIGNED NOT NULL COMMENT '3至180个自然日工期',
    proposal VARCHAR(1000) NOT NULL COMMENT '方案说明，30至1000字',
    additional_agreement TEXT NULL COMMENT '材料与修改补充约定',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '0至5张效果图或草图文件数组',
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE/AWARDED/LOST/EXPIRED',
    active_creator_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'ACTIVE' THEN creator_id ELSE NULL END) STORED COMMENT '仅有效状态参与同人同需求唯一约束',
    expires_at DATETIME(3) NOT NULL COMMENT '提交后7天，到达即失效',
    invalid_reason VARCHAR(24) NULL COMMENT 'WITHDRAWN/TIMEOUT/REQUEST_CLOSED',
    invalidated_at DATETIME(3) NULL COMMENT '失效时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '提交时间，每日20次额度依据',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '状态更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_quote_active_creator (request_id, active_creator_id),
    KEY idx_quote_request_status (request_id, status, expires_at, id),
    KEY idx_quote_creator_daily (creator_id, created_at, id),
    KEY idx_quote_expiry (status, expires_at, id),
    CONSTRAINT ck_quote_status CHECK (status IN ('ACTIVE', 'AWARDED', 'LOST', 'EXPIRED')),
    CONSTRAINT ck_quote_amount_duration CHECK (goods_amount BETWEEN 50.00 AND 50000.00 AND duration_days BETWEEN 3 AND 180),
    CONSTRAINT ck_quote_proposal CHECK (CHAR_LENGTH(proposal) BETWEEN 30 AND 1000),
    CONSTRAINT ck_quote_invalid_reason CHECK (invalid_reason IS NULL OR invalid_reason IN ('WITHDRAWN', 'TIMEOUT', 'REQUEST_CLOSED')),
    CONSTRAINT ck_quote_images CHECK (JSON_TYPE(image_ids) = 'ARRAY' AND JSON_LENGTH(image_ids) <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='报价及撤回重报历史，实际有效性还需检查截止时间';

-- 交易订单表：统一保存现货与定制订单、交易快照、履约状态及成品公开授权。
CREATE TABLE trade_order (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单编号',
    order_no VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '唯一业务订单号',
    order_type VARCHAR(16) NOT NULL COMMENT 'STOCK现货/CUSTOM定制',
    buyer_id BIGINT UNSIGNED NOT NULL COMMENT '买家编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '创作者编号',
    work_id BIGINT UNSIGNED NULL COMMENT '现货对应作品编号，定制为空',
    request_id BIGINT UNSIGNED NULL COMMENT '定制需求编号，现货为空',
    quote_id BIGINT UNSIGNED NULL COMMENT '中标报价编号，现货为空',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAY' COMMENT 'PENDING_PAY/PAID/IN_PRODUCTION/PENDING_SHIP/SHIPPED/COMPLETED/AFTER_SALE/REFUNDED/CANCELLED',
    active_stock_work_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN order_type = 'STOCK' AND status NOT IN ('CANCELLED', 'REFUNDED') THEN work_id ELSE NULL END) STORED COMMENT '未取消且未退款的现货订单占用唯一作品',
    title_snapshot VARCHAR(30) NOT NULL COMMENT '建单时标题快照',
    total_amount DECIMAL(12,2) NOT NULL COMMENT '唯一成交金额快照，不含运费或平台费',
    duration_days SMALLINT UNSIGNED NULL COMMENT '定制工期快照，现货为空',
    agreement_snapshot JSON NOT NULL COMMENT '原品类名称、材料、规格、方案、图片、条款及定标日期偏差确认快照',
    address_snapshot JSON NOT NULL COMMENT '建单时完整收货地址快照，后续不可覆盖',
    pay_deadline_at DATETIME(3) NOT NULL COMMENT '建单24小时付款截止时间',
    paid_at DATETIME(3) NULL COMMENT '成功支付时间',
    started_at DATETIME(3) NULL COMMENT '实际确认开工时间，仅定制',
    ship_deadline_at DATETIME(3) NULL COMMENT '支付成功时确定的约定发货截止时间',
    tracking_no VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '发货运单号，8至30位字母数字',
    shipped_at DATETIME(3) NULL COMMENT '实际发货时间',
    auto_confirm_at DATETIME(3) NULL COMMENT '自动确认收货时间，售后驳回或撤回可顺延',
    original_completed_at DATETIME(3) NULL COMMENT '最初收货完成时间，不随售后恢复而改写',
    terms_confirmed_at DATETIME(3) NULL COMMENT '买家付款条款确认时间',
    create_request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '买家范围内的建单幂等标识',
    publication_consent_status VARCHAR(24) NOT NULL DEFAULT 'NONE' COMMENT 'NONE/PENDING/APPROVED/REJECTED',
    publication_requested_at DATETIME(3) NULL COMMENT '创作者申请公开成品时间',
    publication_responded_at DATETIME(3) NULL COMMENT '买家按钮回复时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '建单时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_no (order_no),
    UNIQUE KEY uk_order_request (request_id),
    UNIQUE KEY uk_order_quote (quote_id),
    UNIQUE KEY uk_order_active_stock (active_stock_work_id),
    UNIQUE KEY uk_order_create_request (buyer_id, create_request_key),
    KEY idx_order_buyer_list (buyer_id, created_at, id),
    KEY idx_order_creator_list (creator_id, created_at, id),
    KEY idx_order_stock_history (work_id, created_at, id),
    KEY idx_order_payment_timeout (status, pay_deadline_at, id),
    KEY idx_order_shipping_timeout (status, ship_deadline_at, id),
    KEY idx_order_auto_confirm (status, auto_confirm_at, id),
    KEY idx_order_completion (status, original_completed_at, id),
    CONSTRAINT ck_order_type CHECK (order_type IN ('STOCK', 'CUSTOM')),
    CONSTRAINT ck_order_status CHECK (status IN ('PENDING_PAY', 'PAID', 'IN_PRODUCTION', 'PENDING_SHIP', 'SHIPPED', 'COMPLETED', 'AFTER_SALE', 'REFUNDED', 'CANCELLED')),
    CONSTRAINT ck_order_source CHECK ((order_type = 'STOCK' AND work_id IS NOT NULL AND request_id IS NULL AND quote_id IS NULL AND duration_days IS NULL) OR (order_type = 'CUSTOM' AND work_id IS NULL AND request_id IS NOT NULL AND quote_id IS NOT NULL AND duration_days IS NOT NULL AND duration_days BETWEEN 3 AND 180)),
    CONSTRAINT ck_order_stock_path CHECK (order_type <> 'STOCK' OR status NOT IN ('PAID', 'IN_PRODUCTION')),
    CONSTRAINT ck_order_parties_amount CHECK (buyer_id <> creator_id AND total_amount > 0),
    CONSTRAINT ck_order_snapshots CHECK (JSON_TYPE(agreement_snapshot) = 'OBJECT' AND JSON_TYPE(address_snapshot) = 'OBJECT'),
    CONSTRAINT ck_order_publication_status CHECK (publication_consent_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED') AND (order_type = 'CUSTOM' OR publication_consent_status = 'NONE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='现货与定制统一订单及不可变交易快照';

-- 订单制作节点表：保存定制订单固定五个节点的参考计划、处理顺序及当前状态。
CREATE TABLE order_progress_node (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '制作节点编号',
    order_id BIGINT UNSIGNED NOT NULL COMMENT '所属定制订单编号',
    node_code VARCHAR(24) NOT NULL COMMENT 'MATERIAL/SAMPLE/MAKING/QC/SHIPPING',
    sort_order TINYINT UNSIGNED NOT NULL COMMENT '固定顺序1至5',
    planned_finish_date DATE NOT NULL COMMENT '支付成功时确定的初始参考完成日',
    status VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED' COMMENT 'NOT_STARTED/UNLOCKED/CHECKED/SKIPPED',
    handled_at DATETIME(3) NULL COMMENT '实际打卡或跳过时间，根据状态解释',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '支付成功生成节点时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '节点状态更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_node_order_code (order_id, node_code),
    UNIQUE KEY uk_node_order_sort (order_id, sort_order),
    CONSTRAINT ck_node_code_sort CHECK ((node_code = 'MATERIAL' AND sort_order = 1) OR (node_code = 'SAMPLE' AND sort_order = 2) OR (node_code = 'MAKING' AND sort_order = 3) OR (node_code = 'QC' AND sort_order = 4) OR (node_code = 'SHIPPING' AND sort_order = 5)),
    CONSTRAINT ck_node_status CHECK (status IN ('NOT_STARTED', 'UNLOCKED', 'CHECKED', 'SKIPPED')),
    CONSTRAINT ck_node_skip CHECK (status <> 'SKIPPED' OR node_code = 'SAMPLE')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='仅定制订单的固定五个制作节点';

-- 制作进度记录表：追加保存节点首次打卡、跳过及后续图文补充。
CREATE TABLE order_progress_record (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '节点打卡或补充编号',
    node_id BIGINT UNSIGNED NOT NULL COMMENT '制作节点编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '提交创作者编号',
    record_type VARCHAR(24) NOT NULL COMMENT 'CHECKIN首次打卡/SKIP跳过/SUPPLEMENT补充',
    initial_node_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN record_type IN ('CHECKIN', 'SKIP') THEN node_id ELSE NULL END) STORED COMMENT '每节点仅一次初次处理，补充不参与唯一约束',
    content VARCHAR(500) NOT NULL COMMENT '图文说明；打卡至少5字，跳过至少10字',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '实拍文件数组，首次打卡1至6张',
    skip_reason TEXT NULL COMMENT '仅打样跳过时的原因',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '服务器提交时间，记录不可覆盖',
    PRIMARY KEY (id),
    UNIQUE KEY uk_progress_initial_node (initial_node_id),
    KEY idx_progress_node_history (node_id, created_at, id),
    CONSTRAINT ck_progress_record_type CHECK (record_type IN ('CHECKIN', 'SKIP', 'SUPPLEMENT')),
    CONSTRAINT ck_progress_images CHECK (JSON_TYPE(image_ids) = 'ARRAY'),
    CONSTRAINT ck_progress_checkin CHECK (record_type <> 'CHECKIN' OR (CHAR_LENGTH(content) BETWEEN 5 AND 500 AND JSON_LENGTH(image_ids) BETWEEN 1 AND 6)),
    CONSTRAINT ck_progress_skip CHECK (record_type <> 'SKIP' OR (CHAR_LENGTH(content) BETWEEN 10 AND 500 AND skip_reason IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='制作打卡、跳过和不可覆盖的图文补充';

-- 退款申请表：保存全额退款申请、售后前订单状态、退回核查及处理结果。
CREATE TABLE refund_application (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '退款申请编号，每次重新申请新增',
    order_id BIGINT UNSIGNED NOT NULL COMMENT '原订单编号',
    buyer_id BIGINT UNSIGNED NOT NULL COMMENT '申请买家编号',
    application_type VARCHAR(24) NOT NULL COMMENT 'NORMAL普通退款/NO_START_TIMEOUT未开工超时退款',
    original_order_status VARCHAR(24) NOT NULL COMMENT '进入售后前状态，供驳回或撤回恢复',
    reason_code VARCHAR(32) NOT NULL COMMENT '退款原因',
    description VARCHAR(500) NOT NULL COMMENT '申请说明，20至500字',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '初次申请0至3张凭证文件数组',
    status VARCHAR(24) NOT NULL DEFAULT 'WAIT_ADMIN' COMMENT 'WAIT_ADMIN/REFUNDED/REJECTED/WITHDRAWN',
    pending_order_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'WAIT_ADMIN' THEN order_id ELSE NULL END) STORED COMMENT '仅处理中申请参与订单唯一约束',
    return_required TINYINT UNSIGNED NULL COMMENT '是否需退货，空表示尚未判断',
    return_tracking_no VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL COMMENT '退回运单号',
    return_confirmed_at DATETIME(3) NULL COMMENT '管理员核实原成品已退回的时间',
    return_confirmed_by BIGINT UNSIGNED NULL COMMENT '退回核实管理员编号',
    no_return_basis TEXT NULL COMMENT '无需退货依据',
    handler_id BIGINT UNSIGNED NULL COMMENT '处理管理员编号，系统退款为空',
    decision_reason TEXT NULL COMMENT '处理结论、依据或撤回说明',
    finished_at DATETIME(3) NULL COMMENT '本次退款、驳回或撤回结束时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '申请时间，售后占用时长起点',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '处理更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_refund_pending_order (pending_order_id),
    KEY idx_refund_order_history (order_id, created_at, id),
    KEY idx_refund_admin_queue (status, created_at, id),
    CONSTRAINT ck_refund_type CHECK (application_type IN ('NORMAL', 'NO_START_TIMEOUT')),
    CONSTRAINT ck_refund_status CHECK (status IN ('WAIT_ADMIN', 'REFUNDED', 'REJECTED', 'WITHDRAWN')),
    CONSTRAINT ck_refund_original_status CHECK (original_order_status IN ('PAID', 'IN_PRODUCTION', 'PENDING_SHIP', 'SHIPPED', 'COMPLETED')),
    CONSTRAINT ck_refund_description CHECK (CHAR_LENGTH(description) BETWEEN 20 AND 500),
    CONSTRAINT ck_refund_return CHECK (return_required IS NULL OR return_required IN (0, 1)),
    CONSTRAINT ck_refund_images CHECK (JSON_TYPE(image_ids) = 'ARRAY' AND JSON_LENGTH(image_ids) <= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='全额退款申请、售后前状态及退回核查';

-- 退款补充证据表：保存买卖双方为退款申请追加的说明和图片证据。
CREATE TABLE refund_evidence (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '售后补充证据编号',
    refund_application_id BIGINT UNSIGNED NOT NULL COMMENT '退款申请编号',
    submitter_id BIGINT UNSIGNED NOT NULL COMMENT '提交买家或创作者编号',
    content TEXT NULL COMMENT '补充说明，与图片至少一项非空',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '补充证据文件数组，不覆盖原申请',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '追加时间',
    PRIMARY KEY (id),
    KEY idx_refund_evidence_history (refund_application_id, created_at, id),
    CONSTRAINT ck_refund_evidence_images CHECK (JSON_TYPE(image_ids) = 'ARRAY'),
    CONSTRAINT ck_refund_evidence_content CHECK (CHAR_LENGTH(TRIM(COALESCE(content, ''))) > 0 OR JSON_LENGTH(image_ids) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='买卖双方追加的售后说明与证据';

-- 资金流水表：追加保存模拟支付、全额退款和结算的金额、结果及幂等标识。
CREATE TABLE fund_flow (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '资金流水编号',
    flow_no VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '唯一业务流水号',
    order_id BIGINT UNSIGNED NOT NULL COMMENT '订单编号',
    refund_application_id BIGINT UNSIGNED NULL COMMENT '退款对应申请编号，其他类型为空',
    flow_type VARCHAR(24) NOT NULL COMMENT 'PAYMENT/REFUND/SETTLEMENT',
    amount DECIMAL(12,2) NOT NULL COMMENT '本次模拟金额，正数，三类金额均等于订单实付',
    result VARCHAR(24) NOT NULL COMMENT 'SUCCESS/FAILED',
    idempotency_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '应用生成或加命名空间的全局幂等键',
    success_order_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN result = 'SUCCESS' THEN order_id ELSE NULL END) STORED COMMENT '仅成功流水参与每单每类型唯一约束',
    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '模拟动作实际发生时间，流水只追加',
    PRIMARY KEY (id),
    UNIQUE KEY uk_flow_no (flow_no),
    UNIQUE KEY uk_flow_idempotency (idempotency_key),
    UNIQUE KEY uk_flow_success_order_type (success_order_id, flow_type),
    KEY idx_flow_order_history (order_id, occurred_at, id),
    KEY idx_flow_refund_application (refund_application_id, id),
    KEY idx_flow_statistics (result, flow_type, occurred_at, id),
    CONSTRAINT ck_flow_type CHECK (flow_type IN ('PAYMENT', 'REFUND', 'SETTLEMENT')),
    CONSTRAINT ck_flow_result CHECK (result IN ('SUCCESS', 'FAILED')),
    CONSTRAINT ck_flow_amount CHECK (amount > 0),
    CONSTRAINT ck_flow_refund_source CHECK ((flow_type = 'REFUND' AND refund_application_id IS NOT NULL) OR (flow_type <> 'REFUND' AND refund_application_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模拟支付、全额退款和结算只读流水';

-- 订单结算表：保存支付金额、已审核收款账户快照及待结算、已结算或已取消状态。
CREATE TABLE order_settlement (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '结算记录编号',
    order_id BIGINT UNSIGNED NOT NULL COMMENT '订单编号，每单一条',
    paid_amount DECIMAL(12,2) NOT NULL COMMENT '支付金额快照，也为应结算金额，退款不覆盖原值',
    payee_snapshot JSON NOT NULL COMMENT 'real_name明文、alipay_account_ciphertext编码密文及approved_application_id',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING待结算/SETTLED已结算/CANCELLED退款取消待结算',
    settlement_flow_id BIGINT UNSIGNED NULL COMMENT '成功结算流水编号',
    settled_at DATETIME(3) NULL COMMENT '模拟结算时间',
    cancelled_at DATETIME(3) NULL COMMENT '退款取消待结算时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '支付成功时建立记录',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '结算状态更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_settlement_order (order_id),
    UNIQUE KEY uk_settlement_flow (settlement_flow_id),
    KEY idx_settlement_pending (status, order_id),
    CONSTRAINT ck_settlement_status CHECK (status IN ('PENDING', 'SETTLED', 'CANCELLED')),
    CONSTRAINT ck_settlement_amount CHECK (paid_amount > 0),
    CONSTRAINT ck_settlement_payee CHECK (JSON_TYPE(payee_snapshot) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='无抽成的模拟结算和已审核账户快照';

-- 订单评价表：保存买家每单一次的评分、图文评价及管理员治理状态。
CREATE TABLE order_review (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '订单评价编号',
    order_id BIGINT UNSIGNED NOT NULL COMMENT '订单编号，每单一条',
    buyer_id BIGINT UNSIGNED NOT NULL COMMENT '评价买家编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '被评价创作者编号',
    rating TINYINT UNSIGNED NOT NULL COMMENT '总体评分1至5星',
    content VARCHAR(500) NOT NULL COMMENT '评价文字10至500字',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '0至3张评价图片文件数组',
    moderation_status VARCHAR(24) NOT NULL DEFAULT 'VISIBLE' COMMENT 'VISIBLE/HIDDEN/DELETED，删除为逻辑处置',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '买家提交时间，不允许自行修改',
    PRIMARY KEY (id),
    UNIQUE KEY uk_review_order (order_id),
    KEY idx_review_creator (creator_id, moderation_status, created_at, id),
    KEY idx_review_buyer (buyer_id, created_at, id),
    CONSTRAINT ck_review_rating_content CHECK (rating BETWEEN 1 AND 5 AND CHAR_LENGTH(content) BETWEEN 10 AND 500),
    CONSTRAINT ck_review_status CHECK (moderation_status IN ('VISIBLE', 'HIDDEN', 'DELETED')),
    CONSTRAINT ck_review_images CHECK (JSON_TYPE(image_ids) = 'ARRAY' AND JSON_LENGTH(image_ids) <= 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='买家每单一次评价及公开口碑治理状态';

-- 业务会话表：保存需求或订单双方的一对一会话、归档状态及已读游标。
CREATE TABLE conversation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '会话编号',
    buyer_id BIGINT UNSIGNED NOT NULL COMMENT '固定买家编号',
    creator_id BIGINT UNSIGNED NOT NULL COMMENT '固定创作者编号',
    request_id BIGINT UNSIGNED NULL COMMENT '原需求编号，现货会话为空',
    order_id BIGINT UNSIGNED NULL COMMENT '订单编号，中标后关联原会话',
    archived_at DATETIME(3) NULL COMMENT '未成单需求关闭、过期或落选时归档',
    archive_reason VARCHAR(24) NULL COMMENT 'REQUEST_CLOSED/REQUEST_EXPIRED/LOST',
    last_message_seq BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '会话内最新提交消息序号',
    buyer_read_seq BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '买家已读游标，只向前推进',
    creator_read_seq BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '创作者已读游标，只向前推进',
    last_message_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '列表排序时间，无消息时为建立时间',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '建立时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '消息或已读更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_conversation_request_creator (request_id, creator_id),
    UNIQUE KEY uk_conversation_order (order_id),
    KEY idx_conversation_buyer_list (buyer_id, last_message_at, id),
    KEY idx_conversation_creator_list (creator_id, last_message_at, id),
    CONSTRAINT ck_conversation_parties CHECK (buyer_id <> creator_id),
    CONSTRAINT ck_conversation_source CHECK (request_id IS NOT NULL OR order_id IS NOT NULL),
    CONSTRAINT ck_conversation_cursors CHECK (buyer_read_seq <= last_message_seq AND creator_read_seq <= last_message_seq),
    CONSTRAINT ck_conversation_archive CHECK (archive_reason IS NULL OR archive_reason IN ('REQUEST_CLOSED', 'REQUEST_EXPIRED', 'LOST'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='需求与订单一对一会话，终态订单仍可沟通';

-- 会话消息表：保存文字、图片、会话内序号、发送幂等标识及可选制作节点引用。
CREATE TABLE chat_message (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '全局唯一消息编号',
    conversation_id BIGINT UNSIGNED NOT NULL COMMENT '会话编号',
    seq_no BIGINT UNSIGNED NOT NULL COMMENT '会话内从1递增的消息序号',
    sender_id BIGINT UNSIGNED NOT NULL COMMENT '发送用户编号，来自登录凭证',
    client_message_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '发送账号范围内的客户端幂等标识',
    content VARCHAR(500) NULL COMMENT '1至500字文字，允许纯图片',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '0至3张消息图片文件数组',
    referenced_node_id BIGINT UNSIGNED NULL COMMENT '选填本订单制作节点引用',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '服务器持久化时间，提交后推送',
    PRIMARY KEY (id),
    UNIQUE KEY uk_message_conversation_seq (conversation_id, seq_no),
    UNIQUE KEY uk_message_sender_request (sender_id, client_message_key),
    KEY idx_message_unread (conversation_id, sender_id, seq_no),
    CONSTRAINT ck_message_sequence CHECK (seq_no > 0),
    CONSTRAINT ck_message_images CHECK (JSON_TYPE(image_ids) = 'ARRAY' AND JSON_LENGTH(image_ids) <= 3),
    CONSTRAINT ck_message_content CHECK (CHAR_LENGTH(TRIM(COALESCE(content, ''))) > 0 OR JSON_LENGTH(image_ids) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='持久化聊天消息和可选节点引用';

-- 系统通知表：保存业务事件通知、接收人、跳转引用及已读状态。
CREATE TABLE system_notification (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '通知编号',
    recipient_id BIGINT UNSIGNED NOT NULL COMMENT '接收用户编号',
    event_type VARCHAR(50) NOT NULL COMMENT '审核、报价、订单、超期、授权等业务事件类型',
    event_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT '接收人范围内的业务事件去重键',
    title VARCHAR(100) NOT NULL COMMENT '通知标题',
    content TEXT NOT NULL COMMENT '通知内容，按接收人控制敏感信息',
    business_reference JSON NOT NULL COMMENT '业务对象及跳转引用，跳转仍须鉴权',
    read_at DATETIME(3) NULL COMMENT '服务器已读时间，多端共用',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '业务事务内创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_notification_event (recipient_id, event_key),
    KEY idx_notification_user_list (recipient_id, created_at, id),
    KEY idx_notification_unread (recipient_id, read_at, id),
    CONSTRAINT ck_notification_reference CHECK (JSON_TYPE(business_reference) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='不可回复的持久化系统通知';

-- 内容举报表：保存作品、评论、评价及创作者主页的举报和当前处理结论。
CREATE TABLE report (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '举报编号',
    reporter_id BIGINT UNSIGNED NOT NULL COMMENT '举报用户编号',
    target_type VARCHAR(24) NOT NULL COMMENT 'WORK/COMMENT/REVIEW/CREATOR_PROFILE',
    target_id BIGINT UNSIGNED NOT NULL COMMENT '被举报作品、评论、评价或创作者用户编号',
    reason_code VARCHAR(32) NOT NULL COMMENT '举报理由',
    description TEXT NULL COMMENT '初次举报说明，说明或图片至少一项非空',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '初次举报证据文件数组',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING待处理/PROCESSED已处理',
    pending_reporter_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'PENDING' THEN reporter_id ELSE NULL END) STORED COMMENT '仅待处理举报参与同用户同对象唯一约束',
    latest_result VARCHAR(24) NULL COMMENT 'NOT_UPHELD不成立/ACTION_TAKEN采取处置',
    handler_id BIGINT UNSIGNED NULL COMMENT '最近处理管理员编号',
    last_processed_at DATETIME(3) NULL COMMENT '最近处理时间，历次结论保存在操作日志',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '初次提交时间',
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最新处理更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_report_pending_target (pending_reporter_id, target_type, target_id),
    KEY idx_report_admin_queue (status, created_at, id),
    KEY idx_report_reporter_history (reporter_id, created_at, id),
    KEY idx_report_target_history (target_type, target_id, created_at, id),
    CONSTRAINT ck_report_target_type CHECK (target_type IN ('WORK', 'COMMENT', 'REVIEW', 'CREATOR_PROFILE')),
    CONSTRAINT ck_report_status CHECK (status IN ('PENDING', 'PROCESSED')),
    CONSTRAINT ck_report_result CHECK (latest_result IS NULL OR latest_result IN ('NOT_UPHELD', 'ACTION_TAKEN')),
    CONSTRAINT ck_report_images CHECK (JSON_TYPE(image_ids) = 'ARRAY'),
    CONSTRAINT ck_report_content CHECK (CHAR_LENGTH(TRIM(COALESCE(description, ''))) > 0 OR JSON_LENGTH(image_ids) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='人工举报及当前结论，重复处理中举报合并补充';

-- 举报补充证据表：追加保存举报补证和针对处置结果提出的异议。
CREATE TABLE report_evidence (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '举报补充或异议编号',
    report_id BIGINT UNSIGNED NOT NULL COMMENT '举报编号',
    submitter_id BIGINT UNSIGNED NOT NULL COMMENT '有权补证或提出异议的用户编号',
    evidence_type VARCHAR(24) NOT NULL COMMENT 'SUPPLEMENT补充/OBJECTION处置异议',
    content TEXT NULL COMMENT '补充或异议说明',
    image_ids JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '证据文件数组',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '提交时间，记录只追加',
    PRIMARY KEY (id),
    KEY idx_report_evidence_history (report_id, created_at, id),
    CONSTRAINT ck_report_evidence_type CHECK (evidence_type IN ('SUPPLEMENT', 'OBJECTION')),
    CONSTRAINT ck_report_evidence_images CHECK (JSON_TYPE(image_ids) = 'ARRAY'),
    CONSTRAINT ck_report_evidence_content CHECK (CHAR_LENGTH(TRIM(COALESCE(content, ''))) > 0 OR JSON_LENGTH(image_ids) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='举报补证与处置异议，不覆盖初始证据';

-- 业务操作日志表：追加保存重要操作、审核与治理依据，以及必要的历史快照。
CREATE TABLE operation_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '操作记录编号',
    operator_id BIGINT UNSIGNED NULL COMMENT '操作用户编号，系统操作为空',
    operator_type VARCHAR(16) NOT NULL COMMENT 'USER/ADMIN/SYSTEM',
    target_type VARCHAR(50) NOT NULL COMMENT '业务对象类型',
    target_id BIGINT UNSIGNED NOT NULL COMMENT '业务对象编号',
    action VARCHAR(50) NOT NULL COMMENT '审核、修改、上下架、暂停、恢复、退款、授权等动作',
    before_status VARCHAR(24) NULL COMMENT '变更前状态',
    after_status VARCHAR(24) NULL COMMENT '变更后状态',
    reason TEXT NULL COMMENT '原因、依据和处理说明',
    detail JSON NOT NULL COMMENT '必要的前后值和内容快照，不写密码或明文收款账号',
    result VARCHAR(24) NOT NULL COMMENT 'SUCCESS/FAILED',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '发生时间，只追加不覆盖',
    PRIMARY KEY (id),
    KEY idx_operation_target_history (target_type, target_id, created_at, id),
    KEY idx_operation_operator_history (operator_id, created_at, id),
    CONSTRAINT ck_operation_operator CHECK (operator_type IN ('USER', 'ADMIN', 'SYSTEM') AND ((operator_type = 'SYSTEM' AND operator_id IS NULL) OR (operator_type <> 'SYSTEM' AND operator_id IS NOT NULL))),
    CONSTRAINT ck_operation_result CHECK (result IN ('SUCCESS', 'FAILED')),
    CONSTRAINT ck_operation_detail CHECK (JSON_TYPE(detail) = 'OBJECT')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='重要业务动作、审核和历史快照，只追加';
