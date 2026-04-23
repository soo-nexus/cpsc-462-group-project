import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import {
  ChartPeriod,
  DEFAULT_INCOME_CATEGORIES,
  createIncome,
  createIncomeCategory,
  deleteIncome,
  fetchExpenses,
  fetchIncome,
  fetchIncomeCategories,
  getIncomeCategoryColor,
  type IncomeRecord,
} from '../../lib/finance'

const PERIOD_OPTIONS: ChartPeriod[] = ['Weekly', 'Monthly', 'Quarterly', 'Yearly']
const CHART_WIDTH = Dimensions.get('window').width - 64

type IncomeItem = {
  id: string
  name: string
  amount: number
  color: string
}

export default function IncomeStatementScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>('Monthly')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)

  const [formSource, setFormSource] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formRecurring, setFormRecurring] = useState(false)
  const [customCategory, setCustomCategory] = useState('')

  const [categoryInput, setCategoryInput] = useState('')

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

  const categoriesQuery = useQuery({
    queryKey: ['finance-income-categories', user?.id],
    queryFn: () => fetchIncomeCategories(user!.id),
    enabled: Boolean(user?.id),
  })

  const createIncomeMutation = useMutation({
    mutationFn: createIncome,
    onSuccess: async () => {
      setFormSource('')
      setFormAmount('')
      setFormNote('')
      setCustomCategory('')
      setShowAddModal(false)
      await queryClient.refetchQueries({ queryKey: ['finance-income', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed to add income', error.message),
  })

  const deleteIncomeMutation = useMutation({
    mutationFn: deleteIncome,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['finance-income', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed to delete', error.message),
  })

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => createIncomeCategory(user!.id, name),
    onSuccess: async () => {
      setCategoryInput('')
      setShowCategoryModal(false)
      await queryClient.refetchQueries({ queryKey: ['finance-income-categories', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed to add category', error.message),
  })

  const refreshData = async () => {
    if (!user?.id) return
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['finance-income', user.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-expenses', user.id] }),
    ])
  }

  const income = incomeQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const isLoading = incomeQuery.isLoading || expensesQuery.isLoading

  const periodData = useMemo(
    () => buildPeriodData(income, selectedPeriod),
    [income, selectedPeriod]
  )

  const categoryTotals = useMemo(
    () => buildCategoryTotals(income),
    [income]
  )

  const summary = useMemo(
    () => buildSummary(income, expenses, selectedPeriod),
    [income, expenses, selectedPeriod]
  )

  if (!user) return null

  const handleAddIncome = () => {
    const amount = Number(formAmount)
    if (!formSource || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid income', 'Please enter a source and amount greater than 0.')
      return
    }

    createIncomeMutation.mutate({
      userId: user.id,
      sourceName: formSource,
      amount,
      categoryName: customCategory.trim() || formSource,
      note: formNote,
      recurring: formRecurring,
    })
  }

  const handleDeleteIncome = (record: IncomeRecord) => {
    Alert.alert(
      'Delete income',
      `Are you sure you want to delete this ${record.source_name} record?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteIncomeMutation.mutate(record.id) },
      ]
    )
  }

  const handleAddCategory = () => {
    if (!categoryInput.trim()) {
      Alert.alert('Invalid category', 'Please enter a category name.')
      return
    }
    createCategoryMutation.mutate(categoryInput.trim())
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={incomeQuery.isRefetching || expensesQuery.isRefetching}
            onRefresh={refreshData}
            tintColor="#22C55E"
          />
        }
      >
        <View style={styles.topShell}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarCaption}>Income overview</Text>
              <Text style={styles.topBarTitle}>Your income statement</Text>
            </View>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <SummaryCard
              title="Total Income"
              amount={formatCurrency(summary.totalIncome)}
              accent="#22C55E"
            />
            <SummaryCard
              title="This Period"
              amount={formatCurrency(summary.periodIncome)}
              accent="#3B82F6"
            />
          </View>
        </View>

        <View style={styles.whitePanel}>
          <Text style={styles.panelEyebrow}>By Period</Text>
          <Text style={styles.panelTitle}>Income over time</Text>

          <View style={styles.segmentRow}>
            {PERIOD_OPTIONS.map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.segmentButton,
                  selectedPeriod === period && styles.segmentButtonActive,
                ]}
                onPress={() => setSelectedPeriod(period)}
              >
                <Text
                  style={[
                    styles.segmentButtonText,
                    selectedPeriod === period && styles.segmentButtonTextActive,
                  ]}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#22C55E" />
            </View>
          ) : (
            <View style={styles.chartCard}>
              <BarChart data={periodData} />
            </View>
          )}

          <Text style={styles.panelTitleSecondary}>By Category</Text>
          <View style={styles.categoryList}>
            {categoryTotals.map((item) => (
              <CategoryRow key={item.name} item={item} />
            ))}
          </View>

          <TouchableOpacity
            style={styles.manageCategoriesButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={styles.manageCategoriesText}>Manage Categories</Text>
          </TouchableOpacity>

          <Text style={styles.panelTitleSecondary}>Recent Income</Text>
          {income.length === 0 ? (
            <Text style={styles.emptyText}>No income recorded yet.</Text>
          ) : (
            income.slice(0, 10).map((record) => (
              <IncomeRow
                key={record.id}
                record={record}
                onDelete={() => handleDeleteIncome(record)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Income</Text>

            <Text style={styles.inputLabel}>Source</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <View style={styles.chipWrap}>
                {DEFAULT_INCOME_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.categoryChip,
                      formSource === cat.name && styles.categoryChipActive,
                    ]}
                    onPress={() => setFormSource(cat.name)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        formSource === cat.name && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="Or enter custom source"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <TextInput
              value={formAmount}
              onChangeText={setFormAmount}
              placeholder="Amount"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <TextInput
              value={formNote}
              onChangeText={setFormNote}
              placeholder="Note (optional)"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.noteInput]}
              multiline
            />

            <TouchableOpacity
              style={styles.recurringToggle}
              onPress={() => setFormRecurring(!formRecurring)}
            >
              <View style={[styles.checkbox, formRecurring && styles.checkboxChecked]} />
              <Text style={styles.recurringText}>Recurring income</Text>
            </TouchableOpacity>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddIncome}
                disabled={createIncomeMutation.isPending}
              >
                <Text style={styles.modalSaveButtonText}>
                  {createIncomeMutation.isPending ? 'Saving...' : 'Add Income'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showCategoryModal} transparent animationType="slide" onRequestClose={() => setShowCategoryModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Manage Categories</Text>

            <Text style={styles.inputLabel}>Add New Category</Text>
            <TextInput
              value={categoryInput}
              onChangeText={setCategoryInput}
              placeholder="Category name"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowCategoryModal(false)}>
                <Text style={styles.modalCancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleAddCategory}
                disabled={createCategoryMutation.isPending || !categoryInput.trim()}
              >
                <Text style={styles.modalSaveButtonText}>
                  {createCategoryMutation.isPending ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function SummaryCard({ title, amount, accent }: { title: string; amount: string; accent: string }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryPill, { backgroundColor: accent }]} />
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryAmount}>{amount}</Text>
    </View>
  )
}

function BarChart({ data }: { data: Array<{ label: string; amount: number }> }) {
  const maxAmount = Math.max(...data.map((d) => d.amount), 1)
  const barWidth = (CHART_WIDTH - 40) / Math.max(data.length, 1)

  return (
    <View style={styles.barChartContainer}>
      <Svg width={CHART_WIDTH} height={180}>
        {[0, 1, 2, 3, 4].map((grid) => {
          const y = grid * 36
          return (
            <Line
              key={`grid-${grid}`}
              x1="0"
              y1={y}
              x2={CHART_WIDTH}
              y2={y}
              stroke="#E5ECF7"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
          )
        })}
        {data.map((item, index) => {
          const height = (item.amount / maxAmount) * 140
          const x = 20 + index * barWidth
          return (
            <Rect
              key={item.label}
              x={x + 4}
              y={140 - height + 10}
              width={barWidth - 8}
              height={height}
              fill="#22C55E"
              rx={4}
            />
          )
        })}
      </Svg>
      <View style={styles.chartLabelsRow}>
        {data.map((item) => (
          <Text key={item.label} style={styles.chartLabelText}>
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

function CategoryRow({ item }: { item: IncomeItem }) {
  return (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
      <Text style={styles.categoryName}>{item.name}</Text>
      <Text style={styles.categoryAmount}>{formatCurrency(item.amount)}</Text>
    </View>
  )
}

function IncomeRow({ record, onDelete }: { record: IncomeRecord; onDelete: () => void }) {
  return (
    <View style={styles.incomeRow}>
      <View style={styles.incomeInfo}>
        <Text style={styles.incomeSource}>{record.source_name}</Text>
        <Text style={styles.incomeDate}>
          {dayjs(record.received_on).format('MMM D, YYYY')}
          {record.recurring && ' • Recurring'}
        </Text>
      </View>
      <View style={styles.incomeRight}>
        <Text style={styles.incomeAmount}>+{formatCurrency(record.amount)}</Text>
        <TouchableOpacity onPress={onDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function buildPeriodData(income: IncomeRecord[], period: ChartPeriod) {
  const now = dayjs()
  let buckets: { label: string; amount: number }[] = []

  switch (period) {
    case 'Weekly':
      buckets = Array.from({ length: 4 }, (_, i) => {
        const weekStart = now.startOf('week').subtract(3 - i, 'week')
        return {
          label: `W${i + 1}`,
          amount: income
            .filter((inc) => dayjs(inc.received_on).isSame(weekStart, 'week'))
            .reduce((sum, inc) => sum + Number(inc.amount), 0),
        }
      })
      break
    case 'Monthly':
      buckets = Array.from({ length: 4 }, (_, i) => {
        const month = now.subtract(3 - i, 'month')
        return {
          label: month.format('MMM'),
          amount: income
            .filter((inc) => dayjs(inc.received_on).isSame(month, 'month'))
            .reduce((sum, inc) => sum + Number(inc.amount), 0),
        }
      })
      break
    case 'Quarterly':
      buckets = Array.from({ length: 4 }, (_, i) => {
        const quarter = now.subtract(3 - i, 'quarter').startOf('quarter')
        return {
          label: `Q${i + 1}`,
          amount: income
            .filter((inc) => dayjs(inc.received_on).isSame(quarter, 'quarter'))
            .reduce((sum, inc) => sum + Number(inc.amount), 0),
        }
      })
      break
    case 'Yearly':
      buckets = Array.from({ length: 4 }, (_, i) => {
        const year = now.subtract(3 - i, 'year').startOf('year')
        return {
          label: year.format('YY'),
          amount: income
            .filter((inc) => dayjs(inc.received_on).isSame(year, 'year'))
            .reduce((sum, inc) => sum + Number(inc.amount), 0),
        }
      })
      break
  }

  return buckets
}

function buildCategoryTotals(income: IncomeRecord[]) {
  const totals = income.reduce<Record<string, number>>((map, inc) => {
    const key = inc.category_name || inc.source_name
    map[key] = (map[key] || 0) + Number(inc.amount)
    return map
  }, {})

  return Object.entries(totals)
    .map(([name, amount]) => ({
      name,
      amount,
      color: getIncomeCategoryColor(name),
    }))
    .sort((a, b) => b.amount - a.amount)
}

function buildSummary(income: IncomeRecord[], expenses: IncomeRecord[], period: ChartPeriod) {
  const now = dayjs()
  let periodStart: dayjs.Dayjs

  switch (period) {
    case 'Weekly':
      periodStart = now.startOf('week')
      break
    case 'Monthly':
      periodStart = now.startOf('month')
      break
    case 'Quarterly':
      periodStart = now.startOf('quarter')
      break
    case 'Yearly':
      periodStart = now.startOf('year')
      break
  }

  const totalIncome = income.reduce((sum, inc) => sum + Number(inc.amount), 0)
  const periodIncome = income
    .filter((inc) => dayjs(inc.received_on).isAfter(periodStart) || dayjs(inc.received_on).isSame(periodStart, 'day'))
    .reduce((sum, inc) => sum + Number(inc.amount), 0)

  return { totalIncome, periodIncome }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#22C55E' },
  content: { paddingBottom: 40 },
  topShell: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  topBarCaption: { color: '#BBF7D0', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 6 },
  addButton: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16 },
  addButtonText: { color: '#22C55E', fontWeight: '800' },
  balanceRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, flex: 1 },
  summaryPill: { width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  summaryTitle: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  summaryAmount: { color: '#1F2937', fontSize: 24, fontWeight: '800', marginTop: 4 },
  whitePanel: { backgroundColor: '#F7FAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -10, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  panelEyebrow: { color: '#7D8EA8', fontSize: 14, fontWeight: '600' },
  panelTitle: { color: '#1F2937', fontSize: 34, fontWeight: '800', marginTop: 4, marginBottom: 18 },
  panelTitleSecondary: { color: '#1F2937', fontSize: 22, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  segmentButton: { backgroundColor: '#E8EEF8', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  segmentButtonActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E3F6' },
  segmentButtonText: { color: '#6A7990', fontWeight: '700' },
  segmentButtonTextActive: { color: '#22C55E' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 50, alignItems: 'center' },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, marginBottom: 16 },
  barChartContainer: { width: '100%' },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 20 },
  chartLabelText: { color: '#8C9AAF', fontSize: 11, fontWeight: '600' },
  categoryList: { gap: 8 },
  categoryRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center' },
  categoryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  categoryName: { color: '#374151', fontSize: 15, fontWeight: '600', flex: 1 },
  categoryAmount: { color: '#22C55E', fontSize: 15, fontWeight: '800' },
  manageCategoriesButton: { marginTop: 16, alignItems: 'center' },
  manageCategoriesText: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#7D8EA8', fontSize: 15, textAlign: 'center', paddingVertical: 20 },
  incomeRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  incomeInfo: { flex: 1 },
  incomeSource: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  incomeDate: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  incomeRight: { alignItems: 'flex-end' },
  incomeAmount: { color: '#22C55E', fontSize: 16, fontWeight: '800' },
  deleteText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7, 27, 78, 0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  modalTitle: { color: '#1F2937', fontSize: 26, fontWeight: '800', marginBottom: 20 },
  inputLabel: { color: '#6B7280', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  categoryScroll: { marginHorizontal: -20, paddingHorizontal: 20 },
  chipWrap: { flexDirection: 'row', gap: 8 },
  categoryChip: { backgroundColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  categoryChipActive: { backgroundColor: '#22C55E' },
  categoryChipText: { color: '#4B5563', fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#FFFFFF' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#1F2937', fontSize: 15, marginTop: 8 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  recurringToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 10 },
  checkboxChecked: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  recurringText: { color: '#374151', fontSize: 15 },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelButtonText: { color: '#6B7280', fontWeight: '600' },
  modalSaveButton: { flex: 1, backgroundColor: '#22C55E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSaveButtonText: { color: '#FFFFFF', fontWeight: '800' },
})