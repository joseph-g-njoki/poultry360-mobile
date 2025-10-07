import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * KPICard Component
 *
 * Displays a single Key Performance Indicator (KPI) with:
 * - Title
 * - Value (with optional formatting)
 * - Trend indicator (up/down arrow with percentage)
 * - Optional subtitle
 * - Color customization
 *
 * Props:
 * - title: string - KPI title (e.g., "Total Birds")
 * - value: string|number - Main value to display
 * - subtitle: string - Optional subtitle below value
 * - trend: object - { value: number, direction: 'up'|'down' } - Trend indicator
 * - color: string - Primary color for the card
 * - icon: string - Emoji or icon to display
 * - onPress: function - Optional callback when card is pressed
 */
const KPICard = ({
  title,
  value,
  subtitle,
  trend,
  color = '#2E8B57',
  icon,
  onPress,
  loading = false,
}) => {
  // Format large numbers with commas
  const formatValue = (val) => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  // Render trend indicator
  const renderTrend = () => {
    if (!trend) return null;

    const isPositive = trend.direction === 'up';
    const trendColor = isPositive ? '#34C759' : '#FF3B30';
    const trendIcon = isPositive ? '↑' : '↓';

    return (
      <View style={styles.trendContainer}>
        <Text style={[styles.trendText, { color: trendColor }]}>
          {trendIcon} {Math.abs(trend.value)}%
        </Text>
      </View>
    );
  };

  const CardContent = (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {icon && <Text style={styles.icon}>{icon}</Text>}
      </View>

      <View style={styles.body}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          <>
            <Text style={[styles.value, { color }]}>{formatValue(value)}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {renderTrend()}
          </>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 24,
  },
  body: {
    minHeight: 60,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  trendContainer: {
    marginTop: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default KPICard;
