/**
 * Database Debug Modal Component
 *
 * This component provides a UI for users to debug and reset the database
 * when encountering login issues or schema errors.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import databaseResetUtil from '../utils/databaseReset';
import fastDatabase from '../services/fastDatabase';

const DatabaseDebugModal = ({ visible, onClose, onResetComplete }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [debugResult, setDebugResult] = useState(null);

  const styles = getStyles(theme);

  const handleDebugDatabase = async () => {
    setLoading(true);
    try {
      const result = await databaseResetUtil.debugDatabase();
      setDebugResult(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to debug database: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Database',
      'This will delete all local data and recreate the database schema. You will need to login again. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await databaseResetUtil.resetDatabase();
              if (result.success) {
                Alert.alert('Success', result.message, [
                  {
                    text: 'OK',
                    onPress: () => {
                      onResetComplete && onResetComplete();
                      onClose();
                    }
                  }
                ]);
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to reset database: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCheckHealth = async () => {
    setLoading(true);
    try {
      const result = await databaseResetUtil.checkDatabaseHealth();
      const message = result.isHealthy
        ? 'Database is healthy!'
        : `Database issues found:\\n${result.issues.join('\\n')}`;
      Alert.alert('Database Health Check', message);
    } catch (error) {
      Alert.alert('Error', 'Failed to check database health: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecreateUsersTable = () => {
    Alert.alert(
      'Recreate Users Table',
      'This will recreate the users table with the correct schema. You will need to login again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Recreate',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await databaseResetUtil.recreateUsersTable();
              if (result.success) {
                Alert.alert('Success', result.message);
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to recreate users table: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearUnsyncedRecords = () => {
    Alert.alert(
      'Clear Unsynced Records',
      'This will delete all records that have not been synced to the server. This is useful for clearing corrupted data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const deletedCount = fastDatabase.clearUnsyncedRecords();
              Alert.alert('Success', `Cleared ${deletedCount} unsynced records. Please restart the app.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to clear unsynced records: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles(theme).container}>
        <View style={styles(theme).header}>
          <Text style={styles(theme).title}>Database Debug Tools</Text>
          <TouchableOpacity onPress={onClose} style={styles(theme).closeButton}>
            <Text style={styles(theme).closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles(theme).content}>
          <Text style={styles(theme).description}>
            Use these tools to diagnose and fix database issues, including the "fisrt name" column error.
          </Text>

          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>Diagnostic Tools</Text>

            <TouchableOpacity
              style={styles(theme).button}
              onPress={handleDebugDatabase}
              disabled={loading}
            >
              <Text style={styles(theme).buttonText}>Debug Database Schema</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles(theme).button}
              onPress={handleCheckHealth}
              disabled={loading}
            >
              <Text style={styles(theme).buttonText}>Check Database Health</Text>
            </TouchableOpacity>
          </View>

          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>Repair Tools</Text>

            <TouchableOpacity
              style={[styles(theme).button, styles(theme).warningButton]}
              onPress={handleClearUnsyncedRecords}
              disabled={loading}
            >
              <Text style={styles(theme).buttonText}>Clear Unsynced Records</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles(theme).button, styles(theme).warningButton]}
              onPress={handleRecreateUsersTable}
              disabled={loading}
            >
              <Text style={styles(theme).buttonText}>Recreate Users Table</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles(theme).button, styles(theme).dangerButton]}
              onPress={handleResetDatabase}
              disabled={loading}
            >
              <Text style={styles(theme).buttonText}>Reset Entire Database</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles(theme).loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles(theme).loadingText}>Processing...</Text>
            </View>
          )}

          {debugResult && (
            <View style={styles(theme).section}>
              <Text style={styles(theme).sectionTitle}>Debug Results</Text>
              <View style={styles(theme).resultContainer}>
                <Text style={styles(theme).resultText}>
                  {JSON.stringify(debugResult, null, 2)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>Demo User Credentials</Text>
            <View style={styles(theme).credentialsContainer}>
              <Text style={styles(theme).credentialTitle}>Worker Account:</Text>
              <Text style={styles(theme).credentialText}>Email: demo@poultry360.com</Text>
              <Text style={styles(theme).credentialText}>Password: demo123</Text>

              <Text style={styles(theme).credentialTitle}>Owner Account:</Text>
              <Text style={styles(theme).credentialText}>Email: owner@poultry360.com</Text>
              <Text style={styles(theme).credentialText}>Password: owner123</Text>

              <Text style={styles(theme).credentialTitle}>Admin Account:</Text>
              <Text style={styles(theme).credentialText}>Email: admin@poultry360.com</Text>
              <Text style={styles(theme).credentialText}>Password: admin123</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 20,
    lineHeight: 22,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.text,
  },
  resultContainer: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: theme.colors.text,
  },
  credentialsContainer: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  credentialTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: 10,
    marginBottom: 5,
  },
  credentialText: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: 'monospace',
  },
});

export default DatabaseDebugModal;