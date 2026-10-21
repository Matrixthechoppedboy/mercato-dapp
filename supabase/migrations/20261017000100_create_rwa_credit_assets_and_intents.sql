-- Additive migration for RWA Credit Assets and Transaction Intents (Issue #246)

-- Canonical RWA Credit Assets table
create table if not exists public.credit_assets (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade unique,
  asset_id text not null unique,
  contract_id text not null,
  token text not null,
  token_decimals integer not null default 7,
  target_principal numeric not null,
  supplier text not null,
  fee_recipient text not null,
  excess_recipient text not null,
  funding_fee_bps integer not null default 100,
  fee_policy_version integer not null default 1,
  deadline timestamptz not null,
  lifecycle text not null default 'Open' check (lifecycle in ('Open', 'Settled', 'Cancelled')),
  funding_pool text,
  issuance_tx_hash text not null,
  issuance_ledger bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RWA Transaction Intents and Attempts (tracks idempotency and recovery)
create table if not exists public.rwa_transaction_intents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  intent_type text not null default 'issuance',
  asset_id text not null,
  status text not null default 'prepared' check (status in ('prepared', 'submitted', 'unknown', 'confirmed', 'failed')),
  admin_user_id uuid references public.profiles (id),
  signing_wallet text not null,
  contract_id text not null,
  method text not null default 'register_asset',
  network text not null default 'testnet',
  network_passphrase text not null,
  reviewed_payload_commitment text not null,
  terms_payload jsonb not null,
  unsigned_xdr text,
  signed_xdr text,
  tx_hash text,
  ledger bigint,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credit_assets enable row level security;
alter table public.rwa_transaction_intents enable row level security;

-- Admin policies for credit_assets
drop policy if exists credit_assets_select_admin on public.credit_assets;
create policy credit_assets_select_admin
  on public.credit_assets for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

drop policy if exists credit_assets_insert_admin on public.credit_assets;
create policy credit_assets_insert_admin
  on public.credit_assets for insert
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

drop policy if exists credit_assets_update_admin on public.credit_assets;
create policy credit_assets_update_admin
  on public.credit_assets for update
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

-- Admin policies for rwa_transaction_intents
drop policy if exists rwa_transaction_intents_select_admin on public.rwa_transaction_intents;
create policy rwa_transaction_intents_select_admin
  on public.rwa_transaction_intents for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

drop policy if exists rwa_transaction_intents_insert_admin on public.rwa_transaction_intents;
create policy rwa_transaction_intents_insert_admin
  on public.rwa_transaction_intents for insert
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

drop policy if exists rwa_transaction_intents_update_admin on public.rwa_transaction_intents;
create policy rwa_transaction_intents_update_admin
  on public.rwa_transaction_intents for update
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.user_type = 'admin')
  );

create index if not exists idx_credit_assets_deal on public.credit_assets (deal_id);
create index if not exists idx_credit_assets_asset on public.credit_assets (asset_id);
create index if not exists idx_rwa_intents_deal on public.rwa_transaction_intents (deal_id, created_at desc);
create index if not exists idx_rwa_intents_asset on public.rwa_transaction_intents (asset_id);
create index if not exists idx_rwa_intents_tx on public.rwa_transaction_intents (tx_hash);
