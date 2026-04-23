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
