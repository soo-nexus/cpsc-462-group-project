import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, StyleSheet } from 'react-native'
import HomeScreen from '../screens/main/HomeScreen'
import ProfileScreen from '../screens/main/ProfileScreen'
import IncomeStatementScreen from '../screens/reports/IncomeStatementScreen'
import CashFlowScreen from '../screens/reports/CashFlowScreen'
import BalanceSheetScreen from '../screens/reports/BalanceSheetScreen'

export type MainTabParamList = {
  Home: undefined
  Income: undefined
  CashFlow: undefined
  Balance: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.iconText, { color }]}>{label}</Text>
    </View>
  )
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#22C55E',
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          paddingBottom: 8,
          paddingTop: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 11,
        },
        headerStyle: {
          backgroundColor: '#081120',
        },
        headerTintColor: '#F8FAFC',
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ 
          title: 'Finance Dashboard', 
          tabBarLabel: 'Finance',
          tabBarIcon: ({ color }) => <TabIcon label="$" color={color} />,
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeStatementScreen}
        options={{ 
          title: 'Income Statement', 
          tabBarLabel: 'Income',
          tabBarIcon: ({ color }) => <TabIcon label="+" color={color} />,
        }}
      />
      <Tab.Screen
        name="CashFlow"
        component={CashFlowScreen}
        options={{ 
          title: 'Cash Flow', 
          tabBarLabel: 'Cash Flow',
          tabBarIcon: ({ color }) => <TabIcon label="~" color={color} />,
        }}
      />
      <Tab.Screen
        name="Balance"
        component={BalanceSheetScreen}
        options={{ 
          title: 'Balance Sheet', 
          tabBarLabel: 'Balance',
          tabBarIcon: ({ color }) => <TabIcon label="=" color={color} />,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon label="*" color={color} />,
        }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '800',
  },
})
