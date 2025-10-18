import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import databaseService from '../services/fastDatabase';

const DatabaseInitializationError = ({ error, onRetry, onContinueOnline }) => {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setRetrying(false);
    }
  };

  const handleForceReset = async () => {
    setRetrying(true);
    try {
      console.log('Forcing database reset...');
      await databaseService.forceReset();
      await onRetry();
    } catch (resetError) {
      console.error('Force reset failed:', resetError);
      setRetrying(false);
    }
  };

  const getErrorMessage = () => {
    if (error?.code === 'DATABASE_INIT_FAILED') {
      return 'The app database could not be initialized. This may be due to corrupted data or insufficient storage.';
    }
    if (error?.code === 'DATABASE_NULL_INSTANCE') {
      return 'Database instance could not be created. Please check your device storage.';
    }
    if (error?.code === 'DATABASE_CONNECTION_FAILED') {
      return 'Database connection could not be established.';
    }
    return 'An unexpected database error occurred.';
  };

  const getTechnicalDetails = () => {
    if (!error) return 'Unknown error';
    return `Error: ${error.message}\nCode: ${error.code || 'UNKNOWN'}`;
  };

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).errorCard}>
        <Text style={styles(theme).errorIcon}>⚠️</Text>
        <Text style={styles(theme).errorTitle}>Database Initialization Failed</Text>
        <Text style={styles(theme).errorMessage}>{getErrorMessage()}</Text>

        <View style={styles(theme).detailsContainer}>
          <Text style={styles(theme).detailsTitle}>Technical Details:</Text>
          <Text style={styles(theme).detailsText}>{getTechnicalDetails()}</Text>
        </View>

        <View style={styles(theme).optionsContainer}>
          <Text style={styles(theme).optionsTitle}>What would you like to do?</Text>

          <TouchableOpacity
            style={[styles(theme).button, styles(theme).primaryButton, retrying && styles(theme).buttonDisabled]}
            onPress={handleRetry}
            disabled={retrying}
          >
            {retrying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles(theme).primaryButtonText}>Retry Initialization</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles(theme).button, styles(theme).secondaryButton, retrying && styles(theme).buttonDisabled]}
            onPress={handleForceReset}
            disabled={retrying}
          >
            <Text style={styles(theme).secondaryButtonText}>Reset Database & Retry</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles(theme).button, styles(theme).tertiaryButton, retrying && styles(theme).buttonDisabled]}
            onPress={onContinueOnline}
            disabled={retrying}
          >
            <Text style={styles(theme).tertiaryButtonText}>Continue in Online-Only Mode</Text>
          </TouchableOpacity>
        </View>

        <View style={styles(theme).warningContainer}>
          <Text style={styles(theme).warningText}>
            Note: Online-only mode means offline features will not be available. Your data will not be cached locally.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 24,
    maxWidth: 450,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#495057',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  detailsContainer: {
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    marginBottom: 6,
  },
  detailsText: {
    fontSize: 12,
    color: '#495057',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  optionsContainer: {
    marginBottom: 16,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#343a40',
    marginBottom: 12,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: '#2E8B57',
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#ffc107',
  },
  secondaryButtonText: {
    color: '#212529',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#6c757d',
  },
  tertiaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default DatabaseInitializationError;
