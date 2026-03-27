import { supabase } from '../lib/supabase'
import { Budget } from '../types'
import dayjs from 'dayjs'

export const budgetService = {
  async getBudgets(): Promise<Budget[]> {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD')
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD')

    const { data: budgets, error } = await supabase
      .from('budgets')
      .select('*, category:categories(*)')
    if (error) throw error

    // Aggregate spending per category this month
    const { data: txs } = await supabase
      .from('transactions')
      .select('category_id, amount')
      .is('deleted_at', null)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    const spentByCategory: Record<string, number> = {}
    ;(txs || []).forEach((tx) => {
      if (tx.category_id) {
        spentByCategory[tx.category_id] =
          (spentByCategory[tx.category_id] || 0) + Number(tx.amount)
      }
    })

    return (budgets || []).map((b) => ({
      ...b,
      spent: spentByCategory[b.category_id] || 0,
    }))
  },

  async addBudget(
    budget: Omit<Budget, 'id' | 'user_id' | 'created_at' | 'category' | 'spent'>
  ): Promise<Budget> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('budgets')
      .insert({ ...budget, user_id: user!.id })
      .select('*, category:categories(*)')
      .single()
    if (error) throw error
    return data
  },

  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select('*, category:categories(*)')
      .single()
    if (error) throw error
    return data
  },

  async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (error) throw error
  },
}
