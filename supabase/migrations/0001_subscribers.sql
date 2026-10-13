create table subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
