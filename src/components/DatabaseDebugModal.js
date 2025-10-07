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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Database Debug Tools</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.description}>
            Use these tools to diagnose and fix database issues, including the "fisrt name" column error.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diagnostic Tools</Text>

            <TouchableOpacity
              style={styles.button}
              onPress={handleDebugDatabase}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Debug Database Schema</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={handleCheckHealth}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Check Database Health</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repair Tools</Text>

            <TouchableOpacity
              style={[styles.button, styles.warningButton]}
              onPress={handleRecreateUsersTable}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Recreate Users Table</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleResetDatabase}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Reset Entire Database</Text>
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}

          {debugResult && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Debug Results</Text>
              <View style={styles.resultContainer}>
                <Text style={styles.resultText}>
                  {JSON.stringify(debugResult, null, 2)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Demo User Credentials</Text>
            <View style={styles.credentialsContainer}>
              <Text style={styles.credentialTitle}>Worker Account:</Text>
              <Text style={styles.credentialText}>Email: demo@poultry360.com</Text>
              <Text style={styles.credentialText}>Password: demo123</Text>

              <Text style={styles.credentialTitle}>Owner Account:</Text>
              <Text style={styles.credentialText}>Email: owner@poultry360.com</Text>
              <Text style={styles.credentialText}>Password: owner123</Text>

              <Text style={styles.credentialTitle}>Admin Account:</Text>
              <Text style={styles.credentialText}>Email: admin@poultry360.com</Text>
              <Text style={styles.credentialText}>Password: admin123</Text>
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