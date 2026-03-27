-- ============================================================
-- Expense Tracker — Initial Schema
-- Run this in the Supabase SQL Editor to bootstrap the project
-- ============================================================

-- Categories (system-wide, readable by all)
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text not null default '📦',
  color text not null default '#6B7280',
  is_system boolean default false,
  created_at timestamptz default now()
);

-- User profiles (1-to-1 with auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  currency text default 'USD',
  created_at timestamptz default now()
);

-- Bank / cash accounts
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plaid_account_id text unique,
  name text not null,
  type text check (type in ('checking', 'savings', 'credit')) default 'checking',
  balance numeric(12, 2) default 0,
  institution text,
  last_synced timestamptz,
  created_at timestamptz default now()
);

-- Transactions
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references accounts(id) on delete set null,
  category_id uuid references categories(id) on delete set null,
  plaid_tx_id text unique,
  date date not null default current_date,
  amount numeric(12, 2) not null,
  merchant_name text not null,
  notes text,
  receipt_url text,
  deleted_at timestamptz,          -- soft-delete: 30-day undo window
  created_at timestamptz default now()
);

-- Monthly budgets per category
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  monthly_limit numeric(12, 2) not null,
  rollover boolean default false,
  alert_at_pct integer default 80 check (alert_at_pct between 1 and 100),
  period_start date default date_trunc('month', current_date)::date,
  created_at timestamptz default now(),
  unique(user_id, category_id)
);

-- Savings goals
create table if not exists savings_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  target_amount numeric(12, 2) not null,
  current_amount numeric(12, 2) default 0,
  target_date date not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table savings_goals enable row level security;

-- Categories: read-only for all (system categories), write only for custom ones
alter table categories enable row level security;
create policy "Anyone can view categories"
  on categories for select using (true);
create policy "Non-system categories can be inserted"
  on categories for insert with check (not is_system);

-- Profiles
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Accounts, transactions, budgets, savings_goals — full CRUD for owner
create policy "Users can CRUD own accounts"
  on accounts for all using (auth.uid() = user_id);
create policy "Users can CRUD own transactions"
  on transactions for all using (auth.uid() = user_id);
create policy "Users can CRUD own budgets"
  on budgets for all using (auth.uid() = user_id);
create policy "Users can CRUD own savings_goals"
  on savings_goals for all using (auth.uid() = user_id);

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- Seed: system categories
-- ============================================================
insert into categories (name, icon, color, is_system) values
  ('Food & Dining',    '🍔', '#F59E0B', true),
  ('Transport',        '🚗', '#3B82F6', true),
  ('Entertainment',    '🎬', '#8B5CF6', true),
  ('Shopping',         '🛍️', '#EC4899', true),
  ('Bills & Utilities','💡', '#10B981', true),
  ('Health',           '💊', '#EF4444', true),
  ('Travel',           '✈️', '#06B6D4', true),
  ('Education',        '📚', '#F97316', true),
  ('Savings',          '💰', '#84CC16', true),
  ('Other',            '📦', '#6B7280', true)
on conflict do nothing;
