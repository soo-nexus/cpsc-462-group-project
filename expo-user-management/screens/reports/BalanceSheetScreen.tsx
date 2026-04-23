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
import Svg, { Circle } from 'react-native-svg'
import dayjs from 'dayjs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import {
  calculateBalanceSheet,
  createAsset,
  createLiability,
  deleteAsset,
  deleteLiability,
  fetchAssets,
  fetchExpenses,
  fetchIncome,
  fetchLiabilities,
  markAssetPaid,
  markLiabilityPaid,
  type AssetRecord,
  type LiabilityRecord,
} from '../../lib/finance'

const DONUT_SIZE = 160
const DONUT_STROKE = 24

type LiabType = 'accounts_payable' | 'notes_payable' | 'accrued_expense' | 'deferred_revenue'

const LIABILITY_TYPES: { type: LiabType; label: string }[] = [
  { type: 'accounts_payable', label: 'Accounts Payable' },
  { type: 'notes_payable', label: 'Notes Payable' },
  { type: 'accrued_expense', label: 'Accrued Expenses' },
  { type: 'deferred_revenue', label: 'Deferred Revenue' },
]

export default function BalanceSheetScreen() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [showLiabilityModal, setShowLiabilityModal] = useState(false)

  const [assetName, setAssetName] = useState('')
  const [assetAmount, setAssetAmount] = useState('')
  const [assetDueDate, setAssetDueDate] = useState('')
  const [assetDescription, setAssetDescription] = useState('')

  const [liabName, setLiabName] = useState('')
  const [liabAmount, setLiabAmount] = useState('')
  const [liabType, setLiabType] = useState<LiabType>('accounts_payable')
  const [liabDueDate, setLiabDueDate] = useState('')
  const [liabDescription, setLiabDescription] = useState('')

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

  const createAssetMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: async () => {
      setAssetName('')
      setAssetAmount('')
      setAssetDueDate('')
      setAssetDescription('')
      setShowAssetModal(false)
      await queryClient.refetchQueries({ queryKey: ['finance-assets', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed to add', error.message),
  })

  const markAssetPaidMutation = useMutation({
    mutationFn: markAssetPaid,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['finance-assets', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed', error.message),
  })

  const deleteAssetMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['finance-assets', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed', error.message),
  })

  const createLiabilityMutation = useMutation({
    mutationFn: createLiability,
    onSuccess: async () => {
      setLiabName('')
      setLiabAmount('')
      setLiabType('accounts_payable')
      setLiabDueDate('')
      setLiabDescription('')
      setShowLiabilityModal(false)
      await queryClient.refetchQueries({ queryKey: ['finance-liabilities', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed to add', error.message),
  })

  const markLiabilityPaidMutation = useMutation({
    mutationFn: markLiabilityPaid,
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['finance-liabilities', user?.id] })
    },
    onError: (error: Error) => Alert.alert('Failed', error.message),
  })

  const income = incomeQuery.data ?? []
  const expenses = expensesQuery.data ?? []
  const assets = assetsQuery.data ?? []
  const liabilities = liabilitiesQuery.data ?? []
  const isLoading = incomeQuery.isLoading || expensesQuery.isLoading || assetsQuery.isLoading || liabilitiesQuery.isLoading

  const balanceSheet = useMemo(
    () => calculateBalanceSheet(income, expenses, assets, liabilities),
    [income, expenses, assets, liabilities]
  )

  const assetSegments = useMemo(
    () => [
      { name: 'Cash', value: balanceSheet.cash, color: '#22C55E' },
      { name: 'Receivable', value: balanceSheet.accountsReceivable, color: '#3B82F6' },
    ].filter(s => s.value > 0),
    [balanceSheet]
  )

  const liabSegments = useMemo(
    () => [
      { name: 'Accounts Payable', value: balanceSheet.accountsPayable, color: '#EF4444' },
      { name: 'Notes Payable', value: balanceSheet.notesPayable, color: '#F97316' },
      { name: 'Accrued', value: balanceSheet.accruedExpenses, color: '#8B5CF6' },
      { name: 'Deferred', value: balanceSheet.deferredRevenue, color: '#EC4899' },
    ].filter(s => s.value > 0),
    [balanceSheet]
  )

  const refreshData = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['finance-income', user?.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-expenses', user?.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-assets', user?.id] }),
      queryClient.refetchQueries({ queryKey: ['finance-liabilities', user?.id] }),
    ])
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshData} tintColor="#3B82F6" />
        }
      >
        <View style={styles.topShell}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarCaption}>Net worth</Text>
              <Text style={styles.topBarTitle}>Your balance sheet</Text>
            </View>
          </View>

          <View style={styles.netWorthCard}>
            <Text style={styles.netWorthLabel}>Net Worth</Text>
            <Text
              style={[
                styles.netWorthAmount,
                balanceSheet.netWorth >= 0 ? styles.positiveAmount : styles.negativeAmount,
              ]}
            >
              {formatCurrency(balanceSheet.netWorth)}
            </Text>
          </View>
        </View>

        <View style={styles.whitePanel}>
          <Text style={styles.sectionTitle}>Assets</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>Total Assets</Text>
              <Text style={styles.summaryValue}>{formatCurrency(balanceSheet.totalAssets)}</Text>
            </View>
          </View>

          <View style={styles.chartRow}>
            <View style={styles.donutCard}>
              <DonutChart segments={assetSegments} total={balanceSheet.totalAssets} />
            </View>
            <View style={styles.legendCard}>
              {assetSegments.map((seg) => (
                <View key={seg.name} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.legendName}>{seg.name}</Text>
                  <Text style={styles.legendValue}>{formatCurrency(seg.value)}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={() => setShowAssetModal(true)}>
            <Text style={styles.addButtonText}>+ Add Money Owed to You</Text>
          </TouchableOpacity>

          {assets.filter(a => !a.is_paid).length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.listTitle}>Outstanding Receivables</Text>
              {assets.filter(a => !a.is_paid).map((asset) => (
                <AssetRow key={asset.id} asset={asset} onMarkPaid={() => markAssetPaidMutation.mutate(asset.id)} />
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Liabilities</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>Total Liabilities</Text>
              <Text style={[styles.summaryValue, styles.negativeValue]}>
                {formatCurrency(balanceSheet.totalLiabilities)}
              </Text>
            </View>
          </View>

          <View style={styles.chartRow}>
            <View style={styles.donutCard}>
              <DonutChart segments={liabSegments} total={balanceSheet.totalLiabilities} />
            </View>
            <View style={styles.legendCard}>
              {liabSegments.map((seg) => (
                <View key={seg.name} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <Text style={styles.legendName}>{seg.name}</Text>
                  <Text style={styles.legendValue}>{formatCurrency(seg.value)}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={() => setShowLiabilityModal(true)}>
            <Text style={styles.addButtonText}>+ Add Money You Owe</Text>
          </TouchableOpacity>

          {liabilities.filter(l => !l.is_paid).length > 0 && (
            <View style={styles.listSection}>
              <Text style={styles.listTitle}>Outstanding Liabilities</Text>
              {liabilities.filter(l => !l.is_paid).map((liab) => (
                <LiabilityRow key={liab.id} liability={liab} onMarkPaid={() => markLiabilityPaidMutation.mutate(liab.id)} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAssetModal} transparent animationType="slide" onRequestClose={() => setShowAssetModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Money Owed to You</Text>
            <Text style={styles.modalSubtitle}>Track IOUs and receivable amounts</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={assetName}
              onChangeText={setAssetName}
              placeholder="Who owes you?"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              value={assetAmount}
              onChangeText={setAssetAmount}
              placeholder="Amount"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Due Date (optional)</Text>
            <TextInput
              value={assetDueDate}
              onChangeText={setAssetDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              value={assetDescription}
              onChangeText={setAssetDescription}
              placeholder="Description"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.noteInput]}
              multiline
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowAssetModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, !assetName.trim() || !Number(assetAmount) && styles.modalSaveButtonDisabled]}
                onPress={() => {
                  if (!assetName.trim() || !Number(assetAmount)) { return }
                  createAssetMutation.mutate({
                    userId: user.id,
                    name: assetName,
                    amount: Number(assetAmount),
                    dueDate: assetDueDate || undefined,
                    description: assetDescription || undefined,
                  })
                }}
                disabled={!assetName.trim() || !Number(assetAmount)}
              >
                <Text style={styles.modalSaveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showLiabilityModal} transparent animationType="slide" onRequestClose={() => setShowLiabilityModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Money You Owe</Text>
            <Text style={styles.modalSubtitle}>Track bills, loans, and deferred revenue</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={liabName}
              onChangeText={setLiabName}
              placeholder="Who are you paying?"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              value={liabAmount}
              onChangeText={setLiabAmount}
              placeholder="Amount"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Type</Text>
            <View style={styles.chipWrap}>
              {LIABILITY_TYPES.map(t => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.chip, liabType === t.type && styles.chipActive]}
                  onPress={() => setLiabType(t.type)}
                >
                  <Text style={[styles.chipText, liabType === t.type && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Due Date (optional)</Text>
            <TextInput
              value={liabDueDate}
              onChangeText={setLiabDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              value={liabDescription}
              onChangeText={setLiabDescription}
              placeholder="Description"
              placeholderTextColor="#94A3B8"
              style={[styles.input, styles.noteInput]}
              multiline
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowLiabilityModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, !liabName.trim() || !Number(liabAmount) && styles.modalSaveButtonDisabled]}
                onPress={() => {
                  if (!liabName.trim() || !Number(liabAmount)) { return }
                  createLiabilityMutation.mutate({
                    userId: user.id,
                    name: liabName,
                    amount: Number(liabAmount),
                    liabilityType: liabType,
                    dueDate: liabDueDate || undefined,
                    description: liabDescription || undefined,
                  })
                }}
                disabled={!liabName.trim() || !Number(liabAmount)}
              >
                <Text style={styles.modalSaveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ name: string; value: number; color: string }>
  total: number
}) {
  const radius = (DONUT_SIZE - DONUT_STROKE) / 2
  const circumference = 2 * Math.PI * radius
  let offsetCursor = 0

  if (total === 0) return null

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
        {segments.map((seg) => {
          const dash = circumference * (seg.value / total)
          const gap = circumference - dash
          offsetCursor += dash
          return (
            <Circle
              key={seg.name}
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={DONUT_STROKE}
              fill="transparent"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetCursor + circumference / 2}
              rotation="-90"
            />
          )
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterLabel}>Total</Text>
        <Text style={styles.donutCenterAmount}>{formatCompactCurrency(total)}</Text>
      </View>
    </View>
  )
}

function AssetRow({ asset, onMarkPaid }: { asset: AssetRecord; onMarkPaid: () => void }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{asset.name}</Text>
        {asset.due_date && (
          <Text style={styles.listDate}>Due: {dayjs(asset.due_date).format('MMM D, YYYY')}</Text>
        )}
        {asset.description && <Text style={styles.listDesc}>{asset.description}</Text>}
      </View>
      <View style={styles.listRight}>
        <Text style={styles.listAmount}>{formatCurrency(asset.amount)}</Text>
        <TouchableOpacity onPress={onMarkPaid}>
          <Text style={styles.markPaidText}>Mark Paid</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function LiabilityRow({ liability, onMarkPaid }: { liability: LiabilityRecord; onMarkPaid: () => void }) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listInfo}>
        <Text style={styles.listName}>{liability.name}</Text>
        <Text style={styles.listType}>{liability.liability_type.replace('_', ' ')}</Text>
        {liability.due_date && (
          <Text style={styles.listDate}>Due: {dayjs(liability.due_date).format('MMM D, YYYY')}</Text>
        )}
      </View>
      <View style={styles.listRight}>
        <Text style={[styles.listAmount, styles.negativeValue]}>
          {formatCurrency(liability.amount)}
        </Text>
        <TouchableOpacity onPress={onMarkPaid}>
          <Text style={styles.markPaidText}>Mark Paid</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#3B82F6' },
  content: { paddingBottom: 40 },
  topShell: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  topBar: { marginBottom: 20 },
  topBarCaption: { color: '#BFDBFE', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  topBarTitle: { color: '#FFFFFF', fontSize: 29, fontWeight: '800', marginTop: 6 },
  netWorthCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  netWorthLabel: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  netWorthAmount: { fontSize: 40, fontWeight: '800', marginTop: 8 },
  positiveAmount: { color: '#22C55E' },
  negativeAmount: { color: '#EF4444' },
  whitePanel: { backgroundColor: '#F7FAFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -10, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  sectionTitle: { color: '#1F2937', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  summaryValue: { color: '#22C55E', fontSize: 20, fontWeight: '800' },
  negativeValue: { color: '#EF4444' },
  chartRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  donutCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, alignItems: 'center' },
  donutContainer: { alignItems: 'center', justifyContent: 'center', width: DONUT_SIZE, height: DONUT_SIZE },
  donutCenter: { position: 'absolute', alignItems: 'center' },
  donutCenterLabel: { color: '#9CA3AF', fontSize: 12 },
  donutCenterAmount: { color: '#1F2937', fontSize: 18, fontWeight: '800' },
  legendCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, justifyContent: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendName: { color: '#6B7280', fontSize: 13, flex: 1 },
  legendValue: { color: '#1F2937', fontSize: 13, fontWeight: '700' },
  addButton: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 16 },
  addButtonText: { color: '#3B82F6', fontSize: 15, fontWeight: '700' },
  listSection: { marginTop: 8 },
  listTitle: { color: '#6B7280', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  listRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row' },
  listInfo: { flex: 1 },
  listName: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  listType: { color: '#9CA3AF', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  listDate: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  listDesc: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  listRight: { alignItems: 'flex-end' },
  listAmount: { color: '#22C55E', fontSize: 16, fontWeight: '800' },
  markPaidText: { color: '#3B82F6', fontSize: 12, marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(7, 27, 78, 0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  modalTitle: { color: '#1F2937', fontSize: 26, fontWeight: '800' },
  modalSubtitle: { color: '#6B7280', fontSize: 14, marginTop: 4, marginBottom: 20 },
  inputLabel: { color: '#6B7280', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: '#3B82F6' },
  chipText: { color: '#4B5563', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#1F2937', fontSize: 15 },
  noteInput: { minHeight: 80, textAlignVertical: 'top' },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalCancelButtonText: { color: '#6B7280', fontWeight: '600' },
  modalSaveButton: { flex: 1, backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  modalSaveButtonText: { color: '#FFFFFF', fontWeight: '800' },
  modalSaveButtonDisabled: { opacity: 0.5 },
})