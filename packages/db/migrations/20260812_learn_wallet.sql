-- Learn activity points wallet (earn from activities, spend in financial literacy)

CREATE TABLE IF NOT EXISTS learn_wallets (
  user_id BIGINT NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT learn_wallets_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_wallet_ledger (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  entry_type VARCHAR(32) NOT NULL,
  activity_id BIGINT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY learn_wallet_ledger_user_idx (user_id),
  KEY learn_wallet_ledger_activity_idx (activity_id),
  CONSTRAINT learn_wallet_ledger_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT learn_wallet_ledger_activity_fk FOREIGN KEY (activity_id) REFERENCES learn_activities(id) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
