-- Snapshot of guest checkout contact details on each order (purchase history)
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `guest_name` VARCHAR(255) NULL AFTER `magazine_id`,
  ADD COLUMN IF NOT EXISTS `guest_email` VARCHAR(255) NULL AFTER `guest_name`,
  ADD COLUMN IF NOT EXISTS `guest_phone` VARCHAR(50) NULL AFTER `guest_email`;
