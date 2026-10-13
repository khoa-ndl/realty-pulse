alter table subscribers add column confirmed_at timestamptz;
alter table subscribers add column confirmation_token text;
create unique index subscribers_confirmation_token_key on subscribers (confirmation_token) where confirmation_token is not null;

-- Every subscriber added before this migration came through the trusted
-- admin-dashboard path — treat them as already confirmed, not pending.
update subscribers set confirmed_at = subscribed_at where confirmed_at is null;

alter table subscribers alter column confirmed_at set default now();
