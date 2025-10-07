import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const LanguageSelectionModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t, currentLanguage, changeLanguage, languages } = useLanguage();
  const [isChanging, setIsChanging] = useState(false);

  const handleLanguageChange = async (languageCode) => {
    if (languageCode === currentLanguage) {
      onClose();
      return;
    }

    setIsChanging(true);
    try {
      await changeLanguage(languageCode);
      Alert.alert(
        t('success'),
        'Language changed successfully',
        [
          {
            text: 'OK',
            onPress: onClose,
          },
        ]
      );
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('error'), 'Failed to change language');
    } finally {
      setIsChanging(false);
    }
  };

  const LanguageOption = ({ languageCode, languageInfo }) => {
    const isSelected = languageCode === currentLanguage;

    return (
      <TouchableOpacity
        style={[
          styles.languageOption,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: isSelected ? theme.colors.primary + '20' : 'transparent'
          }
        ]}
        onPress={() => handleLanguageChange(languageCode)}
        disabled={isChanging}
      >
        <View style={styles.languageLeft}>
          <Text style={styles.languageFlag}>{languageInfo.flag}</Text>
          <Text style={[styles.languageName, { color: theme.colors.text }]}>
            {languageInfo.name}
          </Text>
        </View>
        {isSelected && (
          <Text style={[styles.checkmark, { color: theme.colors.primary }]}>✓</Text>
        )}
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
      width: '85%',
      maxHeight: '70%',
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
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20,
      borderBottomWidth: 1,
    },
    languageLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    languageFlag: {
      fontSize: 24,
      marginRight: 15,
      width: 35,
      textAlign: 'center',
    },
    languageName: {
      fontSize: 18,
      fontWeight: '500',
    },
    checkmark: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    footerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
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
            <Text style={styles.title}>{t('language')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {Object.entries(languages).map(([languageCode, languageInfo]) => (
              <LanguageOption
                key={languageCode}
                languageCode={languageCode}
                languageInfo={languageInfo}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Select your preferred language.{'\n'}
              Changes will be applied immediately.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LanguageSelectionModal;