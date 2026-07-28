-- Email Configuration (singleton row id=1)
-- Used as the ONLY sender mailbox for all system emails (subscribe / purchase, etc.).
-- Insert once; Admin → Email Settings only UPDATEs this row.
USE `Magazine`;

CREATE TABLE IF NOT EXISTS `email_settings` (
  `id` BIGINT NOT NULL PRIMARY KEY DEFAULT 1,
  `email_id` VARCHAR(255) NOT NULL COMMENT 'Sender Email ID (SMTP login + From address)',
  `smtp_pass` VARCHAR(512) NULL COMMENT 'Mailbox password',
  `smtp_host` VARCHAR(255) NOT NULL DEFAULT 'smtp.hostinger.com',
  `smtp_port` INT NOT NULL DEFAULT 587,
  `smtp_tls` TINYINT(1) NOT NULL DEFAULT 1,
  `imap_host` VARCHAR(255) NOT NULL DEFAULT 'imap.hostinger.com',
  `imap_port` INT NOT NULL DEFAULT 993,
  `imap_ssl` TINYINT(1) NOT NULL DEFAULT 1,
  `from_name` VARCHAR(255) NOT NULL DEFAULT 'VidhyaVibe',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

-- One-time seed (password left empty — set via Admin → Email Settings)
INSERT INTO `email_settings` (
  `id`,
  `email_id`,
  `smtp_pass`,
  `smtp_host`,
  `smtp_port`,
  `smtp_tls`,
  `imap_host`,
  `imap_port`,
  `imap_ssl`,
  `from_name`
) VALUES (
  1,
  'support@vidhyavibe.in',
  NULL,
  'smtp.hostinger.com',
  587,
  1,
  'imap.hostinger.com',
  993,
  1,
  'VidhyaVibe'
)
ON DUPLICATE KEY UPDATE
  `id` = `id`;
