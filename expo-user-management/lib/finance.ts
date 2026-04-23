import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import { supabase } from './supabase'

dayjs.extend(quarterOfYear)

export const DEFAULT_BUDGET_CATEGORIES = [
  { name: 'Food', color: '#F97316' },
  { name: 'Utilities', color: '#0EA5E9' },
  { name: 'Rent', color: '#6366F1' },
  { name: 'Gifts', color: '#EC4899' },
  { name: 'Fun Money', color: '#14B8A6' },
] as const

export type BudgetRecord = {
  id: string
  user_id: string
  category_name: string
  monthly_limit: number
  color: string | null
  created_at: string
}

export type ExpenseRecord = {
  id: string
  user_id: string
  category_name: string
  amount: number
  note: string | null
  spent_on: string
  created_at: string
  source?: string | null
  source_transaction_id?: string | null
  merchant_name?: string | null
  pending?: boolean | null
  sync_updated_at?: string | null
  plaid_item_id?: string | null
  pending_transaction_id?: string | null
  removed_at?: string | null
}

export type TransactionSplitRecord = {
  id: string
  user_id: string
  expense_id: string
  category_name: string
  amount: number
  note: string | null
  position: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type SplitInput = {
  categoryName: string
  amount: number
  note?: string
  position: number
}

export type EffectiveExpenseAllocation = {
  id: string
  source_expense_id: string
  category_name: string
  amount: number
  note: string | null
  spent_on: string
  is_split: boolean
}

export type ChartPeriod = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly'

type QueryResult<T> = Promise<T[]>

export async function fetchBudgets(userId: string): QueryResult<BudgetRecord> {
  const { data, error } = await supabase
    .from('finance_budgets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as BudgetRecord[]
}

export async function fetchExpenses(userId: string): QueryResult<ExpenseRecord> {
  const { data, error } = await supabase
    .from('finance_expenses')
    .select('*')
    .eq('user_id', userId)
    .is('removed_at', null)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as ExpenseRecord[]
}

export async function fetchTransactionSplits(userId: string): QueryResult<TransactionSplitRecord> {
  const { data, error } = await supabase
    .from('finance_transaction_splits')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('position', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as TransactionSplitRecord[]
}

export async function createBudget(input: {
  userId: string
  categoryName: string
  monthlyLimit: number
  color?: string
}) {
  const { data, error } = await supabase
    .from('finance_budgets')
    .insert({
      user_id: input.userId,
      category_name: input.categoryName.trim(),
      monthly_limit: input.monthlyLimit,
      color: input.color ?? null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as BudgetRecord
}

export async function createExpense(input: {
  userId: string
  categoryName: string
  amount: number
  note?: string
  spentOn?: string
  source?: string
  sourceTransactionId?: string
  merchantName?: string
  pending?: boolean
}) {
  const { data, error } = await supabase
    .from('finance_expenses')
    .insert({
      user_id: input.userId,
      category_name: input.categoryName.trim(),
      amount: input.amount,
      note: input.note?.trim() || null,
      spent_on: input.spentOn ?? dayjs().format('YYYY-MM-DD'),
      source: input.source ?? 'manual',
      source_transaction_id: input.sourceTransactionId ?? null,
      merchant_name: input.merchantName ?? null,
      pending: input.pending ?? false,
      sync_updated_at: input.source ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as ExpenseRecord
}

export async function saveTransactionSplits(input: {
  userId: string
  expenseId: string
  expenseAmount: number
  splits: SplitInput[]
}) {
  validateSplitPayload(input.splits, input.expenseAmount)

  const { error: softDeleteError } = await supabase
    .from('finance_transaction_splits')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .eq('expense_id', input.expenseId)
    .is('deleted_at', null)

  if (softDeleteError) {
    throw softDeleteError
  }

  const { error } = await supabase.from('finance_transaction_splits').insert(
    input.splits.map((split) => ({
      user_id: input.userId,
      expense_id: input.expenseId,
      category_name: split.categoryName.trim(),
      amount: split.amount,
      note: split.note?.trim() || null,
      position: split.position,
    }))
  )

  if (error) {
    throw error
  }
}

export async function deleteTransactionSplits(input: {
  userId: string
  expenseId: string
}) {
  const { error } = await supabase
    .from('finance_transaction_splits')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .eq('expense_id', input.expenseId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }
}

export async function seedFinanceDemoData(userId: string) {
  const existingBudgets = await fetchBudgets(userId)
  const existingExpenses = await fetchExpenses(userId)

  if (existingBudgets.length === 0) {
    const sampleBudgets = [
      { category_name: 'Food', monthly_limit: 650, color: getCategoryColor('Food') },
      { category_name: 'Utilities', monthly_limit: 320, color: getCategoryColor('Utilities') },
      { category_name: 'Rent', monthly_limit: 1800, color: getCategoryColor('Rent') },
      { category_name: 'Gifts', monthly_limit: 200, color: getCategoryColor('Gifts') },
      { category_name: 'Fun Money', monthly_limit: 350, color: getCategoryColor('Fun Money') },
    ]

    const { error } = await supabase.from('finance_budgets').insert(
      sampleBudgets.map((budget) => ({
        user_id: userId,
        ...budget,
      }))
    )

    if (error) {
      throw error
    }
  }

  if (existingExpenses.length === 0) {
    const sampleExpenses = [
      ['Rent', 1800, 'April rent', dayjs().startOf('month').format('YYYY-MM-DD'), 'plaid', 'plaid-rent-1', 'Landlord LLC'],
      ['Utilities', 84, 'Electric bill', dayjs().subtract(2, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-util-1', 'Utility Co'],
      ['Food', 42, 'Coffee and breakfast', dayjs().subtract(1, 'day').format('YYYY-MM-DD'), 'manual', null, 'Cafe'],
      ['Fun Money', 68, 'Movie tickets', dayjs().subtract(4, 'day').format('YYYY-MM-DD'), 'manual', null, 'Cinema'],
      ['Food', 97, 'Groceries', dayjs().subtract(6, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-grocery-1', 'Market'],
      ['Gifts', 45, 'Birthday gift', dayjs().subtract(10, 'day').format('YYYY-MM-DD'), 'manual', null, 'Gift Shop'],
      ['Utilities', 56, 'Water bill', dayjs().subtract(15, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-water-1', 'City Water'],
      ['Food', 120, 'Dinner out', dayjs().subtract(20, 'day').format('YYYY-MM-DD'), 'manual', null, 'Bistro'],
      ['Fun Money', 140, 'Concert pass', dayjs().subtract(28, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-fun-1', 'Tickets'],
      ['Food', 88, 'Weekly groceries', dayjs().subtract(38, 'day').format('YYYY-MM-DD'), 'manual', null, 'Grocer'],
      ['Gifts', 72, 'Care package', dayjs().subtract(63, 'day').format('YYYY-MM-DD'), 'manual', null, 'Mail Center'],
      ['Utilities', 91, 'Internet', dayjs().subtract(95, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-net-1', 'ISP'],
      ['Food', 115, 'Bulk groceries', dayjs().subtract(124, 'day').format('YYYY-MM-DD'), 'manual', null, 'Warehouse'],
      ['Fun Money', 54, 'Arcade night', dayjs().subtract(160, 'day').format('YYYY-MM-DD'), 'manual', null, 'Arcade'],
      ['Food', 200, 'ATM withdrawal for shared spending', dayjs().subtract(3, 'day').format('YYYY-MM-DD'), 'plaid', 'plaid-atm-1', 'ATM Withdrawal'],
    ] as const

    const { data, error } = await supabase
      .from('finance_expenses')
      .insert(
        sampleExpenses.map(
          ([category_name, amount, note, spent_on, source, source_transaction_id, merchant_name]) => ({
            user_id: userId,
            category_name,
            amount,
            note,
            spent_on,
            source,
            source_transaction_id,
            merchant_name,
            pending: false,
            sync_updated_at: new Date().toISOString(),
          })
        )
      )
      .select()

    if (error) {
      throw error
    }

    const atmTransaction = (data as ExpenseRecord[]).find(
      (expense) => expense.source_transaction_id === 'plaid-atm-1'
    )

    if (atmTransaction) {
      await saveTransactionSplits({
        userId,
        expenseId: atmTransaction.id,
        expenseAmount: Number(atmTransaction.amount),
        splits: [
          { categoryName: 'Food', amount: 80, note: 'Groceries', position: 0 },
          { categoryName: 'Utilities', amount: 50, note: 'Transportation', position: 1 },
          { categoryName: 'Fun Money', amount: 70, note: 'Entertainment', position: 2 },
        ],
      })
    }
  }
}

export function getCategoryColor(categoryName: string) {
  const matchedCategory = DEFAULT_BUDGET_CATEGORIES.find(
    (category) => category.name.toLowerCase() === categoryName.toLowerCase()
  )

  return matchedCategory?.color ?? '#FACC15'
}

export function validateSplitPayload(splits: SplitInput[], sourceAmount: number) {
  if (splits.length === 0) {
    throw new Error('Add at least one split row.')
  }

  const positions = new Set<number>()
  let total = 0

  splits.forEach((split) => {
    if (!split.categoryName.trim()) {
      throw new Error('Each split needs a category.')
    }

    if (!Number.isFinite(split.amount) || split.amount <= 0) {
      throw new Error('Each split amount must be greater than 0.')
    }

    if (positions.has(split.position)) {
      throw new Error('Duplicate split rows are not allowed.')
    }

    positions.add(split.position)
    total += split.amount
  })

  if (roundCurrency(total) !== roundCurrency(sourceAmount)) {
    throw new Error('Split total must equal the original transaction amount.')
  }
}

export function buildEffectiveExpenseAllocations(
  expenses: ExpenseRecord[],
  splits: TransactionSplitRecord[]
): EffectiveExpenseAllocation[] {
  const splitMap = splits.reduce<Record<string, TransactionSplitRecord[]>>((map, split) => {
    if (split.deleted_at) {
      return map
    }

    map[split.expense_id] = [...(map[split.expense_id] ?? []), split].sort(
      (a, b) => a.position - b.position
    )
    return map
  }, {})

  return expenses.flatMap<EffectiveExpenseAllocation>((expense) => {
    const activeSplits = splitMap[expense.id] ?? []

    if (activeSplits.length === 0) {
      return [
        {
          id: `expense-${expense.id}`,
          source_expense_id: expense.id,
          category_name: expense.category_name,
          amount: Number(expense.amount),
          note: expense.note,
          spent_on: expense.spent_on,
          is_split: false,
        },
      ]
    }

    return activeSplits.map((split) => ({
      id: split.id,
      source_expense_id: expense.id,
      category_name: split.category_name,
      amount: Number(split.amount),
      note: split.note,
      spent_on: expense.spent_on,
      is_split: true,
    }))
  })
}

export function buildSplitSummary(rows: Array<{ amount: string }>, sourceAmount: number) {
  const allocated = roundCurrency(
    rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  )
  const remaining = roundCurrency(sourceAmount - allocated)

  return {
    allocated,
    remaining,
    isBalanced: remaining === 0,
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

// =====================================================
// INCOME TYPES AND FUNCTIONS
// =====================================================

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', color: '#22C55E' },
  { name: 'Freelance', color: '#3B82F6' },
  { name: 'Investments', color: '#8B5CF6' },
  { name: 'Gifts', color: '#EC4899' },
  { name: 'Accounts Receivable', color: '#F97316' },
  { name: 'Uncategorized', color: '#6B7280' },
] as const

export type IncomeRecord = {
  id: string
  user_id: string
  source_name: string
  amount: number
  received_on: string
  category_name: string | null
  note: string | null
  recurring: boolean
  plaid_transaction_id: string | null
  created_at: string
}

export type AssetRecord = {
  id: string
  user_id: string
  name: string
  amount: number
  asset_type: 'accounts_receivable' | 'io_we'
  due_date: string | null
  description: string | null
  is_paid: boolean
  paid_on: string | null
  created_at: string
}

export type LiabilityRecord = {
  id: string
  user_id: string
  name: string
  amount: number
  liability_type: 'accounts_payable' | 'notes_payable' | 'accrued_expense' | 'deferred_revenue'
  due_date: string | null
  description: string | null
  is_paid: boolean
  paid_on: string | null
  created_at: string
}

export type IncomeCategoryRecord = {
  id: string
  user_id: string
  name: string
  is_default: boolean
  created_at: string
}

export type PlaidIncomeMapping = {
  id: string
  user_id: string
  plaid_merchant_name: string
  income_category: string
  created_at: string
}

export type CashFlowSummary = {
  periodTotal: number
  periodExpenses: number
  netIncome: number
  operatingActivities: number
  investingActivities: number
  financingActivities: number
  netChangeInCash: number
  openingCash: number
  closingCash: number
}

export type BalanceSheetSummary = {
  cash: number
  accountsReceivable: number
  totalAssets: number
  accountsPayable: number
  notesPayable: number
  accruedExpenses: number
  deferredRevenue: number
  totalLiabilities: number
  netWorth: number
}

// Income functions
export async function fetchIncome(userId: string): QueryResult<IncomeRecord> {
  const { data, error } = await supabase
    .from('finance_income')
    .select('*')
    .eq('user_id', userId)
    .order('received_on', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as IncomeRecord[]
}

export async function createIncome(input: {
  userId: string
  sourceName: string
  amount: number
  receivedOn?: string
  categoryName?: string
  note?: string
  recurring?: boolean
  plaidTransactionId?: string
}) {
  const { data, error } = await supabase
    .from('finance_income')
    .insert({
      user_id: input.userId,
      source_name: input.sourceName,
      amount: input.amount,
      received_on: input.receivedOn ?? dayjs().format('YYYY-MM-DD'),
      category_name: input.categoryName ?? input.sourceName,
      note: input.note?.trim() || null,
      recurring: input.recurring ?? false,
      plaid_transaction_id: input.plaidTransactionId ?? null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as IncomeRecord
}

export async function deleteIncome(id: string) {
  const { error } = await supabase
    .from('finance_income')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}

// Asset functions (AR / IOUs)
export async function fetchAssets(userId: string): QueryResult<AssetRecord> {
  const { data, error } = await supabase
    .from('finance_assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as AssetRecord[]
}

export async function createAsset(input: {
  userId: string
  name: string
  amount: number
  assetType?: 'accounts_receivable' | 'io_we'
  dueDate?: string
  description?: string
}) {
  const { data, error } = await supabase
    .from('finance_assets')
    .insert({
      user_id: input.userId,
      name: input.name,
      amount: input.amount,
      asset_type: input.assetType ?? 'accounts_receivable',
      due_date: input.dueDate ?? null,
      description: input.description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as AssetRecord
}

export async function markAssetPaid(id: string) {
  const { error } = await supabase
    .from('finance_assets')
    .update({
      is_paid: true,
      paid_on: dayjs().format('YYYY-MM-DD'),
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function updateAsset(input: {
  id: string
  name?: string
  amount?: number
  dueDate?: string
  description?: string
}) {
  const { error } = await supabase
    .from('finance_assets')
    .update({
      name: input.name,
      amount: input.amount,
      due_date: input.dueDate,
      description: input.description,
    })
    .eq('id', input.id)

  if (error) {
    throw error
  }
}

export async function deleteAsset(id: string) {
  const { error } = await supabase
    .from('finance_assets')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}

// Liability functions
export async function fetchLiabilities(userId: string): QueryResult<LiabilityRecord> {
  const { data, error } = await supabase
    .from('finance_liabilities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as LiabilityRecord[]
}

export async function createLiability(input: {
  userId: string
  name: string
  amount: number
  liabilityType: 'accounts_payable' | 'notes_payable' | 'accrued_expense' | 'deferred_revenue'
  dueDate?: string
  description?: string
}) {
  const { data, error } = await supabase
    .from('finance_liabilities')
    .insert({
      user_id: input.userId,
      name: input.name,
      amount: input.amount,
      liability_type: input.liabilityType,
      due_date: input.dueDate ?? null,
      description: input.description?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as LiabilityRecord
}

export async function markLiabilityPaid(id: string) {
  const { error } = await supabase
    .from('finance_liabilities')
    .update({
      is_paid: true,
      paid_on: dayjs().format('YYYY-MM-DD'),
    })
    .eq('id', id)

  if (error) {
    throw error
  }
}

export async function updateLiability(input: {
  id: string
  name?: string
  amount?: number
  dueDate?: string
  description?: string
}) {
  const { error } = await supabase
    .from('finance_liabilities')
    .update({
      name: input.name,
      amount: input.amount,
      due_date: input.dueDate,
      description: input.description,
    })
    .eq('id', input.id)

  if (error) {
    throw error
  }
}

export async function deleteLiability(id: string) {
  const { error } = await supabase
    .from('finance_liabilities')
    .delete()
    .eq('id', id)

  if (error) {
    throw error
  }
}

// Income category functions
export async function fetchIncomeCategories(userId: string): QueryResult<IncomeCategoryRecord> {
  const { data, error } = await supabase
    .from('finance_income_categories')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as IncomeCategoryRecord[]
}

export async function createIncomeCategory(userId: string, name: string) {
  const { data, error } = await supabase
    .from('finance_income_categories')
    .insert({
      user_id: userId,
      name: name.trim(),
      is_default: false,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as IncomeCategoryRecord
}

// Plaid income mapping functions
export async function fetchPlaidIncomeMappings(userId: string): QueryResult<PlaidIncomeMapping> {
  const { data, error } = await supabase
    .from('finance_plaid_income_mapping')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return (data ?? []) as PlaidIncomeMapping[]
}

export async function mapPlaidToIncome(userId: string, merchantName: string, category: string) {
  const { data, error } = await supabase
    .from('finance_plaid_income_mapping')
    .upsert({
      user_id: userId,
      plaid_merchant_name: merchantName,
      income_category: category,
    }, { onConflict: 'user_id,plaid_merchant_name' })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as PlaidIncomeMapping
}

export async function getPlaidIncomeMapping(userId: string, merchantName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('finance_plaid_income_mapping')
    .select('income_category')
    .eq('user_id', userId)
    .eq('plaid_merchant_name', merchantName)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.income_category
}

// Cash flow calculation
export function calculateCashFlow(
  income: IncomeRecord[],
  expenses: ExpenseRecord[],
  period: ChartPeriod
): CashFlowSummary {
  const now = dayjs()
  let periodStart: dayjs.Dayjs
  let priorPeriodStart: dayjs.Dayjs

  switch (period) {
    case 'Weekly':
      periodStart = now.startOf('week')
      priorPeriodStart = periodStart.subtract(1, 'week')
      break
    case 'Monthly':
      periodStart = now.startOf('month')
      priorPeriodStart = periodStart.subtract(1, 'month')
      break
    case 'Quarterly':
      periodStart = now.startOf('quarter')
      priorPeriodStart = periodStart.subtract(1, 'quarter')
      break
    case 'Yearly':
      periodStart = now.startOf('year')
      priorPeriodStart = periodStart.subtract(1, 'year')
      break
  }

  const periodIncome = income
    .filter((inc) => dayjs(inc.received_on).isAfter(periodStart) || dayjs(inc.received_on).isSame(periodStart, 'day'))
    .reduce((sum, inc) => sum + Number(inc.amount), 0)

  const priorPeriodIncome = income
    .filter((inc) => {
      const date = dayjs(inc.received_on)
      return (date.isAfter(priorPeriodStart) || date.isSame(priorPeriodStart, 'day')) &&
             (date.isBefore(periodStart) || date.isSame(periodStart, 'day'))
    })
    .reduce((sum, inc) => sum + Number(inc.amount), 0)

  const periodExpenses = expenses
    .filter((exp) => dayjs(exp.spent_on).isAfter(periodStart) || dayjs(exp.spent_on).isSame(periodStart, 'day'))
    .reduce((sum, exp) => sum + Number(exp.amount), 0)

  const priorPeriodExpenses = expenses
    .filter((exp) => {
      const date = dayjs(exp.spent_on)
      return (date.isAfter(priorPeriodStart) || date.isSame(priorPeriodStart, 'day')) &&
             (date.isBefore(periodStart) || date.isSame(periodStart, 'day'))
    })
    .reduce((sum, exp) => sum + Number(exp.amount), 0)

  const operatingActivities = periodIncome - periodExpenses
  const netIncomeChange = periodIncome - priorPeriodIncome

  return {
    periodTotal: periodIncome,
    periodExpenses: periodExpenses,
    netIncome: periodIncome - periodExpenses,
    operatingActivities: netIncomeChange,
    investingActivities: 0,
    financingActivities: 0,
    netChangeInCash: operatingActivities,
    openingCash: 0,
    closingCash: periodIncome - periodExpenses,
  }
}

// Balance sheet calculation
export function calculateBalanceSheet(
  income: IncomeRecord[],
  expenses: ExpenseRecord[],
  assets: AssetRecord[],
  liabilities: LiabilityRecord[]
): BalanceSheetSummary {
  const totalIncome = income.reduce((sum, inc) => sum + Number(inc.amount), 0)
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
  const cash = totalIncome - totalExpenses

  const accountsReceivable = assets
    .filter((a) => !a.is_paid && a.asset_type === 'accounts_receivable')
    .reduce((sum, a) => sum + Number(a.amount), 0)

  const outstandingAssets = assets.filter((a) => !a.is_paid)
  const totalAssets = cash + accountsReceivable + outstandingAssets.reduce((sum, a) => sum + Number(a.amount), 0)

  const accountsPayable = liabilities
    .filter((l) => !l.is_paid && l.liability_type === 'accounts_payable')
    .reduce((sum, l) => sum + Number(l.amount), 0)

  const notesPayable = liabilities
    .filter((l) => !l.is_paid && l.liability_type === 'notes_payable')
    .reduce((sum, l) => sum + Number(l.amount), 0)

  const accruedExpenses = liabilities
    .filter((l) => !l.is_paid && l.liability_type === 'accrued_expense')
    .reduce((sum, l) => sum + Number(l.amount), 0)

  const deferredRevenue = liabilities
    .filter((l) => !l.is_paid && l.liability_type === 'deferred_revenue')
    .reduce((sum, l) => sum + Number(l.amount), 0)

  const outstandingLiabilities = liabilities.filter((l) => !l.is_paid)
  const totalLiabilities = accountsPayable + notesPayable + accruedExpenses + deferredRevenue +
    outstandingLiabilities.reduce((sum, l) => sum + Number(l.amount), 0)

  const netWorth = totalAssets - totalLiabilities

  return {
    cash,
    accountsReceivable: accountsReceivable + outstandingAssets.reduce((sum, a) => sum + Number(a.amount), 0),
    totalAssets,
    accountsPayable,
    notesPayable,
    accruedExpenses,
    deferredRevenue,
    totalLiabilities,
    netWorth,
  }
}

export function getIncomeCategoryColor(categoryName: string) {
  const matchedCategory = DEFAULT_INCOME_CATEGORIES.find(
    (category) => category.name.toLowerCase() === categoryName.toLowerCase()
  )

  return matchedCategory?.color ?? '#6B7280'
}
