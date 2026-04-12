import React, { useMemo, useRef, useState } from 'react'
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
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg'
import { create, open, type LinkExit, type LinkSuccess } from 'react-native-plaid-link-sdk'
import dayjs from 'dayjs'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  syncPlaidTransactions,
} from '../../lib/plaid'
import {
  ChartPeriod,
  DEFAULT_BUDGET_CATEGORIES,
  buildEffectiveExpenseAllocations,
  buildSplitSummary,
  createBudget,
  createExpense,
  deleteTransactionSplits,
  fetchBudgets,
  fetchExpenses,
  fetchTransactionSplits,
  getCategoryColor,
  saveTransactionSplits,
  seedFinanceDemoData,
  type BudgetRecord,
  type EffectiveExpenseAllocation,
  type ExpenseRecord,
  type SplitInput,
  type TransactionSplitRecord,
} from '../../lib/finance'

dayjs.extend(quarterOfYear)

const PERIOD_OPTIONS: ChartPeriod[] = ['Weekly', 'Monthly', 'Quarterly', 'Yearly']
const CHART_WIDTH = Dimensions.get('window').width - 64
const DONUT_SIZE = 190
const DONUT_STROKE = 28

type ChartPoint = {
  label: string
  shortLabel: string
  amount: number
}

type CategorySpendItem = {
  id: string
  name: string
  spent: number
  limit: number
  remaining: number
  color: string
}

type SplitDraftRow = {
  id: string
  categoryName: string
  amount: string
  note: string
}

