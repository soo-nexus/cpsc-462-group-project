import { supabase } from '../lib/supabase'
import dayjs from 'dayjs'

export interface SpendingByDay {
  date: string
  total: number
}

export interface SpendingByCategory {
  category_id: string
  category_name: string
  color: string
  total: number
}

export interface Insights {
  totalThisMonth: number
  avgDailySpend: number
  largestExpense: { amount: number; merchant_name: string; date: string } | null
  topMerchant: string | null
}

export const analyticsService = {
  async getSpendingByDay(days = 30): Promise<SpendingByDay[]> {
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
    const { data, error } = await supabase
      .from('transactions')
      .select('date, amount')
      .is('deleted_at', null)
      .gte('date', startDate)
      .order('date')
    if (error) throw error

    const byDay: Record<string, number> = {}
    ;(data || []).forEach((tx) => {
      byDay[tx.date] = (byDay[tx.date] || 0) + Number(tx.amount)
    })

    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }))
  },

  async getSpendingByCategory(
    startDate: string,
    endDate: string
  ): Promise<SpendingByCategory[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('amount, category:categories(id, name, color)')
      .is('deleted_at', null)
      .gte('date', startDate)
      .lte('date', endDate)
      .not('category_id', 'is', null)
    if (error) throw error

    const byCategory: Record<string, SpendingByCategory> = {}
    ;(data || []).forEach((tx: any) => {
      if (!tx.category) return
      const key = tx.category.id
      if (!byCategory[key]) {
        byCategory[key] = {
          category_id: tx.category.id,
          category_name: tx.category.name,
          color: tx.category.color,
          total: 0,
        }
      }
      byCategory[key].total += Number(tx.amount)
    })

    return Object.values(byCategory).sort((a, b) => b.total - a.total)
  },

  async getInsights(): Promise<Insights | null> {
    const startOfMonth = dayjs().startOf('month').format('YYYY-MM-DD')
    const endOfMonth = dayjs().endOf('month').format('YYYY-MM-DD')

    const { data } = await supabase
      .from('transactions')
      .select('amount, merchant_name, date')
      .is('deleted_at', null)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    if (!data || data.length === 0) return null

    const total = data.reduce((sum, tx) => sum + Number(tx.amount), 0)
    const days = dayjs().date()
    const avgDailySpend = total / days

    const largest = data.reduce(
      (max, tx) => (Number(tx.amount) > Number(max.amount) ? tx : max),
      data[0]
    )

    const merchantCount: Record<string, number> = {}
    data.forEach((tx) => {
      merchantCount[tx.merchant_name] = (merchantCount[tx.merchant_name] || 0) + 1
    })
    const topMerchant =
      Object.entries(merchantCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    return {
      totalThisMonth: total,
      avgDailySpend,
      largestExpense: {
        amount: Number(largest.amount),
        merchant_name: largest.merchant_name,
        date: largest.date,
      },
      topMerchant,
    }
  },
}
