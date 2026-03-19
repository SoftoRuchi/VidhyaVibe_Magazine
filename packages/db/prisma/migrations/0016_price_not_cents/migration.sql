-- Switch subscription plan pricing fields from cents to direct price
-- subscription_plans: price_cents -> price
ALTER TABLE subscription_plans
  CHANGE COLUMN price_cents price INT NOT NULL;

-- user_subscriptions: price_cents -> price
ALTER TABLE user_subscriptions
  CHANGE COLUMN price_cents price INT NOT NULL;

-- magazine_plans: price_cents -> price
ALTER TABLE magazine_plans
  CHANGE COLUMN price_cents price INT NOT NULL;