export default function HomeScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const scrollRef = useRef<ScrollView | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<ChartPeriod>('Monthly')
  const [expenseFormY, setExpenseFormY] = useState(0)
  const [budgetCategory, setBudgetCategory] = useState('Food')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [customBudgetCategory, setCustomBudgetCategory] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Food')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseNote, setExpenseNote] = useState('')
  const [customExpenseCategory, setCustomExpenseCategory] = useState('')
  const [selectedTransaction, setSelectedTransaction] = useState<ExpenseRecord | null>(null)
  const [splitRows, setSplitRows] = useState<SplitDraftRow[]>([])

  const budgetsQuery = useQuery({
    queryKey: ['finance-budgets', user?.id],
    queryFn: () => fetchBudgets(user!.id),
    enabled: Boolean(user?.id),
  })

  const expensesQuery = useQuery({
    queryKey: ['finance-expenses', user?.id],
    queryFn: () => fetchExpenses(user!.id),
    enabled: Boolean(user?.id),
  })

  const splitsQuery = useQuery({
    queryKey: ['finance-splits', user?.id],
    queryFn: () => fetchTransactionSplits(user!.id),
    enabled: Boolean(user?.id),
  })

  const refreshFinanceData = async () => {
    if (!user?.id) {
      return
    }

    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['finance-budgets', user.id], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['finance-expenses', user.id], type: 'active' }),
      queryClient.refetchQueries({ queryKey: ['finance-splits', user.id], type: 'active' }),
    ])
  }

  const createBudgetMutation = useMutation({
    mutationFn: createBudget,
    onSuccess: async () => {
      setBudgetAmount('')
      setCustomBudgetCategory('')
      await refreshFinanceData()
    },
    onError: (error: Error) => Alert.alert('Budget save failed', error.message),
  })

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: async () => {
      setExpenseAmount('')
      setExpenseNote('')
      setCustomExpenseCategory('')
      await refreshFinanceData()
    },
    onError: (error: Error) => Alert.alert('Expense save failed', error.message),
  })

  const seedDemoMutation = useMutation({
    mutationFn: seedFinanceDemoData,
    onSuccess: async () => {
      await refreshFinanceData()
      Alert.alert('Demo data added', 'Sample budgets, imported transactions, and split allocations were added for this account.')
    },
    onError: (error: Error) => Alert.alert('Demo data failed', error.message),
  })

  const plaidConnectMutation = useMutation({
    mutationFn: async () => {
      const tokenResponse = await createPlaidLinkToken()
      create({ token: tokenResponse.link_token })

      const success = await new Promise<LinkSuccess>((resolve, reject) => {
        try {
          open({
            onSuccess: (success) => {
              resolve(success)
            },
            onExit: (exit: LinkExit) => {
              reject(new Error(getPlaidExitMessage(exit)))
            },
          })
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error('Unable to launch Plaid Link.')
            )
        }
      })

      const exchangeResult = await exchangePlaidPublicToken(success.publicToken, success.metadata)
      const syncResult = await syncPlaidTransactions()

      return {
        exchangeResult,
        syncResult,
      }
    },
    onSuccess: async ({ exchangeResult, syncResult }) => {
      await refreshFinanceData()
      Alert.alert(
        'Bank connected',
        `Connected ${exchangeResult.institutionName || 'bank account'} and imported ${syncResult.importedCount} transactions.`
      )
    },
    onError: (error: Error) => {
      Alert.alert('Plaid connection failed', error.message)
    },
  })

  const plaidSyncMutation = useMutation({
    mutationFn: syncPlaidTransactions,
    onSuccess: async (result) => {
      await refreshFinanceData()
      Alert.alert(
        'Transactions synced',
        `Imported ${result.importedCount}, updated ${result.modifiedCount}, removed ${result.removedCount}.`
      )
    },
    onError: (error: Error) => {
      Alert.alert('Sync failed', error.message)
    },
  })

  const saveSplitsMutation = useMutation({
    mutationFn: saveTransactionSplits,
    onSuccess: async () => {
      await refreshFinanceData()
      closeSplitModal()
      Alert.alert('Split saved', 'This transaction now reports from its split allocations.')
    },
    onError: (error: Error) => Alert.alert('Split save failed', error.message),
  })

  const deleteSplitsMutation = useMutation({
    mutationFn: deleteTransactionSplits,
    onSuccess: async () => {
      await refreshFinanceData()
      closeSplitModal()
      Alert.alert('Splits removed', 'This transaction is back to its original category behavior.')
    },
    onError: (error: Error) => Alert.alert('Delete failed', error.message),
  })

  const budgets = budgetsQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const splits = splitsQuery.data ?? []
  const isLoading = budgetsQuery.isLoading || expensesQuery.isLoading || splitsQuery.isLoading
  const hasSetupError = Boolean(budgetsQuery.error || expensesQuery.error || splitsQuery.error)

  const allocations = useMemo(
    () => buildEffectiveExpenseAllocations(expenses, splits),
    [expenses, splits]
  )
  const splitMap = useMemo(
    () =>
      splits.reduce<Record<string, TransactionSplitRecord[]>>((map, split) => {
        if (split.deleted_at) {
          return map
        }
        map[split.expense_id] = [...(map[split.expense_id] ?? []), split].sort(
          (a, b) => a.position - b.position
        )
        return map
      }, {}),
    [splits]
  )

  const chartData = useMemo(
    () => buildChartData(allocations, selectedPeriod),
    [allocations, selectedPeriod]
  )
  const chartPath = useMemo(() => buildLinePath(chartData), [chartData])
  const categorySpend = useMemo(
    () => buildCategorySpend(allocations, budgets),
    [allocations, budgets]
  )
  const overview = useMemo(() => buildOverview(allocations, budgets), [allocations, budgets])
  const donutSegments = useMemo(() => buildDonutSegments(categorySpend), [categorySpend])
  const activeBudgetCategory = customBudgetCategory.trim() || budgetCategory
  const activeExpenseCategory = customExpenseCategory.trim() || expenseCategory
  const splitSummary = selectedTransaction
    ? buildSplitSummary(splitRows, Number(selectedTransaction.amount))
    : { allocated: 0, remaining: 0, isBalanced: false }

  if (!user) {
    return null
  }

  const saveBudget = () => {
    const parsedAmount = Number(budgetAmount)
    if (!activeBudgetCategory || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid budget', 'Enter a category and a monthly limit greater than 0.')
      return
    }

    createBudgetMutation.mutate({
      userId: user.id,
      categoryName: activeBudgetCategory,
      monthlyLimit: parsedAmount,
      color: getCategoryColor(activeBudgetCategory),
    })
  }

  const saveExpense = () => {
    const parsedAmount = Number(expenseAmount)
    if (!activeExpenseCategory || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid expense', 'Enter a category and an amount greater than 0.')
      return
    }

    createExpenseMutation.mutate({
      userId: user.id,
      categoryName: activeExpenseCategory,
      amount: parsedAmount,
      note: expenseNote,
      source: 'manual',
    })
  }

  const jumpToExpenseForm = () => {
    scrollRef.current?.scrollTo({ y: Math.max(expenseFormY - 24, 0), animated: true })
  }

  const loadDemoData = () => {
    Alert.alert(
      'Load finance test data',
      'This adds sample imported transactions and split allocations for your account only.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load data', onPress: () => seedDemoMutation.mutate(user.id) },
      ]
    )
  }

  const openSplitModal = (expense: ExpenseRecord) => {
    const existingSplits = splitMap[expense.id] ?? []
    setSelectedTransaction(expense)
    setSplitRows(
      existingSplits.length > 0
        ? existingSplits.map((split) => ({
            id: split.id,
            categoryName: split.category_name,
            amount: String(Number(split.amount)),
            note: split.note ?? '',
          }))
        : [
            {
              id: createRowId(),
              categoryName: expense.category_name,
              amount: String(Number(expense.amount)),
              note: expense.note ?? '',
            },
          ]
    )
  }

  const closeSplitModal = () => {
    setSelectedTransaction(null)
    setSplitRows([])
  }

  const addSplitRow = () => {
    setSplitRows((current) => [
      ...current,
      { id: createRowId(), categoryName: 'Food', amount: '', note: '' },
    ])
  }

  const updateSplitRow = (rowId: string, patch: Partial<SplitDraftRow>) => {
    setSplitRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    )
  }

  const removeSplitRow = (rowId: string) => {
    setSplitRows((current) => current.filter((row) => row.id !== rowId))
  }

  const handleSaveSplits = () => {
    if (!selectedTransaction) {
      return
    }

    const preparedSplits: SplitInput[] = splitRows.map((row, index) => ({
      categoryName: row.categoryName.trim(),
      amount: Number(row.amount),
      note: row.note,
      position: index,
    }))

    saveSplitsMutation.mutate({
      userId: user.id,
      expenseId: selectedTransaction.id,
      expenseAmount: Number(selectedTransaction.amount),
      splits: preparedSplits,
    })
  }

  const handleDeleteSplits = () => {
    if (!selectedTransaction) {
      return
    }

    deleteSplitsMutation.mutate({
      userId: user.id,
      expenseId: selectedTransaction.id,
    })
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={
              budgetsQuery.isRefetching || expensesQuery.isRefetching || splitsQuery.isRefetching
            }
            onRefresh={refreshFinanceData}
            tintColor="#4B84D9"
          />
        }
      >
        <View style={styles.topShell}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarCaption}>Wealth overview</Text>
              <Text style={styles.topBarTitle}>Your finance dashboard</Text>
            </View>
            <View style={styles.userPill}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {(user.email?.[0] || 'U').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userPillText}>Private</Text>
            </View>
          </View>

          <View style={styles.topActionRow}>
            <TouchableOpacity style={styles.topPrimaryAction} onPress={jumpToExpenseForm}>
              <Text style={styles.topPrimaryActionText}>Add expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topSecondaryAction}
              onPress={loadDemoData}
              disabled={seedDemoMutation.isPending}
            >
              <Text style={styles.topSecondaryActionText}>
                {seedDemoMutation.isPending ? 'Adding data...' : 'Load test data'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.topActionRow}>
            <TouchableOpacity
              style={styles.topPlaidAction}
              onPress={() => plaidConnectMutation.mutate()}
              disabled={plaidConnectMutation.isPending}
            >
              <Text style={styles.topPlaidActionText}>
                {plaidConnectMutation.isPending ? 'Connecting...' : 'Connect bank'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topPlaidGhostAction}
              onPress={() => plaidSyncMutation.mutate()}
              disabled={plaidSyncMutation.isPending}
            >
              <Text style={styles.topPlaidGhostActionText}>
                {plaidSyncMutation.isPending ? 'Syncing...' : 'Sync Plaid'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <BalanceCard
              title="Current spend"
              amount={formatCurrency(overview.thisMonthSpend)}
              growth={overview.spendTrend}
              accent="#49C8F5"
            />
            <BalanceCard
              title="Budget remaining"
              amount={formatCurrency(overview.remainingBudget)}
              growth={overview.budgetTrend}
              accent="#FF8A1E"
            />
          </View>
        </View>

        <View style={styles.whitePanel}>
          <Text style={styles.panelEyebrow}>Overview</Text>
          <Text style={styles.panelTitle}>Spending snapshot</Text>

          <View style={styles.statBadgeRow}>
            <StatBadge color="#49C8F5" value={formatCompactCurrency(overview.thisWeekSpend)} label="Weekly" />
            <StatBadge color="#FF8A1E" value={formatCompactCurrency(overview.thisMonthSpend)} label="Monthly" />
            <StatBadge color="#F73883" value={formatCompactCurrency(overview.totalSpend)} label="Yearly" />
          </View>

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
              <ActivityIndicator color="#4B84D9" />
            </View>
          ) : hasSetupError ? (
            <View style={styles.schemaCard}>
              <Text style={styles.schemaTitle}>Schema not applied yet</Text>
              <Text style={styles.schemaBody}>
                The finance tables and split tables need to exist before live transaction data can load.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <View>
                    <Text style={styles.chartCardTitle}>Trend line</Text>
                    <Text style={styles.chartCardSubtitle}>{selectedPeriod} spending activity</Text>
                  </View>
                  <View style={styles.chartSummaryPill}>
                    <Text style={styles.chartSummaryValue}>{formatCompactCurrency(overview.periodTotal)}</Text>
                  </View>
                </View>

                <View style={styles.lineChartFrame}>
                  <Svg width={CHART_WIDTH} height={220}>
                    {[0, 1, 2, 3].map((grid) => {
                      const y = 30 + grid * 45
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
                    <Path d={chartPath.areaPath} fill="rgba(73, 200, 245, 0.16)" />
                    <Path
                      d={chartPath.linePath}
                      fill="none"
                      stroke="#49C8F5"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {chartPath.points.map((point, index) => (
                      <Circle
                        key={`point-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill={index % 2 === 0 ? '#FF8A1E' : '#F73883'}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                    ))}
                  </Svg>
                  <View style={styles.chartLabelsRow}>
                    {chartData.map((point) => (
                      <Text key={point.label} style={styles.chartLabelText}>
                        {point.shortLabel}
                      </Text>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.expensePanel}>
                <View style={styles.donutCard}>
                  <Text style={styles.cardTitle}>Expense split</Text>
                  <View style={styles.donutWrap}>
                    <DonutChart segments={donutSegments} total={overview.thisMonthSpend} />
                  </View>
                  <View style={styles.legendWrap}>
                    {donutSegments.map((segment) => (
                      <View key={segment.name} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: segment.color }]} />
                        <Text style={styles.legendText}>{segment.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.categoryCard}>
                  <Text style={styles.cardTitle}>Top spending categories</Text>
                  {categorySpend.length === 0 ? (
                    <Text style={styles.emptyInlineText}>Add budgets and expenses to populate this list.</Text>
                  ) : (
                    categorySpend.slice(0, 5).map((item) => <CategoryRow key={item.id} item={item} />)
                  )}
                </View>
              </View>
            </>
          )}

          <View style={styles.formSection}>
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Create budget</Text>
              <ChipSelector selected={budgetCategory} onSelect={setBudgetCategory} />
              <TextInput
                value={customBudgetCategory}
                onChangeText={setCustomBudgetCategory}
                placeholder="Custom category"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <TextInput
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                placeholder="Monthly budget"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <TouchableOpacity style={styles.blueButton} onPress={saveBudget}>
                <Text style={styles.blueButtonText}>
                  {createBudgetMutation.isPending ? 'Saving...' : 'Save budget'}
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={styles.formCard}
              onLayout={(event) => setExpenseFormY(event.nativeEvent.layout.y)}
            >
              <Text style={styles.cardTitle}>Add expense</Text>
              <ChipSelector selected={expenseCategory} onSelect={setExpenseCategory} />
              <TextInput
                value={customExpenseCategory}
                onChangeText={setCustomExpenseCategory}
                placeholder="Custom category"
                placeholderTextColor="#94A3B8"
                style={styles.input}
              />
              <TextInput
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder="Amount"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <TextInput
                value={expenseNote}
                onChangeText={setExpenseNote}
                placeholder="Optional note"
                placeholderTextColor="#94A3B8"
                style={[styles.input, styles.noteInput]}
                multiline
              />
              <TouchableOpacity style={styles.orangeButton} onPress={saveExpense}>
                <Text style={styles.orangeButtonText}>
                  {createExpenseMutation.isPending ? 'Saving...' : 'Add expense'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.activityCardLarge}>
            <Text style={styles.cardTitle}>Recent transactions</Text>
            {expenses.length === 0 ? (
              <Text style={styles.emptyInlineText}>No finance activity yet for this account.</Text>
            ) : (
              expenses.slice(0, 8).map((expense) => {
                const expenseSplits = splitMap[expense.id] ?? []
                return (
                  <View key={expense.id} style={styles.transactionCard}>
                    <View style={styles.transactionRow}>
                      <View style={styles.transactionIcon}>
                        <Text style={styles.transactionIconText}>
                          {expense.category_name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.transactionCopy}>
                        <Text style={styles.transactionTitle}>
                          {expense.merchant_name || expense.category_name}
                        </Text>
                        <Text style={styles.transactionMeta}>
                          {expense.note || dayjs(expense.spent_on).format('MMM D')}
                        </Text>
                        <View style={styles.transactionBadgeRow}>
                          <View style={styles.sourceBadge}>
                            <Text style={styles.sourceBadgeText}>
                              {(expense.source || 'manual').toUpperCase()}
                            </Text>
                          </View>
                          {expenseSplits.length > 0 ? (
                            <View style={styles.splitBadge}>
                              <Text style={styles.splitBadgeText}>
                                {expenseSplits.length} split lines
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Text style={styles.transactionAmount}>
                        {formatCurrency(Number(expense.amount))}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.transactionAction}
                      onPress={() => openSplitModal(expense)}
                    >
                      <Text style={styles.transactionActionText}>
                        {expenseSplits.length > 0 ? 'Edit split allocation' : 'Split transaction'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              })
            )}
          </View>
        </View>
      </ScrollView>

      <SplitTransactionModal
        visible={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        splitRows={splitRows}
        splitSummary={splitSummary}
        onClose={closeSplitModal}
        onAddRow={addSplitRow}
        onUpdateRow={updateSplitRow}
        onRemoveRow={removeSplitRow}
        onSave={handleSaveSplits}
        onDelete={handleDeleteSplits}
        isSaving={saveSplitsMutation.isPending}
        isDeleting={deleteSplitsMutation.isPending}
      />
    </SafeAreaView>
  )
}

function SplitTransactionModal({
  visible,
  transaction,
  splitRows,
  splitSummary,
  onClose,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  visible: boolean
  transaction: ExpenseRecord | null
  splitRows: SplitDraftRow[]
  splitSummary: { allocated: number; remaining: number; isBalanced: boolean }
  onClose: () => void
  onAddRow: () => void
  onUpdateRow: (rowId: string, patch: Partial<SplitDraftRow>) => void
  onRemoveRow: (rowId: string) => void
  onSave: () => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Split transaction</Text>
          <Text style={styles.modalSubtitle}>
            {transaction?.merchant_name || transaction?.note || transaction?.category_name}
          </Text>
          <Text style={styles.modalAmount}>
            Original amount: {formatCurrency(Number(transaction?.amount || 0))}
          </Text>

          <ScrollView style={styles.modalRows} contentContainerStyle={styles.modalRowsContent}>
            {splitRows.map((row, index) => (
              <View key={row.id} style={styles.splitRowCard}>
                <Text style={styles.splitRowTitle}>Allocation {index + 1}</Text>
                <ChipSelector
                  selected={row.categoryName}
                  onSelect={(value) => onUpdateRow(row.id, { categoryName: value })}
                />
                <TextInput
                  value={row.amount}
                  onChangeText={(value) => onUpdateRow(row.id, { amount: value })}
                  placeholder="Amount"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <TextInput
                  value={row.note}
                  onChangeText={(value) => onUpdateRow(row.id, { note: value })}
                  placeholder="Optional note"
                  placeholderTextColor="#94A3B8"
                  style={[styles.input, styles.noteInput]}
                  multiline
                />
                {splitRows.length > 1 ? (
                  <TouchableOpacity
                    style={styles.removeSplitButton}
                    onPress={() => onRemoveRow(row.id)}
                  >
                    <Text style={styles.removeSplitButtonText}>Remove row</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.addSplitButton} onPress={onAddRow}>
            <Text style={styles.addSplitButtonText}>Add allocation row</Text>
          </TouchableOpacity>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              Allocated: {formatCurrency(splitSummary.allocated)}
            </Text>
            <Text
              style={[
                styles.summaryText,
                !splitSummary.isBalanced && styles.summaryTextWarning,
              ]}
            >
              Remaining: {formatCurrency(splitSummary.remaining)}
            </Text>
          </View>

          <View style={styles.modalActionRow}>
            <TouchableOpacity style={styles.modalGhostButton} onPress={onClose}>
              <Text style={styles.modalGhostButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalDeleteButton} onPress={onDelete}>
              <Text style={styles.modalDeleteButtonText}>
                {isDeleting ? 'Removing...' : 'Delete splits'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                !splitSummary.isBalanced && styles.modalSaveButtonDisabled,
              ]}
              onPress={onSave}
              disabled={!splitSummary.isBalanced || isSaving}
            >
              <Text style={styles.modalSaveButtonText}>
                {isSaving ? 'Saving...' : 'Save splits'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function BalanceCard({
  title,
  amount,
  growth,
  accent,
}: {
  title: string
  amount: string
  growth: string
  accent: string
}) {
  return (
    <View style={styles.balanceCard}>
      <View style={styles.balanceHeader}>
        <View style={[styles.growthPill, { backgroundColor: accent }]}>
          <Text style={styles.growthText}>{growth}</Text>
        </View>
        <MiniSparkline accent={accent} />
      </View>
      <Text style={styles.balanceTitle}>{title}</Text>
      <Text style={styles.balanceAmount}>{amount}</Text>
    </View>
  )
}

function MiniSparkline({ accent }: { accent: string }) {
  return (
    <Svg width={110} height={56}>
      <Polyline
        points="6,42 22,34 38,38 54,26 70,18 86,26 102,14"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="102" cy="14" r="4" fill="#F73883" />
    </Svg>
  )
}

function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ name: string; color: string; value: number; percent: number }>
  total: number
}) {
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  let offsetCursor = 0

  return (
    <View style={styles.donutContainer}>
      <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
        <Circle
          cx={DONUT_SIZE / 2}
          cy={DONUT_SIZE / 2}
          r={radius}
          stroke="#E7EEF9"
          strokeWidth={DONUT_STROKE}
          fill="transparent"
        />
        {segments.map((segment) => {
          const dash = circumference * segment.percent
          const gap = circumference - dash
          const circle = (
            <Circle
              key={segment.name}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={DONUT_STROKE}
              fill="transparent"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetCursor}
              strokeLinecap="butt"
              rotation="-90"
              origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
            />
          )
          offsetCursor += dash
          return circle
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterLabel}>This month</Text>
        <Text style={styles.donutCenterAmount}>{formatCompactCurrency(total)}</Text>
      </View>
    </View>
  )
}

function StatBadge({
  color,
  value,
  label,
}: {
  color: string
  value: string
  label: string
}) {
  return (
    <View style={styles.statBadge}>
      <View style={[styles.statBadgeIcon, { backgroundColor: color }]} />
      <View>
        <Text style={styles.statBadgeValue}>{value}</Text>
        <Text style={styles.statBadgeLabel}>{label}</Text>
      </View>
    </View>
  )
}

function ChipSelector({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <View style={styles.chipWrap}>
      {DEFAULT_BUDGET_CATEGORIES.map((category) => (
        <TouchableOpacity
          key={category.name}
          style={[
            styles.categoryChip,
            selected === category.name && styles.categoryChipActive,
          ]}
          onPress={() => onSelect(category.name)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selected === category.name && styles.categoryChipTextActive,
            ]}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function CategoryRow({ item }: { item: CategorySpendItem }) {
  return (
    <View style={styles.categoryRow}>
      <View style={[styles.categoryIcon, { backgroundColor: item.color }]}>
        <Text style={styles.categoryIconText}>{item.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.categoryCopy}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categorySpent}>{formatCurrency(item.spent)} spent</Text>
      </View>
      <Text style={styles.categoryChevron}>
        {item.limit > 0 ? formatCurrency(item.remaining) : formatCurrency(item.spent)}
      </Text>
    </View>
  )
}

function buildOverview(allocations: EffectiveExpenseAllocation[], budgets: BudgetRecord[]) {
  const now = dayjs()
  const thisMonthAllocations = allocations.filter((entry) =>
    dayjs(entry.spent_on).isSame(now, 'month')
  )
  const thisWeekAllocations = allocations.filter((entry) =>
    dayjs(entry.spent_on).isSame(now, 'week')
  )

  const totalSpend = sumAmounts(allocations.map((entry) => Number(entry.amount)))
  const thisMonthSpend = sumAmounts(thisMonthAllocations.map((entry) => Number(entry.amount)))
  const thisWeekSpend = sumAmounts(thisWeekAllocations.map((entry) => Number(entry.amount)))
  const totalBudget = sumAmounts(budgets.map((budget) => Number(budget.monthly_limit)))

  return {
    totalSpend,
    thisMonthSpend,
    thisWeekSpend,
    remainingBudget: totalBudget - thisMonthSpend,
    spendTrend: thisMonthSpend > 0 ? `↑ ${Math.min(Math.round((thisWeekSpend / thisMonthSpend) * 100), 99)}%` : '↑ 0%',
    budgetTrend: totalBudget > 0 ? `↑ ${Math.max(Math.round(((totalBudget - thisMonthSpend) / totalBudget) * 100), 0)}%` : '↑ 0%',
    periodTotal: thisMonthSpend,
  }
}

function buildCategorySpend(
  allocations: EffectiveExpenseAllocation[],
  budgets: BudgetRecord[]
): CategorySpendItem[] {
  const currentMonth = dayjs()
  const spendByCategory = allocations.reduce<Record<string, number>>((map, allocation) => {
    if (!dayjs(allocation.spent_on).isSame(currentMonth, 'month')) {
      return map
    }

    const key = allocation.category_name.trim()
    map[key] = (map[key] ?? 0) + Number(allocation.amount)
    return map
  }, {})

  const budgetMap = budgets.reduce<Record<string, BudgetRecord>>((map, budget) => {
    map[budget.category_name.trim()] = budget
    return map
  }, {})

  const allCategories = Array.from(
    new Set([...Object.keys(spendByCategory), ...Object.keys(budgetMap)])
  )

  return allCategories
    .map((name) => {
      const budget = budgetMap[name]
      const spent = spendByCategory[name] ?? 0
      const limit = budget ? Number(budget.monthly_limit) : 0
      return {
        id: budget?.id ?? name,
        name,
        spent,
        limit,
        remaining: limit - spent,
        color: budget?.color || getCategoryColor(name),
      }
    })
    .sort((a, b) => b.spent - a.spent)
}

function buildDonutSegments(items: CategorySpendItem[]) {
  const source = items.filter((item) => item.spent > 0).slice(0, 5)
  const total = sumAmounts(source.map((item) => item.spent))

  if (total === 0) {
    return DEFAULT_BUDGET_CATEGORIES.map((category) => ({
      name: category.name,
      color: category.color,
      value: 1,
      percent: 1 / DEFAULT_BUDGET_CATEGORIES.length,
    }))
  }

  return source.map((item) => ({
    name: item.name,
    color: item.color,
    value: item.spent,
    percent: item.spent / total,
  }))
}

function buildChartData(
  allocations: EffectiveExpenseAllocation[],
  period: ChartPeriod
): ChartPoint[] {
  if (period === 'Weekly') {
    const start = dayjs().startOf('day').subtract(6, 'day')
    return Array.from({ length: 7 }, (_, index) => {
      const date = start.add(index, 'day')
      return {
        label: date.format('MMM D'),
        shortLabel: date.format('dd'),
        amount: sumAllocations(allocations, (spentOn) => spentOn.isSame(date, 'day')),
      }
    })
  }

  if (period === 'Monthly') {
    const start = dayjs().startOf('week').subtract(3, 'week')
    return Array.from({ length: 4 }, (_, index) => {
      const bucketStart = start.add(index, 'week')
      const bucketEnd = bucketStart.endOf('week')
      return {
        label: `${bucketStart.format('MMM D')} - ${bucketEnd.format('MMM D')}`,
        shortLabel: `W${index + 1}`,
        amount: sumAllocations(
          allocations,
          (spentOn) =>
            (spentOn.isAfter(bucketStart) || spentOn.isSame(bucketStart, 'day')) &&
            (spentOn.isBefore(bucketEnd) || spentOn.isSame(bucketEnd, 'day'))
        ),
      }
    })
  }

  if (period === 'Quarterly') {
    const start = dayjs().startOf('quarter')
    return Array.from({ length: 3 }, (_, index) => {
      const month = start.add(index, 'month')
      return {
        label: month.format('MMMM'),
        shortLabel: month.format('MMM'),
        amount: sumAllocations(allocations, (spentOn) => spentOn.isSame(month, 'month')),
      }
    })
  }

  const yearStart = dayjs().startOf('year')
  return Array.from({ length: 12 }, (_, index) => {
    const month = yearStart.add(index, 'month')
    return {
      label: month.format('MMMM'),
      shortLabel: month.format('MMM'),
      amount: sumAllocations(allocations, (spentOn) => spentOn.isSame(month, 'month')),
    }
  })
}

function buildLinePath(data: ChartPoint[]) {
  const width = CHART_WIDTH
  const height = 200
  const paddingX = 10
  const paddingY = 18
  const maxValue = Math.max(...data.map((point) => point.amount), 1)
  const xStep = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0

  const points = data.map((point, index) => {
    const x = paddingX + index * xStep
    const y = height - paddingY - (point.amount / maxValue) * (height - paddingY * 2)
    return { x, y }
  })

  if (points.length === 0) {
    return { linePath: '', areaPath: '', points: [] as Array<{ x: number; y: number }> }
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`

  return { linePath, areaPath, points }
}

function sumAllocations(
  allocations: EffectiveExpenseAllocation[],
  predicate: (date: dayjs.Dayjs) => boolean
) {
  return allocations.reduce((sum, allocation) => {
    const date = dayjs(allocation.spent_on)
    return predicate(date) ? sum + Number(allocation.amount) : sum
  }, 0)
}

function sumAmounts(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function createRowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getPlaidExitMessage(exit: LinkExit) {
  const errorMessage =
    typeof exit?.error === 'object' &&
    exit?.error !== null &&
    'display_message' in exit.error &&
    typeof (exit.error as { display_message?: unknown }).display_message === 'string'
      ? (exit.error as { display_message: string }).display_message
      : null

  return errorMessage || 'The Plaid flow was closed before completing bank connection.'
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#4B84D9' },
  content: { paddingBottom: 40 },
  topShell: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, backgroundColor: '#4B84D9' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  topBarCaption: { color: '#DDEAFE', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 6, maxWidth: 220 },
  userPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  userAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  userAvatarText: { color: '#2B5FB3', fontWeight: '800' },
  userPillText: { color: '#FFFFFF', fontWeight: '700' },
  topActionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  topPrimaryAction: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18 },
  topPrimaryActionText: { color: '#2B5FB3', fontWeight: '800', fontSize: 15 },
  topSecondaryAction: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },
  topSecondaryActionText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  topPlaidAction: { backgroundColor: '#071B4E', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18 },
  topPlaidActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  topPlaidGhostAction: { backgroundColor: '#CFE1FF', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 18 },
  topPlaidGhostActionText: { color: '#0E3D97', fontWeight: '800', fontSize: 15 },
  balanceRow: { gap: 12 },
  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 12, shadowColor: '#2452A0', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  growthPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  growthText: { color: '#FFFFFF', fontWeight: '800' },
  balanceTitle: { color: '#65748B', fontSize: 15, marginBottom: 6 },
  balanceAmount: { color: '#0E3D97', fontSize: 32, fontWeight: '800' },
  whitePanel: { backgroundColor: '#F7FAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -10, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  panelEyebrow: { color: '#7D8EA8', fontSize: 14, fontWeight: '600' },
  panelTitle: { color: '#0E3D97', fontSize: 34, fontWeight: '800', marginTop: 4, marginBottom: 18 },
  statBadgeRow: { marginBottom: 14 },
  statBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginBottom: 10 },
  statBadgeIcon: { width: 18, height: 18, borderRadius: 6, marginRight: 12 },
  statBadgeValue: { color: '#071B4E', fontSize: 22, fontWeight: '800' },
  statBadgeLabel: { color: '#7D8EA8', fontSize: 13, marginTop: 2 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
  segmentButton: { backgroundColor: '#E8EEF8', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  segmentButtonActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E3F6' },
  segmentButtonText: { color: '#6A7990', fontWeight: '700' },
  segmentButtonTextActive: { color: '#2480DA' },
  loadingCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 50, alignItems: 'center', justifyContent: 'center' },
  schemaCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, marginBottom: 12 },
  schemaTitle: { color: '#0E3D97', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  schemaBody: { color: '#617188', fontSize: 15, lineHeight: 22 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 16 },
  chartHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chartCardTitle: { color: '#0E3D97', fontSize: 22, fontWeight: '800' },
  chartCardSubtitle: { color: '#7B8BA1', fontSize: 14, marginTop: 4 },
  chartSummaryPill: { backgroundColor: '#EEF6FF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  chartSummaryValue: { color: '#2480DA', fontWeight: '800' },
  lineChartFrame: { width: '100%' },
  chartLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4, paddingHorizontal: 4 },
  chartLabelText: { color: '#8C9AAF', fontSize: 11, fontWeight: '600' },
  expensePanel: { gap: 16 },
  donutCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  cardTitle: { color: '#0E3D97', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  donutWrap: { alignItems: 'center', marginBottom: 8 },
  donutContainer: { width: DONUT_SIZE, height: DONUT_SIZE, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterLabel: { color: '#7B8BA1', fontSize: 13, marginBottom: 4 },
  donutCenterAmount: { color: '#0E3D97', fontSize: 20, fontWeight: '800' },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#617188', fontSize: 13, fontWeight: '600' },
  categoryCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  emptyInlineText: { color: '#7B8BA1', fontSize: 15, lineHeight: 22 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3FB' },
  categoryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryIconText: { color: '#FFFFFF', fontWeight: '800' },
  categoryCopy: { flex: 1 },
  categoryName: { color: '#5F6E83', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  categorySpent: { color: '#1E2E49', fontSize: 16, fontWeight: '700' },
  categoryChevron: { color: '#2480DA', fontSize: 13, fontWeight: '700', paddingLeft: 10 },
  formSection: { gap: 16, marginTop: 16 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  categoryChip: { backgroundColor: '#EAF1FB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 10 },
  categoryChipActive: { backgroundColor: '#4B84D9' },
  categoryChipText: { color: '#56708F', fontWeight: '700', fontSize: 13 },
  categoryChipTextActive: { color: '#FFFFFF' },
  input: { backgroundColor: '#F5F8FD', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, color: '#173155', fontSize: 15, marginTop: 10 },
  noteInput: { minHeight: 88, textAlignVertical: 'top' },
  blueButton: { backgroundColor: '#4B84D9', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  blueButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  orangeButton: { backgroundColor: '#FF8A1E', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  orangeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  activityCardLarge: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginTop: 16 },
  transactionCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3FB' },
  transactionRow: { flexDirection: 'row', alignItems: 'center' },
  transactionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DDEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  transactionIconText: { color: '#2B5FB3', fontWeight: '800' },
  transactionCopy: { flex: 1 },
  transactionTitle: { color: '#1E2E49', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  transactionMeta: { color: '#8B9AB0', fontSize: 13 },
  transactionAmount: { color: '#1E2E49', fontSize: 15, fontWeight: '800', marginLeft: 12 },
  transactionBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sourceBadge: { backgroundColor: '#EAF1FB', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  sourceBadgeText: { color: '#2B5FB3', fontSize: 11, fontWeight: '800' },
  splitBadge: { backgroundColor: '#FFF2E4', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  splitBadgeText: { color: '#FF8A1E', fontSize: 11, fontWeight: '800' },
  transactionAction: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: '#4B84D9', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  transactionActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7, 27, 78, 0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%' },
  modalTitle: { color: '#0E3D97', fontSize: 26, fontWeight: '800' },
  modalSubtitle: { color: '#617188', fontSize: 15, marginTop: 6 },
  modalAmount: { color: '#1E2E49', fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  modalRows: { maxHeight: 360 },
  modalRowsContent: { paddingBottom: 10 },
  splitRowCard: { backgroundColor: '#F7FAFF', borderRadius: 20, padding: 14, marginBottom: 12 },
  splitRowTitle: { color: '#0E3D97', fontSize: 16, fontWeight: '800' },
  removeSplitButton: { alignSelf: 'flex-start', marginTop: 10, backgroundColor: '#FFE9E8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  removeSplitButtonText: { color: '#D94B4B', fontWeight: '800' },
  addSplitButton: { backgroundColor: '#EEF6FF', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 8 },
  addSplitButtonText: { color: '#2480DA', fontWeight: '800', fontSize: 15 },
  summaryCard: { backgroundColor: '#F7FAFF', borderRadius: 18, padding: 14, marginTop: 12 },
  summaryText: { color: '#1E2E49', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  summaryTextWarning: { color: '#D94B4B' },
  modalActionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  modalGhostButton: { flex: 1, backgroundColor: '#EEF3FB', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  modalGhostButtonText: { color: '#2B5FB3', fontWeight: '800' },
  modalDeleteButton: { flex: 1, backgroundColor: '#FFE9E8', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  modalDeleteButtonText: { color: '#D94B4B', fontWeight: '800', fontSize: 13 },
  modalSaveButton: { flex: 1, backgroundColor: '#4B84D9', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  modalSaveButtonDisabled: { opacity: 0.4 },
  modalSaveButtonText: { color: '#FFFFFF', fontWeight: '800' },
})
