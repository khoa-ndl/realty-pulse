create table issues (
  id uuid primary key default gen_random_uuid(),
  html text not null,
  trigger_type text not null check (trigger_type in ('scheduled', 'manual')),
  market_summary text not null,
  listings jsonb not null,
  created_at timestamptz not null default now()
);

alter table issues enable row level security;
