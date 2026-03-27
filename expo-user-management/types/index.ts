export interface Category {
  id: string
  name: string
  icon: string
  color: string
  is_system: boolean
}

export interface Account {
  id: string
  user_id: string
  plaid_account_id: string | null
  name: string
  type: 'checking' | 'savings' | 'credit'
  balance: number
  institution: string | null
  last_synced: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  plaid_tx_id: string | null
  date: string
  amount: number
  merchant_name: string
  notes: string | null
  receipt_url: string | null
  deleted_at: string | null
  created_at: string
  category?: Category
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  monthly_limit: number
  rollover: boolean
  alert_at_pct: number
  period_start: string
  created_at: string
  category?: Category
  spent?: number
}

export interface SavingsGoal {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  target_date: string
  created_at: string
}

// Navigation param lists
export type AuthStackParamList = {
  Login: undefined
  Register: undefined
  ForgotPassword: undefined
}

export type MainTabParamList = {
  Dashboard: undefined
  Transactions: undefined
  Budgets: undefined
  Analytics: undefined
  Settings: undefined
}

export type TransactionStackParamList = {
  TransactionList: undefined
  AddTransaction: { transaction?: Transaction }
}

export type BudgetStackParamList = {
  BudgetList: undefined
  AddBudget: { budget?: Budget }
}
