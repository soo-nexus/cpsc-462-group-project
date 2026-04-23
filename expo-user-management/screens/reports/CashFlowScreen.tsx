import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import dayjs from 'dayjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import {
  ChartPeriod,
  calculateCashFlow,
  fetchExpenses,
  fetchIncome,
  fetchAssets,
  fetchLiabilities,
  type CashFlowSummary,
} from '../../lib/finance'

const PERIOD_OPTIONS: ChartPeriod[] = ['Weekly', 'Monthly', 'Quarterly', 'Yearly']
const CHART_WIDTH = Dimensions.get('window').width - 64

export default function CashFlowScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>('Monthly')

  const incomeQuery = useQuery({
    queryKey: ['finance-income', user?.id],
    queryFn: () => fetchIncome(user!.id),
    enabled: Boolean(user?.id),
  })

  const expensesQuery = useQuery({
    queryKey: ['finance-expenses', user?.id],
    queryFn: () => fetchExpenses(user!.id),
    enabled: Boolean(user?.id),
  })

  const assetsQuery = useQuery({
    queryKey: ['finance-assets', user?.id],
    queryFn: () => fetchAssets(user!.id),
    enabled: Boolean(user?.id),
  })

  const liabilitiesQuery = useQuery({
    queryKey: ['finance-liabilities', user?.id],
    queryFn: () => fetchLiabilities(user!.id),
    enabled: Boolean(user?.id),
  })

  const refreshData = async () => {
    if (!user?.id) return
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['finance-income', user.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-expenses', user.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-assets', user.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-liabilities', user.id] }),
    ])
  }

  const income = incomeQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const assets = assetsQuery.data ?? []
  const liabilities = liabilitiesQuery.data ?? []
  const isLoading = incomeQuery.isLoading || expensesQuery.isLoading

  const cashFlow = useMemo(
    () => calculateCashFlow(income, expenses, selectedPeriod),
    [income, expenses, selectedPeriod]
  )

  const periodComparison = useMemo(
    () => buildPeriodComparison(income, expenses, selectedPeriod),
    [income, expenses, selectedPeriod]
  )

  if (!user) return null

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={incomeQuery.isRefetching}
            onRefresh={refreshData}
            tintColor="#8B5CF6"
          />
        }
      >
        <View style={styles.topShell}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarCaption}>Cash movements</Text>
              <Text style={styles.topBarTitle}>Statement of cash flows</Text>
            </View>
          </View>

          <View style={styles.balanceRow}>
            <FlowCard
              title="Net Change"
              amount={formatCurrency(cashFlow.netChangeInCash)}
              change={cashFlow.netChangeInCash >= 0 ? 'positive' : 'negative'}
            />
            <FlowCard
              title="Cash Balance"
              amount={formatCurrency(cashFlow.closingCash)}
              subtitle="This period"
            />
          </View>
        </View>

        <View style={styles.whitePanel}>
          <Text style={styles.panelEyebrow}>By Period</Text>
          <Text style={styles.panelTitle}>Cash flow over time</Text>

          <View style={styles.segmentRow}>
            {PERIOD_OPTIONS.map((period) => (
              <View
                key={period}
                style={[
                  styles.segmentButton,
                  selectedPeriod === period && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    selectedPeriod === period && styles.segmentButtonTextActive,
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  {period}
                </Text>
              </View>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#8B5CF6" />
            </View>
          ) : (
            <View style={styles.chartCard}>
              <WaterfallChart data={periodComparison} />
            </View>
          )}

          <Text style={styles.sectionTitle}>Cash Flow Activities</Text>

          <View style={styles.activitySection}>
            <ActivityRow
              title="Operating Activities"
              description="Income - Expenses"
              amount={cashFlow.operatingActivities}
              icon="O"
            />
            <ActivityRow
              title="Investing Activities"
              description="Changes in accounts receivable"
              amount={cashFlow.investingActivities}
              icon="I"
            />
            <ActivityRow
              title="Financing Activities"
              description="Changes in liabilities"
              amount={cashFlow.financingActivities}
              icon="F"
            />
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Net Change in Cash</Text>
              <Text
                style={[
                  styles.summaryValue,
                  cashFlow.netChangeInCash >= 0 ? styles.positiveValue : styles.negativeValue,
                ]}
              >
                {cashFlow.netChangeInCash >= 0 ? '+' : ''}
                {formatCurrency(cashFlow.netChangeInCash)}
              </Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How it's calculated</Text>
            <Text style={styles.infoText}>
              Operating = This period's income minus expenses{'\n'}
              Investing = Change in amounts owed to you{'\n'}
              Financing = Change in amounts you owe
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function FlowCard({
  title,
  amount,
  change,
  subtitle,
}: {
  title: string
  amount: string
  change?: 'positive' | 'negative'
  subtitle?: string
}) {
  return (
    <View style={styles.flowCard}>
      {change && (
        <View style={[styles.flowIndicator, change === 'positive' ? styles.positiveBg : styles.negativeBg]} />
      )}
      <Text style={styles.flowTitle}>{title}</Text>
      <Text
        style={[
          styles.flowAmount,
          change === 'positive' && styles.positiveAmount,
          change === 'negative' && styles.negativeAmount,
        ]}
      >
        {amount}
      </Text>
      {subtitle && <Text style={styles.flowSubtitle}>{subtitle}</Text>}
    </View>
  )
}

function ActivityRow({
  title,
  description,
  amount,
  icon,
}: {
  title: string
  description: string
  amount: number
  icon: string
}) {
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityIcon}>
        <Text style={styles.activityIconText}>{icon}</Text>
      </View>
      <View style={styles.activityInfo}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityDescription}>{description}</Text>
      </View>
      <Text style={[styles.activityAmount, amount >= 0 ? styles.positiveAmount : styles.negativeAmount]}>
        {amount >= 0 ? '+' : ''}
        {formatCurrency(amount)}
      </Text>
    </View>
  )
}

