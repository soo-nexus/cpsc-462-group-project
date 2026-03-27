import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { BudgetStackParamList } from '../types'
import BudgetListScreen from '../screens/budgets/BudgetListScreen'
import AddBudgetScreen from '../screens/budgets/AddBudgetScreen'

const Stack = createNativeStackNavigator<BudgetStackParamList>()

const NAV_OPTS = {
  headerStyle: { backgroundColor: '#3B82F6' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
}

export default function BudgetNavigator() {
  return (
    <Stack.Navigator screenOptions={NAV_OPTS}>
      <Stack.Screen
        name="BudgetList"
        component={BudgetListScreen}
        options={{ title: 'Budgets' }}
      />
      <Stack.Screen
        name="AddBudget"
        component={AddBudgetScreen}
        options={({ route }) => ({
          title: route.params?.budget ? 'Edit Budget' : 'Add Budget',
        })}
      />
    </Stack.Navigator>
  )
}
