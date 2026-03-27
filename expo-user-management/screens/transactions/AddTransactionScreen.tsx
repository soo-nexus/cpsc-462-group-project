import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import dayjs from 'dayjs'
import { TransactionStackParamList, Category } from '../../types'
import { transactionService } from '../../services/transactions'
import { categoryService } from '../../services/categories'

type Props = {
  navigation: NativeStackNavigationProp<TransactionStackParamList, 'AddTransaction'>
  route: RouteProp<TransactionStackParamList, 'AddTransaction'>
}

export default function AddTransactionScreen({ navigation, route }: Props) {
  const editing = route.params?.transaction
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [merchant, setMerchant] = useState(editing?.merchant_name ?? '')
  const [date, setDate] = useState(editing?.date ?? dayjs().format('YYYY-MM-DD'))
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingCats, setLoadingCats] = useState(true)

  useEffect(() => {
    categoryService.getCategories().then((cats) => {
      setCategories(cats)
      if (!editing && cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id)
      }
    }).finally(() => setLoadingCats(false))
  }, [])

  async function handleSave() {
    if (!merchant.trim()) {
      Alert.alert('Error', 'Merchant / description is required')
      return
    }
    const parsed = parseFloat(amount)
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Please enter a valid amount greater than 0')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await transactionService.updateTransaction(editing.id, {
          amount: parsed,
          merchant_name: merchant.trim(),
          date,
          notes: notes.trim() || null,
          category_id: categoryId || null,
        })
      } else {
        await transactionService.addTransaction({
          amount: parsed,
          merchant_name: merchant.trim(),
          date,
          notes: notes.trim() || null,
          category_id: categoryId || null,
          account_id: null,
          plaid_tx_id: null,
          receipt_url: null,
        })
      }
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Error', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loadingCats) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Amount *</Text>
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          autoFocus={!editing}
        />
      </View>

      <Text style={styles.label}>Merchant / Description *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Starbucks, Grocery run"
        value={merchant}
        onChangeText={setMerchant}
      />

      <Text style={styles.label}>Date</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={date}
        onChangeText={setDate}
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        {categories.map((cat) => {
          const selected = categoryId === cat.id
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catChip,
                selected && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
              onPress={() => setCategoryId(cat.id)}
            >
              <Text style={styles.catEmoji}>{cat.icon}</Text>
              <Text style={[styles.catName, selected && styles.catNameSelected]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <Text style={styles.label}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Add a note..."
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {editing ? 'Save Changes' : 'Add Transaction'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingBottom: 48 },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 18,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 24, color: '#9CA3AF', marginRight: 4 },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    paddingVertical: 14,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1F2937',
  },
  notesInput: { height: 80 },
  catScroll: { marginHorizontal: -20 },
  catScrollContent: { paddingHorizontal: 20, gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  catEmoji: { fontSize: 15, marginRight: 5 },
  catName: { fontSize: 13, color: '#374151' },
  catNameSelected: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
