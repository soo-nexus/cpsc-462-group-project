-- =====================================================
-- FINANCIAL STATEMENTS SCHEMA
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Income Categories (user-defined + defaults)
CREATE TABLE finance_income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- 2. Income Records
CREATE TABLE finance_income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  received_on DATE NOT NULL,
  category_name TEXT,
  note TEXT,
  recurring BOOLEAN DEFAULT FALSE,
  plaid_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Accounts Receivable / IOUs (money people owe you)
CREATE TABLE finance_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  asset_type TEXT DEFAULT 'accounts_receivable',
  due_date DATE,
  description TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_on DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Liabilities (money you owe)
CREATE TABLE finance_liabilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  liability_type TEXT NOT NULL,
  due_date DATE,
  description TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_on DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Plaid Income Mapping (remembers merchant -> category)
CREATE TABLE finance_plaid_income_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_merchant_name TEXT NOT NULL,
  income_category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plaid_merchant_name)
);

-- =====================================================
-- DEFAULT INCOME CATEGORIES
-- =====================================================
INSERT INTO finance_income_categories (name, is_default) VALUES
  ('Salary', TRUE),
  ('Freelance', TRUE),
  ('Investments', TRUE),
  ('Gifts', TRUE),
  ('Accounts Receivable', TRUE),
  ('Uncategorized', TRUE);

-- =====================================================
-- RLS POLICIES (same as existing tables)
-- =====================================================
ALTER TABLE finance_income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_plaid_income_mapping ENABLE ROW LEVEL SECURITY;

-- Policies for income_categories
CREATE POLICY "Users can manage their own income categories" ON finance_income_categories
  FOR ALL USING (auth.uid() = user_id);

-- Policies for income
CREATE POLICY "Users can manage their own income" ON finance_income
  FOR ALL USING (auth.uid() = user_id);

-- Policies for assets
CREATE POLICY "Users can manage their own assets" ON finance_assets
  FOR ALL USING (auth.uid() = user_id);

-- Policies for liabilities
CREATE POLICY "Users can manage their own liabilities" ON finance_liabilities
  FOR ALL USING (auth.uid() = user_id);

-- Policies for plaid_income_mapping
CREATE POLICY "Users can manage their own plaid mappings" ON finance_plaid_income_mapping
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES (for performance)
-- =====================================================
CREATE INDEX idx_income_user_received ON finance_income(user_id, received_on);
CREATE INDEX idx_assets_user ON finance_assets(user_id, is_paid);
CREATE INDEX idx_liabilities_user ON finance_liabilities(user_id, is_paid);