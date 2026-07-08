CREATE TABLE site_posts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('POST', 'CAROUSEL') NOT NULL DEFAULT 'POST',
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,
  body TEXT NULL,
  image_key VARCHAR(512) NULL,
  cta_label VARCHAR(120) NULL,
  cta_href VARCHAR(512) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at DATETIME NULL,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_site_posts_type (type),
  INDEX idx_site_posts_active (active),
  INDEX idx_site_posts_sort (sort_order)
);
