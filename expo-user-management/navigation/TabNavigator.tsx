import React from 'react'
import { Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { MainTabParamList } from '../types'
import DashboardScreen from '../screens/dashboard/DashboardScreen'
import TransactionNavigator from './TransactionNavigator'
import BudgetNavigator from './BudgetNavigator'
import AnalyticsScreen from '../screens/analytics/AnalyticsScreen'
import SettingsScreen from '../screens/settings/SettingsScreen'

const Tab = createBottomTabNavigator<MainTabParamList>()

const ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Transactions: '💳',
  Budgets: '📊',
  Analytics: '📈',
  Settings: '⚙️',
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 22 }}>{ICONS[route.name]}</Text>
        ),
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { paddingBottom: 4, height: 60 },
        headerStyle: { backgroundColor: '#3B82F6' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen
        name="Transactions"
        component={TransactionNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}
