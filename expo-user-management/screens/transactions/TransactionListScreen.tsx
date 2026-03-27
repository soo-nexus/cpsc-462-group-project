import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import dayjs from 'dayjs'
import { transactionService } from '../../services/transactions'
import { Transaction, TransactionStackParamList } from '../../types'

type Props = {
  navigation: NativeStackNavigationProp<TransactionStackParamList, 'TransactionList'>
}

export default function TransactionListScreen({ navigation }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  async function load(searchTerm = '') {
    try {
      const data = await transactionService.getTransactions(
        searchTerm ? { search: searchTerm } : undefined
      )
      setTransactions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      load(search)
    }, [])
  )

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search])

  async function handleDelete(id: string) {
    Alert.alert('Delete Transaction', 'Are you sure? You can undo within 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await transactionService.deleteTransaction(id)
          setTransactions((prev) => prev.filter((t) => t.id !== id))
        },
      },
    ])
  }

  function renderItem({ item }: { item: Transaction }) {
    const color = item.category?.color ?? '#6B7280'
    return (
      <TouchableOpacity
        style={styles.txItem}
        onPress={() => navigation.navigate('AddTransaction', { transaction: item })}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBg, { backgroundColor: color + '20' }]}>
          <Text style={styles.emoji}>{item.category?.icon ?? '📦'}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.merchant}>{item.merchant_name}</Text>
          <Text style={styles.meta}>
            {item.category?.name ?? 'Uncategorized'} •{' '}
            {dayjs(item.date).format('MMM D, YYYY')}
          </Text>
          {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        </View>
        <Text style={styles.amount}>-${Number(item.amount).toFixed(2)}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="🔍  Search by merchant..."
          value={search}
          onChangeText={setSearch}
          clearButtonMode="always"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                load(search)
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>No transactions found</Text>
              <Text style={styles.emptyHint}>Tap + to add one</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddTransaction', {})}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  searchWrap: { padding: 12 },
  search: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  list: { paddingHorizontal: 12, paddingBottom: 88 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  merchant: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  meta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  notes: { fontSize: 12, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },
  amount: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
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
