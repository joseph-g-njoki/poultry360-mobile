import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { safeRender, safeTranslation, safeUserField } from '../utils/safeRender';

const DataBackupModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const createBackupData = async () => {
    try {
      // Collect all app data from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const appDataKeys = allKeys.filter(key =>
        key.startsWith('@') || // Our app-specific keys
        key.includes('poultry360') ||
        key.includes('user_') ||
        key.includes('farm_') ||
        key.includes('batch_')
      );

      // SAFETY: Ensure user data is safely extracted
      const backupData = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        userId: safeUserField(user, 'id', 'unknown'),
        userEmail: safeUserField(user, 'email', 'unknown'),
        data: {},
      };

      // Get all relevant data
      for (const key of appDataKeys) {
        try {
          const value = await AsyncStorage.getItem(key);
          if (value !== null) {
            backupData.data[key] = value;
          }
        } catch (error) {
          console.warn(`Error reading key ${key}:`, error);
        }
      }

      return backupData;
    } catch (error) {
      console.error('Error creating backup data:', error);
      throw error;
    }
  };

  const handleExportData = async () => {
    if (isExporting || isImporting) return;

    setIsExporting(true);
    try {
      const backupData = await createBackupData();
      if (!backupData) {
        throw new Error('Failed to create backup data');
      }

      const jsonString = JSON.stringify(backupData, null, 2);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `poultry360-backup-${timestamp}.json`;

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // For mobile, save to documents directory and share
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonString);

        // Share the file
        await Share.share({
          url: fileUri,
          title: 'Poultry360 Data Backup',
          message: 'Your Poultry360 data backup is ready',
        });
      }

      Alert.alert(
        'Success',
        'Backup created successfully',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (isExporting || isImporting) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.type === 'cancel') {
        return;
      }

      if (!result.uri) {
        throw new Error('No file selected');
      }

      setIsImporting(true);

      // Read the file content
      const fileContent = await FileSystem.readAsStringAsync(result.uri);
      const backupData = JSON.parse(fileContent);

      // Validate backup data structure
      if (!backupData.version || !backupData.data || !backupData.exportedAt) {
        throw new Error('Invalid backup file format');
      }

      // Confirm import with user
      Alert.alert(
        'Import Data',
        `This will restore data from backup created on ${new Date(backupData.exportedAt).toLocaleDateString()}.\n\nThis action will overwrite your current settings and preferences. Continue?`,
        [
          { text: t('cancel'), style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                // Clear existing app data (except authentication)
                const existingKeys = await AsyncStorage.getAllKeys();
                const keysToRemove = existingKeys.filter(key =>
                  key.startsWith('@') &&
                  !key.includes('auth') &&
                  !key.includes('token')
                );

                if (keysToRemove.length > 0) {
                  await AsyncStorage.multiRemove(keysToRemove);
                }

                // Import backup data
                const importPromises = Object.entries(backupData.data).map(
                  ([key, value]) => AsyncStorage.setItem(key, value)
                );

                await Promise.all(importPromises);

                Alert.alert(
                  'Success',
                  'Data imported successfully',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Suggest app restart
                        Alert.alert(
                          'Restart Required',
                          'Please restart the app to see all imported changes.',
                          [{ text: 'OK', onPress: onClose }]
                        );
                      },
                    },
                  ]
                );
              } catch (importError) {
                console.error('Import error:', importError);
                Alert.alert('Error', 'Failed to import data. Please try again.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Import preparation error:', error);
      Alert.alert('Error', 'Invalid backup file or failed to read file.');
    } finally {
      setIsImporting(false);
    }
  };

  const ActionButton = ({ icon, title, description, onPress, loading, color }) => {
    // SAFETY: Ensure all text values are strings
    const safeIcon = safeRender(icon, '💾');
    const safeTitle = safeRender(title, 'Action');
    const safeDescription = safeRender(description, '');
    const safeColor = String(color || theme.colors.primary);

    return (
      <TouchableOpacity
        style={[
          styles.actionButton,
          {
            backgroundColor: safeColor + '15',
            borderColor: safeColor + '30',
          }
        ]}
        onPress={onPress}
        disabled={loading || isExporting || isImporting}
      >
        <View style={styles.actionButtonContent}>
          <Text style={styles.actionIcon}>{safeIcon}</Text>
          <View style={styles.actionTextContainer}>
            <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
              {safeTitle}
            </Text>
            <Text style={[styles.actionDescription, { color: theme.colors.textSecondary }]}>
              {safeDescription}
            </Text>
          </View>
          {loading && (
            <ActivityIndicator size="small" color={safeColor} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      width: '90%',
      maxHeight: '80%',
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
      padding: 5,
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    description: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      marginBottom: 25,
      textAlign: 'center',
    },
    actionButton: {
      borderRadius: 12,
      padding: 20,
      marginBottom: 15,
      borderWidth: 1,
    },
    actionButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionIcon: {
      fontSize: 28,
      marginRight: 15,
      width: 40,
      textAlign: 'center',
    },
    actionTextContainer: {
      flex: 1,
    },
    actionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 4,
    },
    actionDescription: {
      fontSize: 14,
      lineHeight: 18,
    },
    warningBox: {
      backgroundColor: theme.colors.warning + '15',
      borderColor: theme.colors.warning + '30',
      borderWidth: 1,
      borderRadius: 8,
      padding: 15,
      marginTop: 20,
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.warning,
      marginBottom: 5,
    },
    warningText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{safeTranslation(t, 'profile.dataBackup', 'Data Backup & Restore')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={isExporting || isImporting}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Export your app data to create a backup, or import previously exported data to restore your settings and preferences.
            </Text>

            <ActionButton
              icon="📤"
              title="Export Data"
              description="Create a backup file with your current data and settings"
              onPress={handleExportData}
              loading={isExporting}
              color={theme.colors.primary}
            />

            <ActionButton
              icon="📥"
              title="Import Data"
              description="Restore data and settings from a backup file"
              onPress={handleImportData}
              loading={isImporting}
              color={theme.colors.info}
            />

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ Important Notes</Text>
              <Text style={styles.warningText}>
                • Backup files contain your personal data and settings{'\n'}
                • Importing will overwrite your current preferences{'\n'}
                • App may need to be restarted after importing{'\n'}
                • Keep backup files secure and private
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default DataBackupModal;