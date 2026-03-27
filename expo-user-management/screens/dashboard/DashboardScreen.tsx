import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { useAuth } from '../../contexts/AuthContext'
import { transactionService } from '../../services/transactions'
import { budgetService } from '../../services/budgets'
import { analyticsService, Insights } from '../../services/analytics'
import { Transaction, Budget } from '../../types'

export default function DashboardScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recentTxs, setRecentTxs] = useState<Transaction[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)

  async function loadData() {
    try {
      const [txs, b, ins] = await Promise.all([
        transactionService.getRecentTransactions(5),
        budgetService.getBudgets(),
        analyticsService.getInsights(),
      ])
      setRecentTxs(txs)
      setBudgets(b)
      setInsights(ins)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  function onRefresh() {
    setRefreshing(true)
    loadData()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there'

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary card */}
        <View style={styles.headerCard}>
          <Text style={styles.greeting}>Hello, {firstName} 👋</Text>
          <Text style={styles.monthLabel}>{dayjs().format('MMMM YYYY')}</Text>
          <Text style={styles.totalLabel}>Total Spent This Month</Text>
          <Text style={styles.totalAmount}>
            ${insights?.totalThisMonth?.toFixed(2) ?? '0.00'}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                ${insights?.avgDailySpend?.toFixed(2) ?? '0.00'}
              </Text>
              <Text style={styles.statLabel}>Avg / Day</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1}>
                {insights?.topMerchant ?? '—'}
              </Text>
              <Text style={styles.statLabel}>Top Merchant</Text>
            </View>
          </View>
        </View>

        {/* Budget progress */}
        {budgets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Budget Overview</Text>
            {budgets.slice(0, 4).map((budget) => {
              const spent = budget.spent ?? 0
              const pct = Math.min((spent / budget.monthly_limit) * 100, 100)
              const over = spent > budget.monthly_limit
              const barColor = over ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#3B82F6'
              return (
                <View key={budget.id} style={styles.budgetItem}>
                  <View style={styles.budgetRow}>
                    <Text style={styles.budgetIcon}>{budget.category?.icon}</Text>
                    <Text style={styles.budgetName}>{budget.category?.name}</Text>
                    <Text style={[styles.budgetAmt, over && styles.textRed]}>
                      ${spent.toFixed(0)} / ${budget.monthly_limit.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* Recent transactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {recentTxs.length === 0 ? (
            <Text style={styles.empty}>No transactions yet — add one from the Transactions tab!</Text>
          ) : (
            recentTxs.map((tx) => (
              <View key={tx.id} style={styles.txItem}>
                <View
                  style={[
                    styles.txIconBg,
                    { backgroundColor: (tx.category?.color ?? '#6B7280') + '20' },
                  ]}
                >
                  <Text style={styles.txEmoji}>{tx.category?.icon ?? '📦'}</Text>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txMerchant}>{tx.merchant_name}</Text>
                  <Text style={styles.txMeta}>
                    {tx.category?.name ?? 'Uncategorized'} •{' '}
                    {dayjs(tx.date).format('MMM D')}
                  </Text>
                </View>
                <Text style={styles.txAmount}>-${Number(tx.amount).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Largest expense callout */}
        {insights?.largestExpense && (
          <View style={styles.section}>
            <View style={styles.insightCard}>
              <Text style={styles.insightTitle}>Largest Expense This Month</Text>
              <Text style={styles.insightValue}>
                ${insights.largestExpense.amount.toFixed(2)}
              </Text>
              <Text style={styles.insightSub}>
                {insights.largestExpense.merchant_name} •{' '}
                {dayjs(insights.largestExpense.date).format('MMM D')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  headerCard: {
    backgroundColor: '#3B82F6',
    margin: 16,
    borderRadius: 20,
    padding: 24,
  },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 2 },
  monthLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 14 },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 },
  totalAmount: { color: '#fff', fontSize: 42, fontWeight: 'bold', marginBottom: 18 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  statLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 3 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },

  budgetItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  budgetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  budgetIcon: { fontSize: 18, marginRight: 8 },
  budgetName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  budgetAmt: { fontSize: 13, color: '#6B7280' },
  textRed: { color: '#EF4444' },
  progressBg: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },

  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  txIconBg: {
    width: 42,
    height: 42,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txEmoji: { fontSize: 20 },
  txInfo: { flex: 1 },
  txMerchant: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  txMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  empty: { textAlign: 'center', color: '#9CA3AF', padding: 20, fontSize: 14 },

  insightCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  insightTitle: { fontSize: 12, color: '#3B82F6', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightValue: { fontSize: 28, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  insightSub: { fontSize: 13, color: '#6B7280' },
})
