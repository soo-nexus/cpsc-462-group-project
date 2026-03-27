import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import dayjs from 'dayjs'
import { useAuth } from '../../contexts/AuthContext'
import { authService } from '../../services/auth'
import { transactionService } from '../../services/transactions'

export default function SettingsScreen() {
  const { user } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          try {
            await authService.signOut()
          } catch (err: any) {
            Alert.alert('Error', err.message)
            setSigningOut(false)
          }
        },
      },
    ])
  }

  async function handleExportCSV() {
    setExporting(true)
    try {
      const transactions = await transactionService.getTransactions()
      const header = 'Date,Merchant,Amount,Category,Notes\n'
      const rows = transactions
        .map(
          (tx) =>
            `${tx.date},"${tx.merchant_name.replace(/"/g, '""')}",${tx.amount},"${
              tx.category?.name ?? ''
            }","${(tx.notes ?? '').replace(/"/g, '""')}"`
        )
        .join('\n')
      const csv = header + rows
      // In production this would use expo-sharing or expo-file-system to write/share the file
      Alert.alert(
        'Export Ready',
        `${transactions.length} transaction(s) prepared.\n\nIn production, this integrates with expo-sharing to download the CSV file.`
      )
      console.log('CSV preview:\n', csv.slice(0, 500))
    } catch (err: any) {
      Alert.alert('Export Failed', err.message)
    } finally {
      setExporting(false)
    }
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'User'
  const initial = displayName[0].toUpperCase()

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.since}>
            Member since {dayjs(user?.created_at).format('MMMM YYYY')}
          </Text>
        </View>

        {/* Data section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DATA</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleExportCSV}
            disabled={exporting}
          >
            <Text style={styles.menuIcon}>📤</Text>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuTitle}>Export Transactions</Text>
              <Text style={styles.menuSub}>Download all transactions as CSV</Text>
            </View>
            {exporting ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <TouchableOpacity
            style={[styles.menuItem, styles.signOutItem]}
            onPress={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <ActivityIndicator size="small" color="#EF4444" style={{ marginRight: 14 }} />
            ) : (
              <Text style={styles.menuIcon}>🚪</Text>
            )}
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Expense Tracker v1.0 · CPSC 462 Spring 2026</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  profileCard: {
    backgroundColor: '#3B82F6',
    margin: 16,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  email: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  since: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  menuIcon: { fontSize: 22, marginRight: 14 },
  menuTextWrap: { flex: 1 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  menuSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  chevron: { fontSize: 22, color: '#D1D5DB' },
  signOutItem: { borderWidth: 1, borderColor: '#FEE2E2' },
  signOutText: { fontSize: 15, fontWeight: '600', color: '#EF4444', flex: 1 },
  version: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginVertical: 24 },
})
