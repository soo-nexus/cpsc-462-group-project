# Supabase Edge Functions Setup

## Edge Functions Created

1. **plaid-link-token** - Creates a Plaid Link token for initializing the Plaid Link flow
2. **plaid-exchange-public-token** - Exchanges the public token for an access token and stores it
3. **plaid-sync-transactions** - Syncs transactions from Plaid to your database

## Database Schema Required

You'll need to create these tables in your Supabase database:

```sql
-- Plaid Items (Connected Bank Accounts)
CREATE TABLE plaid_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  institution_id TEXT,
  transactions_cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plaid Accounts
CREATE TABLE plaid_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  account_id TEXT UNIQUE NOT NULL,
  name TEXT,
  mask TEXT,
  type TEXT,
  subtype TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES plaid_items(item_id) ON DELETE CASCADE,
  account_id TEXT,
  transaction_id TEXT UNIQUE NOT NULL,
  amount DECIMAL(10, 2),
  date DATE,
  name TEXT,
  merchant_name TEXT,
  category TEXT[],
  pending BOOLEAN,
  payment_channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_accounts_user_id ON plaid_accounts(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);

-- Row Level Security (RLS)
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own plaid items"
  ON plaid_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own accounts"
  ON plaid_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);
```

## Deploy Edge Functions

1. Install Supabase CLI if you haven't already:
   ```bash
   brew install supabase/tap/supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Set environment secrets:
   ```bash
   supabase secrets set PLAID_CLIENT_ID=your_client_id
   supabase secrets set PLAID_SECRET=your_secret
   supabase secrets set PLAID_ENV=sandbox
   ```

5. Deploy all functions:
   ```bash
   supabase functions deploy plaid-link-token
   supabase functions deploy plaid-exchange-public-token
   supabase functions deploy plaid-sync-transactions
   ```

## Usage in Your App

```typescript
// 1. Get link token
const { data } = await supabase.functions.invoke('plaid-link-token')
const { link_token } = data

// 2. After Plaid Link completes, exchange the public token
await supabase.functions.invoke('plaid-exchange-public-token', {
  body: {
    public_token: 'public-token-from-plaid',
    institution_id: 'ins_123',
    accounts: plaidAccounts,
  },
})

// 3. Sync transactions
await supabase.functions.invoke('plaid-sync-transactions')
```
