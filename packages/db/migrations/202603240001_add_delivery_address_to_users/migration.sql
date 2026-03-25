-- AlterTable
ALTER TABLE `users`
  ADD COLUMN `deliveryAddress` VARCHAR(512) NULL AFTER `phone`;
