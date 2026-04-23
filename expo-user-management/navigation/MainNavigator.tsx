import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from '../screens/main/HomeScreen'
import ProfileScreen from '../screens/main/ProfileScreen'

export type MainTabParamList = {
  Home: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<MainTabParamList>()

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#F97316',
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
        },
        tabBarLabelStyle: {
          fontWeight: '700',
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
        options={{ title: 'Finance Dashboard', tabBarLabel: 'Finance' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
