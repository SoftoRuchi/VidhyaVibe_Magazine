-- One-time login OTPs (password is never changed)
USE `Magazine`;

CREATE TABLE IF NOT EXISTS `login_otps` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `user_id` BIGINT NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `otp_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `idx_login_otps_email` (`email`),
  INDEX `idx_login_otps_user` (`user_id`)
);
