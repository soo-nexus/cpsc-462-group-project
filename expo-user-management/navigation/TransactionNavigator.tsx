import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { TransactionStackParamList } from '../types'
import TransactionListScreen from '../screens/transactions/TransactionListScreen'
import AddTransactionScreen from '../screens/transactions/AddTransactionScreen'

const Stack = createNativeStackNavigator<TransactionStackParamList>()

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#3B82F6' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
}

export default function TransactionNavigator() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen
        name="TransactionList"
        component={TransactionListScreen}
        options={{ title: 'Transactions' }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={({ route }) => ({
          title: route.params?.transaction ? 'Edit Transaction' : 'Add Transaction',
        })}
      />
    </Stack.Navigator>
  )
}
