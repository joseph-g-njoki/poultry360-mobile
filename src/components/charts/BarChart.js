import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart as RNBarChart } from 'react-native-chart-kit';
import { useTheme } from '../../context/ThemeContext';

/**
 * BarChart Component
 *
 * Wrapper around react-native-chart-kit BarChart for comparison visualization
 *
 * Props:
 * - title: string - Chart title
 * - data: object - Chart data in format:
 *   {
 *     labels: ['Farm A', 'Farm B', 'Farm C'],
 *     datasets: [{ data: [100, 200, 150] }]
 *   }
 * - height: number - Chart height (default: 220)
 * - color: string - Primary color for bars (default: '#2E8B57')
 * - yAxisSuffix: string - Suffix for y-axis values (e.g., '%', 'kg')
 * - formatYLabel: function - Custom Y label formatter
 * - showValues: boolean - Show values on top of bars
 */
const BarChart = ({
  title,
  data,
  height = 220,
  color = '#2E8B57',
  yAxisSuffix = '',
  formatYLabel,
  showValues = true,
  loading = false,
  error = null,
}) => {
  const { theme } = useTheme();
  const screenWidth = Dimensions.get('window').width - 32; // Padding

  // Default empty data structure
  const defaultData = {
    labels: ['No Data'],
    datasets: [{ data: [0] }],
  };

  // Use provided data or default
  const chartData = data && data.labels && data.labels.length > 0 ? data : defaultData;

  // Chart configuration
  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(46, 139, 87, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#E0E0E0',
      strokeWidth: 1,
    },
    barPercentage: 0.7,
  };

  // Custom Y label formatter
  const yLabelFormatter = (value) => {
    if (formatYLabel) {
      return formatYLabel(value);
    }
    return `${value}${yAxisSuffix}`;
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
        <RNBarChart
          data={chartData}
          width={screenWidth}
          height={height}
          chartConfig={chartConfig}
          style={styles(theme).chart}
          yAxisSuffix={yAxisSuffix}
          formatYLabel={yLabelFormatter}
          withInnerLines={true}
          withVerticalLines={false}
          withHorizontalLines={true}
          showValuesOnTopOfBars={showValues}
          fromZero={true}
          segments={4}
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

export default BarChart;
