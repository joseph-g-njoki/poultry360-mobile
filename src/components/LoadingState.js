import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * LoadingState - A reusable loading component with different states
 */
const LoadingState = ({
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'No data available',
  emptyIcon = '📭',
  emptyAction = null,
  emptyActionText = 'Try Again',
  retryAction = null,
  loadingMessage = 'Loading...',
  style,
  children
}) => {
  const { theme } = useTheme();

  // Show loading spinner
  if (loading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          {loadingMessage}
        </Text>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          Something went wrong
        </Text>
        <Text style={[styles.errorMessage, { color: theme.colors.textSecondary }]}>
          {typeof error === 'string' ? error : 'An unexpected error occurred'}
        </Text>
        {retryAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={retryAction}
          >
            <Text style={styles.actionButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show empty state
  if (empty) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.emptyIcon}>{emptyIcon}</Text>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
          {emptyMessage}
        </Text>
        {emptyAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={emptyAction}
          >
            <Text style={styles.actionButtonText}>{emptyActionText}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Show content if no special state
  return children || null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  actionButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 15,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default LoadingState;