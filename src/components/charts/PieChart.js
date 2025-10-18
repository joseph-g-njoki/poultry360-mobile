import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart as RNPieChart } from 'react-native-chart-kit';

/**
 * PieChart Component
 *
 * Wrapper around react-native-chart-kit PieChart for distribution visualization
 *
 * Props:
 * - title: string - Chart title
 * - data: array - Chart data in format:
 *   [
 *     { name: 'Feed', value: 5000, color: '#FF6384', legendFontColor: '#666' },
 *     { name: 'Labor', value: 3000, color: '#36A2EB', legendFontColor: '#666' },
 *   ]
 * - height: number - Chart height (default: 220)
 * - showLegend: boolean - Show legend (default: true)
 * - accessor: string - Data key to use for values (default: 'value')
 */
const PieChart = ({
  title,
  data,
  height = 220,
  showLegend = true,
  accessor = 'value',
  loading = false,
  error = null,
}) => {
  const screenWidth = Dimensions.get('window').width - 32; // Padding

  // Default empty data structure
  const defaultData = [
    {
      name: 'No Data',
      value: 1,
      color: '#E0E0E0',
      legendFontColor: '#666',
      legendFontSize: 12,
    },
  ];

  // Use provided data or default
  const chartData = data && data.length > 0 ? data : defaultData;

  // Chart configuration
  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    color: (opacity = 1) => `rgba(46, 139, 87, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
  };

  if (loading) {
    return (
      <View style={styles(theme).container}>
        {title && <Text style={styles(theme).title}>{title}</Text>}
        <View style={[styles(theme).loadingContainer, { height }]}>
          <Text style={styles(theme).loadingText}>Loading chart data...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles(theme).container}>
        {title && <Text style={styles(theme).title}>{title}</Text>}
        <View style={[styles(theme).errorContainer, { height }]}>
          <Text style={styles(theme).errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles(theme).container}>
      {title && <Text style={styles(theme).title}>{title}</Text>}
      <View style={styles(theme).chartWrapper}>
        <RNPieChart
          data={chartData}
          width={screenWidth}
          height={height}
          chartConfig={chartConfig}
          accessor={accessor}
          backgroundColor="transparent"
          paddingLeft="15"
          center={[10, 0]}
          absolute={false}
          hasLegend={showLegend}
          style={styles(theme).chart}
        />
      </View>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
});

export default PieChart;
