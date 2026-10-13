create table subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

-- No policies are defined: the app only ever accesses this table through
-- the service role key (which bypasses RLS), never the anon key. This just
-- blocks the public/anon role from reading or writing it directly.
alter table subscribers enable row level security;
