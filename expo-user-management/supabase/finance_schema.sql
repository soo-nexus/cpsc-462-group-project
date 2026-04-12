-- Non-destructive finance schema bootstrap.
-- This file only creates missing finance objects and never drops or rewrites
-- existing tables, columns, indexes, or policies.
--
-- I could not fully introspect the live schema from this workspace because the
-- available Supabase key is a publishable key, and Supabase blocks schema
-- discovery through the Data API without a secret key.
--
-- Before running this against production, you can optionally inspect existing
-- public tables in the Supabase SQL editor with:
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;

create extension if not exists pgcrypto;

create table if not exists public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_name text not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
  color text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  spent_on date not null default current_date,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.finance_expenses
  add column if not exists source text;

alter table if exists public.finance_expenses
  add column if not exists source_transaction_id text;

alter table if exists public.finance_expenses
  add column if not exists merchant_name text;

alter table if exists public.finance_expenses
  add column if not exists pending boolean default false;

alter table if exists public.finance_expenses
  add column if not exists sync_updated_at timestamptz;

alter table if exists public.finance_expenses
  add column if not exists plaid_item_id text;

alter table if exists public.finance_expenses
  add column if not exists pending_transaction_id text;

alter table if exists public.finance_expenses
  add column if not exists removed_at timestamptz;

create table if not exists public.finance_plaid_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plaid_item_id text not null,
  access_token text not null,
  institution_name text,
  cursor text,
  last_sync_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create table if not exists public.finance_transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_id uuid not null references public.finance_expenses (id) on delete cascade,
  category_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  note text,
  position integer not null,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists finance_budgets_user_id_idx
  on public.finance_budgets (user_id);

create index if not exists finance_expenses_user_id_spent_on_idx
  on public.finance_expenses (user_id, spent_on desc);

create index if not exists finance_expenses_source_transaction_idx
  on public.finance_expenses (source_transaction_id);

create unique index if not exists finance_expenses_user_source_txn_idx
  on public.finance_expenses (user_id, source_transaction_id)
  where source_transaction_id is not null;

create unique index if not exists finance_plaid_items_user_item_idx
  on public.finance_plaid_items (user_id, plaid_item_id);

create index if not exists finance_plaid_items_user_idx
  on public.finance_plaid_items (user_id)
  where revoked_at is null;

create index if not exists finance_transaction_splits_expense_idx
  on public.finance_transaction_splits (expense_id)
  where deleted_at is null;

create unique index if not exists finance_transaction_splits_active_position_idx
  on public.finance_transaction_splits (expense_id, position)
  where deleted_at is null;

alter table if exists public.finance_budgets enable row level security;
alter table if exists public.finance_expenses enable row level security;
alter table if exists public.finance_plaid_items enable row level security;
alter table if exists public.finance_transaction_splits enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'finance_budgets'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_budgets'
      and policyname = 'finance budgets are private'
  ) then
    create policy "finance budgets are private"
      on public.finance_budgets
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'finance_plaid_items'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_plaid_items'
      and policyname = 'finance plaid items are private'
  ) then
    create policy "finance plaid items are private"
      on public.finance_plaid_items
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'finance_transaction_splits'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_transaction_splits'
      and policyname = 'finance transaction splits are private'
  ) then
    create policy "finance transaction splits are private"
      on public.finance_transaction_splits
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'finance_expenses'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expenses'
      and policyname = 'finance expenses are private'
  ) then
    create policy "finance expenses are private"
      on public.finance_expenses
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
