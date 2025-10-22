import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Custom Picker Component
 *
 * A clean, user-friendly dropdown replacement for React Native Picker
 * Works great on both Android and iOS with consistent styling
 *
 * Usage:
 * <CustomPicker
 *   selectedValue={formData.farmType}
 *   onValueChange={(value) => setFormData({...formData, farmType: value})}
 *   items={[
 *     { label: 'Broiler', value: 'broiler' },
 *     { label: 'Layer', value: 'layer' }
 *   ]}
 *   placeholder="Select farm type"
 * />
 */
const CustomPicker = ({
  selectedValue,
  onValueChange,
  items = [],
  placeholder = 'Select an option',
  enabled = true,
}) => {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Find the selected item's label
  const selectedItem = items.find(item => item.value === selectedValue);
  const displayText = selectedItem ? selectedItem.label : placeholder;

  const handleSelect = (value) => {
    onValueChange(value);
    setModalVisible(false);
  };

  return (
    <View>
      {/* Trigger Button */}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            backgroundColor: theme.colors.inputBackground,
            borderColor: theme.colors.inputBorder,
          },
          !enabled && styles.disabled,
        ]}
        onPress={() => enabled && setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.pickerButtonText,
            {
              color: selectedItem ? theme.colors.inputText : theme.colors.placeholder,
            },
          ]}
        >
          {displayText}
        </Text>
        <Text style={[styles.arrow, { color: theme.colors.textSecondary }]}>▼</Text>
      </TouchableOpacity>

      {/* Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                {placeholder}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: theme.colors.primary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Options List */}
            <FlatList
              data={items}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor:
                        item.value === selectedValue
                          ? (theme.colors.primary ? theme.colors.primary + '20' : '#2E8B5720')
                          : 'transparent',
                    },
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: theme.colors.text,
                        fontWeight: item.value === selectedValue ? 'bold' : 'normal',
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.value === selectedValue && (
                    <Text style={[styles.checkmark, { color: theme.colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    minHeight: 50,
  },
  disabled: {
    opacity: 0.5,
  },
  pickerButtonText: {
    fontSize: 16,
    flex: 1,
  },
  arrow: {
    fontSize: 12,
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default CustomPicker;