function WaterfallChart({
  data,
}: {
  data: Array<{ label: string; operating: number; investing: number; financing: number; total: number }>
}) {
  const maxValue = Math.max(...data.flatMap((d) => [d.total, Math.abs(d.total)]), 1000)
  const chartHeight = 180

  return (
    <View style={styles.waterfallContainer}>
      <Svg width={CHART_WIDTH} height={chartHeight}>
        <Line x1="0" y1={chartHeight - 30} x2={CHART_WIDTH} y2={chartHeight - 30} stroke="#E5ECF7" strokeWidth="1" />

        {data.map((item, index) => {
          const x = 40 + index * ((CHART_WIDTH - 60) / data.length)
          const totalHeight = (item.total / maxValue) * (chartHeight - 50)
          const y = chartHeight - 30 - Math.abs(totalHeight)

          return (
            <Rect
              key={item.label}
              x={x}
              y={item.total >= 0 ? y : chartHeight - 30}
              width={40}
              height={Math.abs(totalHeight)}
              fill={item.total >= 0 ? '#22C55E' : '#EF4444'}
              rx={4}
            />
          )
        })}
      </Svg>
      <View style={styles.waterfallLabels}>
        {data.map((item) => (
          <Text key={item.label} style={styles.waterfallLabel}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

function buildPeriodComparison(
  income: any[],
  expenses: any[],
  period: ChartPeriod
): Array<{ label: string; operating: number; investing: number; financing: number; total: number }> {
  const now = dayjs()
  let periods: { label: string; start: dayjs.Dayjs }[] = []

  switch (period) {
    case 'Weekly':
      periods = Array.from({ length: 4 }, (_, i) => ({
        label: `W${i + 1}`,
        start: now.startOf('week').subtract(3 - i, 'week'),
      }))
      break
    case 'Monthly':
      periods = Array.from({ length: 4 }, (_, i) => ({
        label: now.subtract(3 - i, 'month').format('MMM'),
        start: now.subtract(3 - i, 'month').startOf('month'),
      }))
      break
    case 'Quarterly':
      periods = Array.from({ length: 4 }, (_, i) => ({
        label: `Q${i + 1}`,
        start: now.subtract(3 - i, 'quarter').startOf('quarter'),
      }))
      break
    case 'Yearly':
      periods = Array.from({ length: 4 }, (_, i) => ({
        label: now.subtract(3 - i, 'year').format('YY'),
        start: now.subtract(3 - i, 'year').startOf('year'),
      }))
      break
  }

  return periods.map(({ label, start }) => {
    const end = start.endOf(period === 'Weekly' ? 'week' : period === 'Monthly' ? 'month' : period === 'Quarterly' ? 'quarter' : 'year')

    const periodIncome = income
      .filter((inc) => {
        const date = dayjs(inc.received_on)
        return (date.isAfter(start) || date.isSame(start, 'day')) && (date.isBefore(end) || date.isSame(end, 'day'))
      })
      .reduce((sum, inc) => sum + Number(inc.amount), 0)

    const periodExpenses = expenses
      .filter((exp) => {
        const date = dayjs(exp.spent_on)
        return (date.isAfter(start) || date.isSame(start, 'day')) && (date.isBefore(end) || date.isSame(end, 'day'))
      })
      .reduce((sum, exp) => sum + Number(exp.amount), 0)

    return {
      label,
      operating: periodIncome - periodExpenses,
      investing: 0,
      financing: 0,
      total: periodIncome - periodExpenses,
    }
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#8B5CF6' },
  content: { paddingBottom: 40 },
  topShell: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  topBar: { marginBottom: 20 },
  topBarCaption: { color: '#DDD6FE', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 6 },
  balanceRow: { flexDirection: 'row', gap: 12 },
  flowCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, flex: 1 },
  flowIndicator: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  positiveBg: { backgroundColor: '#22C55E' },
  negativeBg: { backgroundColor: '#EF4444' },
  flowTitle: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  flowAmount: { color: '#1F2937', fontSize: 24, fontWeight: '800', marginTop: 4 },
  positiveAmount: { color: '#22C55E' },
  negativeAmount: { color: '#EF4444' },
  flowSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  whitePanel: { backgroundColor: '#F7FAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -10, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  panelEyebrow: { color: '#7D8EA8', fontSize: 14, fontWeight: '600' },
  panelTitle: { color: '#1F2937', fontSize: 34, fontWeight: '800', marginTop: 4, marginBottom: 18 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  segmentButton: { backgroundColor: '#E8EEF8', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  segmentButtonActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E3F6' },
  segmentButtonText: { color: '#6A7990', fontWeight: '700' },
  segmentButtonTextActive: { color: '#8B5CF6' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 50, alignItems: 'center' },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 16 },
  waterfallContainer: { width: '100%' },
  waterfallLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  waterfallLabel: { color: '#8C9AAF', fontSize: 11, fontWeight: '600' },
  sectionTitle: { color: '#1F2937', fontSize: 22, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  activitySection: { gap: 12 },
  activityRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' },
  activityIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityIconText: { color: '#8B5CF6', fontWeight: '800', fontSize: 18 },
  activityInfo: { flex: 1 },
  activityTitle: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  activityDescription: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  activityAmount: { fontSize: 16, fontWeight: '800' },
  summarySection: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '800' },
  positiveValue: { color: '#22C55E' },
  negativeValue: { color: '#EF4444' },
  infoSection: { backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16, marginTop: 20 },
  infoTitle: { color: '#8B5CF6', fontSize: 14, fontWeight: '800', marginBottom: 8 },
  infoText: { color: '#6B7280', fontSize: 13, lineHeight: 20 },
})