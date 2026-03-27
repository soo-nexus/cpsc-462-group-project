import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { budgetService } from '../../services/budgets'
import { Budget, BudgetStackParamList } from '../../types'
import dayjs from 'dayjs'

type Props = {
  navigation: NativeStackNavigationProp<BudgetStackParamList, 'BudgetList'>
}

export default function BudgetListScreen({ navigation }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      setBudgets(await budgetService.getBudgets())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, []))

  async function handleDelete(id: string) {
    Alert.alert('Delete Budget', 'Remove this budget?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await budgetService.deleteBudget(id)
          setBudgets((prev) => prev.filter((b) => b.id !== id))
        },
      },
    ])
  }

  function renderItem({ item }: { item: Budget }) {
    const spent = item.spent ?? 0
    const pct = Math.min((spent / item.monthly_limit) * 100, 100)
    const over = spent > item.monthly_limit
    const remaining = item.monthly_limit - spent
    const barColor = over ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981'

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AddBudget', { budget: item })}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: (item.category?.color ?? '#6B7280') + '20' }]}>
            <Text style={styles.icon}>{item.category?.icon ?? '📦'}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.catName}>{item.category?.name}</Text>
            <Text style={styles.period}>{dayjs().format('MMMM YYYY')}</Text>
          </View>
          <View style={styles.pctBadge}>
            <Text style={[styles.pct, { color: barColor }]}>{Math.round(pct)}%</Text>
          </View>
        </View>

        <View style={styles.progressBg}>
          <View
            style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]}
          />
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.spent}>
            ${spent.toFixed(2)} <Text style={styles.limit}>/ ${item.monthly_limit.toFixed(2)}</Text>
          </Text>
          <Text style={[styles.remaining, over && styles.textRed]}>
            {over
              ? `$${Math.abs(remaining).toFixed(2)} over`
              : `$${remaining.toFixed(2)} left`}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={budgets}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load() }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No budgets yet</Text>
            <Text style={styles.emptyHint}>Tap + to set a monthly category budget</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddBudget', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  list: { padding: 16, paddingBottom: 88 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 24 },
  cardInfo: { flex: 1 },
  catName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  period: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  pctBadge: {},
  pct: { fontSize: 18, fontWeight: 'bold' },
  progressBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spent: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  limit: { fontWeight: 'normal', color: '#9CA3AF' },
  remaining: { fontSize: 13, color: '#10B981', fontWeight: '600' },
  textRed: { color: '#EF4444' },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  emptyHint: { fontSize: 14, color: '#9CA3AF' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 30, lineHeight: 34, marginTop: -2 },
})
