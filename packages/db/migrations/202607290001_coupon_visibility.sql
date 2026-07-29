-- Coupon visibility: show in list + optional selected-user targeting
-- Compatible with MySQL versions that do NOT support ADD COLUMN IF NOT EXISTS
USE `Magazine`;

-- showToUsers
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'coupons'
    AND COLUMN_NAME = 'showToUsers'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `coupons` ADD COLUMN `showToUsers` TINYINT(1) NOT NULL DEFAULT 1 AFTER `active`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- restrictToUsers
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'coupons'
    AND COLUMN_NAME = 'restrictToUsers'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `coupons` ADD COLUMN `restrictToUsers` TINYINT(1) NOT NULL DEFAULT 0 AFTER `showToUsers`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `coupon_user_assignments` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `couponId` BIGINT NOT NULL,
  `userId` BIGINT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_user_assignments_coupon_user_unique` (`couponId`, `userId`),
  INDEX `coupon_user_assignments_couponId_idx` (`couponId`),
  INDEX `coupon_user_assignments_userId_idx` (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
