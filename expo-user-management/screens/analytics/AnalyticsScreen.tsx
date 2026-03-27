import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import dayjs from 'dayjs'
import { analyticsService, SpendingByDay, SpendingByCategory, Insights } from '../../services/analytics'

const SCREEN_WIDTH = Dimensions.get('window').width

const PERIODS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
] as const

type PeriodLabel = '1W' | '1M' | '3M'

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<PeriodLabel>('1M')
  const [loading, setLoading] = useState(true)
  const [byDay, setByDay] = useState<SpendingByDay[]>([])
  const [byCategory, setByCategory] = useState<SpendingByCategory[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)

  useEffect(() => {
    loadData()
  }, [period])

  async function loadData() {
    setLoading(true)
    try {
      const days = PERIODS.find((p) => p.label === period)!.days
      const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD')
      const endDate = dayjs().format('YYYY-MM-DD')

      const [d, c, ins] = await Promise.all([
        analyticsService.getSpendingByDay(days),
        analyticsService.getSpendingByCategory(startDate, endDate),
        analyticsService.getInsights(),
      ])
      setByDay(d)
      setByCategory(c)
      setInsights(ins)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = byDay.map((d) => ({
    value: Number(d.total),
    label: dayjs(d.date).format('M/D'),
  }))

  const totalCatSpend = byCategory.reduce((s, c) => s + c.total, 0)
  const chartWidth = SCREEN_WIDTH - 64

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Period selector */}
      <View style={styles.periodWrap}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.periodBtn, period === p.label && styles.periodBtnActive]}
            onPress={() => setPeriod(p.label)}
          >
            <Text style={[styles.periodText, period === p.label && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 60 }} />
      ) : (
        <>
          {/* Line chart */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Spending Over Time</Text>
            {chartData.length > 1 ? (
              <LineChart
                data={chartData}
                width={chartWidth}
                height={180}
                color="#3B82F6"
                thickness={2}
                dataPointsColor="#3B82F6"
                isAnimated
                curved
                hideDataPoints={chartData.length > 15}
                xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 9 }}
                yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
                rulesColor="#F3F4F6"
                initialSpacing={10}
                spacing={Math.max(20, (chartWidth - 40) / Math.max(chartData.length - 1, 1))}
                noOfSections={4}
                yAxisThickness={0}
                xAxisThickness={1}
                xAxisColor="#E5E7EB"
              />
            ) : (
              <Text style={styles.noData}>Not enough data for this period</Text>
            )}
          </View>

          {/* Category breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spending by Category</Text>
            {byCategory.length === 0 ? (
              <Text style={styles.noData}>No transactions in this period</Text>
            ) : (
              byCategory.map((cat) => {
                const pct = totalCatSpend > 0 ? (cat.total / totalCatSpend) * 100 : 0
                return (
                  <View key={cat.category_id} style={styles.catRow}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.category_name}
                    </Text>
                    <View style={styles.catBarBg}>
                      <View
                        style={[
                          styles.catBarFill,
                          { width: `${pct}%` as any, backgroundColor: cat.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.catAmt}>${cat.total.toFixed(0)}</Text>
                  </View>
                )
              })
            )}
          </View>

          {/* Insights */}
          {insights && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>This Month</Text>
              <View style={styles.insightGrid}>
                <View style={styles.insightCard}>
                  <Text style={styles.insightValue}>
                    ${insights.totalThisMonth.toFixed(0)}
                  </Text>
                  <Text style={styles.insightLabel}>Total Spent</Text>
                </View>
                <View style={styles.insightCard}>
                  <Text style={styles.insightValue}>
                    ${insights.avgDailySpend.toFixed(0)}
                  </Text>
                  <Text style={styles.insightLabel}>Daily Average</Text>
                </View>
                {insights.topMerchant && (
                  <View style={[styles.insightCard, styles.insightCardFull]}>
                    <Text style={styles.insightValue}>{insights.topMerchant}</Text>
                    <Text style={styles.insightLabel}>Most Visited</Text>
                  </View>
                )}
                {insights.largestExpense && (
                  <View style={[styles.insightCard, styles.insightCardFull]}>
                    <Text style={styles.insightValue}>
                      ${insights.largestExpense.amount.toFixed(2)} @ {insights.largestExpense.merchant_name}
                    </Text>
                    <Text style={styles.insightLabel}>Largest Expense</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  periodWrap: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#fff' },
  periodText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  periodTextActive: { color: '#1F2937', fontWeight: '700' },
  chartCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 14 },
  section: { marginHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8, flexShrink: 0 },
  catName: { width: 100, fontSize: 13, color: '#374151', flexShrink: 0 },
  catBarBg: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginHorizontal: 8 },
  catBarFill: { height: 8, borderRadius: 4 },
  catAmt: { width: 54, fontSize: 13, fontWeight: '600', color: '#1F2937', textAlign: 'right' },
  noData: { textAlign: 'center', color: '#9CA3AF', paddingVertical: 24, fontSize: 14 },
  insightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  insightCardFull: { width: '100%' },
  insightValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  insightLabel: { fontSize: 12, color: '#9CA3AF' },
})
