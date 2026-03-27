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
  Switch,
} from 'react-native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import dayjs from 'dayjs'
import { BudgetStackParamList, Category } from '../../types'
import { budgetService } from '../../services/budgets'
import { categoryService } from '../../services/categories'

type Props = {
  navigation: NativeStackNavigationProp<BudgetStackParamList, 'AddBudget'>
  route: RouteProp<BudgetStackParamList, 'AddBudget'>
}

export default function AddBudgetScreen({ navigation, route }: Props) {
  const editing = route.params?.budget
  const [monthlyLimit, setMonthlyLimit] = useState(editing ? String(editing.monthly_limit) : '')
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '')
  const [rollover, setRollover] = useState(editing?.rollover ?? false)
  const [alertPct, setAlertPct] = useState(String(editing?.alert_at_pct ?? 80))
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
    if (!categoryId) {
      Alert.alert('Error', 'Please select a category')
      return
    }
    const limit = parseFloat(monthlyLimit)
    if (isNaN(limit) || limit <= 0) {
      Alert.alert('Error', 'Please enter a valid monthly limit')
      return
    }
    setSaving(true)
    try {
      const payload = {
        monthly_limit: limit,
        category_id: categoryId,
        rollover,
        alert_at_pct: Math.min(100, Math.max(1, parseInt(alertPct) || 80)),
        period_start: dayjs().startOf('month').format('YYYY-MM-DD'),
      }
      if (editing) {
        await budgetService.updateBudget(editing.id, payload)
      } else {
        await budgetService.addBudget(payload)
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
      <Text style={styles.label}>Monthly Limit *</Text>
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.amountInput}
          placeholder="0.00"
          value={monthlyLimit}
          onChangeText={setMonthlyLimit}
          keyboardType="decimal-pad"
          autoFocus={!editing}
        />
      </View>

      <Text style={styles.label}>Category *</Text>
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

      <Text style={styles.label}>Alert Threshold (%)</Text>
      <TextInput
        style={styles.input}
        placeholder="80"
        value={alertPct}
        onChangeText={setAlertPct}
        keyboardType="number-pad"
      />
      <Text style={styles.hint}>Send a notification when spending reaches this % of budget</Text>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>Roll over unused budget</Text>
          <Text style={styles.switchHint}>Carry remaining balance to next month</Text>
        </View>
        <Switch
          value={rollover}
          onValueChange={setRollover}
          trackColor={{ true: '#3B82F6', false: '#E5E7EB' }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {editing ? 'Save Changes' : 'Create Budget'}
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
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
  },
  switchText: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  switchHint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
