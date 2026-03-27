import { supabase } from '../lib/supabase'
import { Transaction } from '../types'

export interface TransactionFilter {
  search?: string
  categoryId?: string
  startDate?: string
  endDate?: string
}

export const transactionService = {
  async getTransactions(filters?: TransactionFilter): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.search) {
      query = query.ilike('merchant_name', `%${filters.search}%`)
    }
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async addTransaction(
    tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'deleted_at' | 'category'>
  ): Promise<Transaction> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('transactions')
      .insert({ ...tx, user_id: user!.id })
      .select('*, category:categories(*)')
      .single()
    if (error) throw error
    return data
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select('*, category:categories(*)')
      .single()
    if (error) throw error
    return data
  },

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async getRecentTransactions(limit = 5): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async getMonthlyTotal(year: number, month: number): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('transactions')
      .select('amount')
      .is('deleted_at', null)
      .gte('date', startDate)
      .lte('date', endDate)
    if (error) throw error
    return (data || []).reduce((sum, tx) => sum + Number(tx.amount), 0)
  },
}
