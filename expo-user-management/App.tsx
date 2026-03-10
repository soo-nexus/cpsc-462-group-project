import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { supabase } from './lib/supabase'

const data = [
  { value: 20, label: 'Jan', dataPointText: '20' },
  { value: 45, label: 'Feb', dataPointText: '45' },
  { value: 28, label: 'Mar', dataPointText: '28' },
  { value: 80, label: 'Apr', dataPointText: '80' },
  { value: 99, label: 'May', dataPointText: '99' },
]

export default function App() {

  useEffect(() => {
  async function testConnection() {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.log('❌ Supabase connection failed:', error.message)
    } else {
      console.log('✅ Supabase connected successfully!')
    }
  }
  testConnection()
  }, [])
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Chart</Text>
      <LineChart
        data={data}
        width={350}
        height={220}
        color="blue"
        thickness={3}
        dataPointsColor="blue"
        isAnimated
        curved

        // 👆 Tap a point to show its value
        onPress={(item, index) => {
          alert(`Month: ${item.label}\nValue: ${item.value}`)
        }}

        // 👆 Show tooltip on press
        focusEnabled
        showTextOnFocus
        focusedDataPointColor="red"
        focusedDataPointRadius={8}

        // 👆 Drag finger to trace values along the line
        showStripOnFocus
        showDataPointOnFocus
        stripColor="lightblue"
        stripWidth={2}
        stripOpacity={0.5}

        // 👆 Pointer label when dragging
        pointerConfig={{
          pointerStripHeight: 220,
          pointerStripColor: 'lightblue',
          pointerStripWidth: 2,
          pointerColor: 'blue',
          radius: 6,
          pointerLabelWidth: 100,
          pointerLabelHeight: 60,
          activatePointersOnLongPress: false,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (items) => {
            return (
              <View style={styles.tooltip}>
                <Text style={styles.tooltipLabel}>{items[0].label}</Text>
                <Text style={styles.tooltipValue}>{items[0].value}</Text>
              </View>
            )
          },
        }}
      />
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  tooltip: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    borderColor: 'blue',
    borderWidth: 1,
    alignItems: 'center',
  },
  tooltipLabel: {
    fontSize: 12,
    color: 'gray',
  },
  tooltipValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'blue',
  }
})