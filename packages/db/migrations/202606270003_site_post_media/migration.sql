CREATE TABLE site_post_media (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT NOT NULL,
  media_type ENUM('IMAGE', 'VIDEO') NOT NULL DEFAULT 'IMAGE',
  media_key VARCHAR(512) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_site_post_media_post (post_id),
  INDEX idx_site_post_media_sort (sort_order),
  FOREIGN KEY (post_id) REFERENCES site_posts(id) ON DELETE CASCADE
);
