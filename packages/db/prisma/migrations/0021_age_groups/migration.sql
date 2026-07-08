-- Age groups for magazine categorization (admin-managed)
CREATE TABLE IF NOT EXISTS `age_groups` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `minAge` INT NULL,
  `maxAge` INT NULL,
  `color` VARCHAR(32) NULL DEFAULT '#4ECDC4',
  `sortOrder` INT NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `age_groups_slug_key` (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `magazines`
  ADD COLUMN `age_group_id` BIGINT NULL,
  ADD INDEX `magazines_age_group_id_idx` (`age_group_id`),
  ADD CONSTRAINT `magazines_age_group_id_fkey`
    FOREIGN KEY (`age_group_id`) REFERENCES `age_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default age groups (matches previous hardcoded values)
INSERT INTO `age_groups` (`name`, `slug`, `minAge`, `maxAge`, `color`, `sortOrder`, `active`) VALUES
  ('8-11', '8-11', 8, 11, '#FF6B6B', 1, true),
  ('12-14', '12-14', 12, 14, '#4ECDC4', 2, true),
  ('15-16', '15-16', 15, 16, '#FFE66D', 3, true),
  ('17-18', '17-18', 17, 18, '#1A535C', 4, true);

-- Link existing magazines where category matches an age group slug
UPDATE `magazines` m
JOIN `age_groups` ag ON ag.slug = m.category
SET m.age_group_id = ag.id
WHERE m.category IS NOT NULL AND m.category != '';
