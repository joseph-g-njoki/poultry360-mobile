import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import NotificationSettingsModal from '../components/NotificationSettingsModal';
import DataBackupModal from '../components/DataBackupModal';

const ProfileScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [editData, setEditData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  });

  // Load profile picture from AsyncStorage on mount
  useEffect(() => {
    loadProfilePicture();
  }, [user?.id]);

  const loadProfilePicture = async () => {
    try {
      if (user?.id) {
        const savedPicture = await AsyncStorage.getItem(`@profile_picture_${user.id}`);
        if (savedPicture) {
          setProfilePicture(savedPicture);
          console.log('Profile picture loaded from storage');
        }
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  };

  const saveProfilePicture = async (uri) => {
    try {
      if (user?.id) {
        await AsyncStorage.setItem(`@profile_picture_${user.id}`, uri);
        setProfilePicture(uri);

        // Update user object in AuthContext to include profilePicture field
        const updatedUser = {
          ...user,
          profilePicture: uri,
        };
        await updateUser(updatedUser);

        console.log('Profile picture saved to storage');
      }
    } catch (error) {
      console.error('Error saving profile picture:', error);
      Alert.alert('Error', 'Failed to save profile picture');
    }
  };

  const requestPermissions = async () => {
    try {
      // Request camera permissions
      const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();

      // Request media library permissions
      const mediaStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();

      return {
        camera: cameraStatus.status === 'granted',
        media: mediaStatus.status === 'granted',
      };
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return { camera: false, media: false };
    }
  };

  const pickImageFromCamera = async () => {
    try {
      setImageLoading(true);

      // Request camera permission
      const permissions = await requestPermissions();

      if (!permissions.camera) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device settings to take photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await saveProfilePicture(imageUri);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setImageLoading(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      setImageLoading(true);

      // Request media library permission
      const permissions = await requestPermissions();

      if (!permissions.media) {
        Alert.alert(
          'Media Library Permission Required',
          'Please enable photo library access in your device settings to choose photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await saveProfilePicture(imageUri);
        Alert.alert('Success', 'Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setImageLoading(false);
    }
  };

  const handleProfilePicturePress = () => {
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: pickImageFromCamera,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickImageFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleLogout = useCallback(() => {
    try {
      Alert.alert(
        String(t('auth.logout') || 'Logout'),
        'Are you sure you want to logout?',
        [
          { text: String(t('common.cancel') || 'Cancel'), style: 'cancel' },
          {
            text: String(t('auth.logout') || 'Logout'),
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                console.log('🚪 Logging out user...');
                await logout();
                console.log('✅ Logout completed successfully');
                // Navigation will happen automatically via AuthContext
              } catch (error) {
                console.error('❌ Logout error:', error);
                // Force logout even if there's an error
                try {
                  await logout?.();
                } catch (retryError) {
                  console.error('❌ Force logout also failed:', retryError);
                }
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Logout dialog error:', error);
      // Fallback logout
      try {
        setLoading(true);
        logout?.();
      } finally {
        setLoading(false);
      }
    }
  }, [t, logout]);

  const openEditModal = useCallback(() => {
    try {
      setEditData({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        phone: user?.phone || '',
      });
      setModalVisible(true);
    } catch (error) {
      console.error('Error opening edit modal:', error);
    }
  }, [user]);

  const closeEditModal = useCallback(() => {
    try {
      setModalVisible(false);
    } catch (error) {
      console.error('Error closing edit modal:', error);
    }
  }, []);

  const handleUpdateProfile = async () => {
    if (!editData.firstName.trim() || !editData.lastName.trim()) {
      Alert.alert(String(t('common.error') || 'Error'), 'Please fill in first and last name');
      return;
    }

    setLoading(true);
    try {
      // Note: This would need a backend endpoint for updating profile
      // For now, we'll just update local state
      const updatedUser = {
        ...user,
        firstName: editData.firstName.trim(),
        lastName: editData.lastName.trim(),
        phone: editData.phone.trim(),
      };

      await updateUser(updatedUser);
      Alert.alert(String(t('common.success') || 'Success'), 'Profile updated successfully');
      closeEditModal();
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert(String(t('common.error') || 'Error'), 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const ProfileItem = ({ icon, label, value, onPress, showArrow = false }) => {
    // SAFETY: Ensure value is always a string or number, never an object
    // CRASH FIX: Added 't' to dependencies - it was missing and causing infinite loops
    const safeValue = React.useMemo(() => {
      if (value === null || value === undefined) {
        return String(t('profile.notProvided') || 'Not Provided');
      }
      // If value is an object, convert to JSON string for debugging
      if (typeof value === 'object') {
        console.warn('ProfileItem received object value for label:', label, value);
        return JSON.stringify(value);
      }
      // Convert to string and ensure it's never an object
      const stringValue = String(value);
      return stringValue;
    }, [value, label, t]);

    // SAFETY: Ensure label is also a string
    const safeLabel = String(label);

    return (
      <TouchableOpacity
        style={[styles.profileItem, { borderBottomColor: theme.colors.border }, !onPress && styles.profileItemDisabled]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.profileItemLeft}>
          <Text style={styles.profileItemIcon}>{String(icon)}</Text>
          <View style={styles.profileItemContent}>
            <Text style={[styles.profileItemLabel, { color: theme.colors.textSecondary }]}>{safeLabel}</Text>
            <Text style={[styles.profileItemValue, { color: theme.colors.text }]}>{safeValue}</Text>
          </View>
        </View>
        {showArrow && onPress && (
          <Text style={[styles.profileItemArrow, { color: theme.colors.textLight }]}>›</Text>
        )}
      </TouchableOpacity>
    );
  };

  const MenuSection = ({ title, children }) => (
    <View style={styles.menuSection}>
      <Text style={[styles.menuSectionTitle, { color: theme.colors.textSecondary }]}>{String(title)}</Text>
      <View style={[styles.menuSectionContent, { backgroundColor: theme.colors.cardBackground }]}>
        {children}
      </View>
    </View>
  );

  const MenuItem = ({ icon, title, onPress, color, showArrow = true, rightComponent }) => (
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.colors.border }]} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <Text style={styles.menuItemIcon}>{String(icon)}</Text>
        <Text style={[styles.menuItemTitle, { color: color || theme.colors.text }]}>{String(title)}</Text>
      </View>
      {rightComponent || (showArrow && <Text style={[styles.menuItemArrow, { color: theme.colors.textLight }]}>›</Text>)}
    </TouchableOpacity>
  );

  const getRoleDisplay = (role) => {
    // SAFETY: Handle role if it's an object (should never happen, but defensive)
    if (typeof role === 'object' && role !== null) {
      console.warn('getRoleDisplay received object role:', role);
      role = 'worker'; // Default to worker
    }

    const roleMap = {
      manager: `👨‍💼 ${String(t('profile.manager') || 'Manager')}`,
      admin: `⭐ ${String(t('profile.admin') || 'Admin')}`,
      owner: `👑 ${String(t('profile.owner') || 'Owner')}`,
      worker: `👷 ${String(t('profile.worker') || 'Worker')}`,
    };
    return roleMap[role] || `👷 ${String(t('profile.worker') || 'Worker')}`;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Profile Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.headerBackground }]}>
        {/* Profile Picture with Edit Button */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleProfilePicturePress}
          activeOpacity={0.8}
          disabled={imageLoading}
        >
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                {String(user?.firstName || 'U').charAt(0)}{String(user?.lastName || 'U').charAt(0)}
              </Text>
            </View>
          )}

          {/* Camera Icon Badge */}
          <View style={[styles.cameraIconBadge, { backgroundColor: theme.colors.primary }]}>
            {imageLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.cameraIconText}>📷</Text>
            )}
          </View>
        </TouchableOpacity>

        <Text style={[styles.userName, { color: theme.colors.headerText }]}>
          {String(user?.firstName || 'User')} {String(user?.lastName || '')}
        </Text>
        <Text style={[styles.userEmail, { color: theme.colors.headerText }]}>{String(user?.email || '')}</Text>
        <View style={styles.roleContainer}>
          <Text style={[styles.roleText, { color: theme.colors.headerText }]}>
            {getRoleDisplay(user?.role)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.editProfileButton, { backgroundColor: theme.colors.surface }]}
          onPress={openEditModal}
        >
          <Text style={[styles.editProfileButtonText, { color: theme.colors.primary }]}>{String(t('profile.editProfile') || 'Edit Profile')}</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Details */}
      <MenuSection title={String(t('profile.profileInformation') || 'Profile Information')}>
        <ProfileItem
          icon="👤"
          label={String(t('profile.fullName') || 'Full Name')}
          value={`${String(user?.firstName || '')} ${String(user?.lastName || '')}`}
        />
        <ProfileItem
          icon="📧"
          label={String(t('profile.email') || 'Email')}
          value={String(user?.email || t('profile.notProvided') || 'Not Provided')}
        />
        <ProfileItem
          icon="📱"
          label={String(t('profile.phone') || 'Phone')}
          value={String(user?.phone || t('profile.notProvided') || 'Not Provided')}
        />
        <ProfileItem
          icon="👥"
          label={String(t('profile.role') || 'Role')}
          value={typeof user?.role === 'object' ? 'User' : String(user?.role || 'User')}
        />
        <ProfileItem
          icon="📅"
          label={String(t('profile.memberSince') || 'Member Since')}
          value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
        />
      </MenuSection>

      {/* App Settings */}
      <MenuSection title={String(t('profile.appSettings') || 'App Settings')}>
        <MenuItem
          icon="🔔"
          title={String(t('settings.notifications') || 'Notifications')}
          onPress={() => setNotificationModalVisible(true)}
        />
        <MenuItem
          icon="🌙"
          title={String(t('profile.darkMode') || 'Dark Mode')}
          onPress={() => {
            try {
              if (toggleTheme && typeof toggleTheme === 'function') {
                toggleTheme();
              }
            } catch (error) {
              console.error('Toggle theme error:', error);
            }
          }}
          rightComponent={
            <Switch
              value={isDarkMode}
              onValueChange={() => {
                try {
                  if (toggleTheme && typeof toggleTheme === 'function') {
                    toggleTheme();
                  }
                } catch (error) {
                  console.error('Switch toggle theme error:', error);
                }
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isDarkMode ? '#fff' : '#f4f3f4'}
            />
          }
        />
        <MenuItem
          icon="💾"
          title={String(t('profile.dataBackup') || 'Data Backup')}
          onPress={() => setBackupModalVisible(true)}
        />
      </MenuSection>

      {/* Support */}
      <MenuSection title={String(t('profile.supportInfo') || 'Support & Info')}>
        <MenuItem
          icon="❓"
          title={String(t('profile.helpSupport') || 'Help & Support')}
          onPress={() => Alert.alert('Help', 'Contact support: support@poultry360.com')}
        />
        <MenuItem
          icon="📄"
          title={String(t('profile.termsOfService') || 'Terms of Service')}
          onPress={() => Alert.alert('Terms', 'Terms of service coming soon!')}
        />
        <MenuItem
          icon="🔒"
          title={String(t('profile.privacyPolicy') || 'Privacy Policy')}
          onPress={() => Alert.alert('Privacy', 'Privacy policy coming soon!')}
        />
        <MenuItem
          icon="ℹ️"
          title={String(t('settings.about') || 'About')}
          onPress={() => Alert.alert(String(t('settings.about') || 'About'), 'Poultry360 v1.0.0\nPoultry Farm Management System')}
        />
      </MenuSection>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.colors.secondary }, loading && styles.disabledButton]}
          onPress={handleLogout}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <View style={styles.logoutLoading}>
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
              <Text style={styles.logoutButtonText}>Logging out...</Text>
            </View>
          ) : (
            <Text style={styles.logoutButtonText}>🚪 {String(t('auth.logout') || 'Logout')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Version Info */}
      <View style={styles.versionInfo}>
        <Text style={[styles.versionText, { color: theme.colors.textLight }]}>Poultry360 Mobile v1.0.0</Text>
      </View>

      {/* Feature Modals */}
      <NotificationSettingsModal
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
      />


      <DataBackupModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
      />

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{String(t('profile.editProfile') || 'Edit Profile')}</Text>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>First Name *</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.borderSecondary,
                  color: theme.colors.text
                }]}
                placeholder="Enter first name"
                placeholderTextColor={theme.colors.textSecondary}
                value={editData.firstName}
                onChangeText={(text) =>
                  setEditData(prev => ({ ...prev, firstName: text }))
                }
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Last Name *</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.borderSecondary,
                  color: theme.colors.text
                }]}
                placeholder="Enter last name"
                placeholderTextColor={theme.colors.textSecondary}
                value={editData.lastName}
                onChangeText={(text) =>
                  setEditData(prev => ({ ...prev, lastName: text }))
                }
                editable={!loading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.text }]}>Phone Number</Text>
              <TextInput
                style={[styles.formInput, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.borderSecondary,
                  color: theme.colors.text
                }]}
                placeholder="Enter phone number"
                placeholderTextColor={theme.colors.textSecondary}
                value={editData.phone}
                onChangeText={(text) =>
                  setEditData(prev => ({ ...prev, phone: text }))
                }
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { backgroundColor: theme.colors.border }]}
                onPress={closeEditModal}
                disabled={loading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>{String(t('common.cancel') || 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.colors.primary }, loading && styles.disabledButton]}
                onPress={handleUpdateProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>{String(t('profile.saveChanges') || 'Save Changes')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cameraIconText: {
    fontSize: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    opacity: 0.9,
    marginBottom: 10,
  },
  roleContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 15,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editProfileButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editProfileButtonText: {
    fontWeight: '600',
  },
  menuSection: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  menuSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuSectionContent: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },
  profileItemDisabled: {
    backgroundColor: 'transparent',
  },
  profileItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileItemIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 25,
    textAlign: 'center',
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemLabel: {
    fontSize: 14,
    marginBottom: 2,
  },
  profileItemValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileItemArrow: {
    fontSize: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 15,
    width: 25,
    textAlign: 'center',
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemArrow: {
    fontSize: 20,
  },
  logoutSection: {
    margin: 20,
    marginTop: 30,
  },
  logoutButton: {
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default ProfileScreen;