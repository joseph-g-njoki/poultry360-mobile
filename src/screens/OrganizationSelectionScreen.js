import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';

const OrganizationSelectionScreen = ({ route, navigation }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const { login } = useAuth();
  const { theme } = useTheme();

  // Get login credentials and organizations from route params
  const { email, password, organizationsList } = route.params || {};

  useEffect(() => {
    if (organizationsList && Array.isArray(organizationsList)) {
      setOrganizations(organizationsList);
    } else if (email) {
      fetchUserOrganizations();
    }
  }, [email, organizationsList]);

  const fetchUserOrganizations = async () => {
    if (!email) {
      Alert.alert('Error', 'No email provided');
      navigation.goBack();
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.getUserOrganizations(email);
      if (result && result.organizations) {
        setOrganizations(result.organizations);
      } else {
        Alert.alert('Error', 'No organizations found for this user');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      Alert.alert('Error', 'Failed to load organizations. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleOrganizationSelect = async (organization) => {
    try {
      if (!email || !password) {
        Alert.alert('Error', 'Missing login credentials');
        if (navigation?.goBack) {
          navigation.goBack();
        }
        return;
      }

      if (!organization || !organization.id) {
        Alert.alert('Error', 'Invalid organization selected');
        return;
      }

      setLoading(true);
      setSelectedOrg(organization.id);

      console.log(`🏢 Attempting login for organization: ${organization.name} (${organization.slug})`);

      // Use the organization slug for login
      const result = await login(email, password, organization.slug);

      if (result?.success) {
        console.log('✅ Organization login successful:', result);
        // Navigation will be handled automatically by AuthContext
      } else {
        console.error('❌ Organization login failed:', result);
        Alert.alert('Login Failed', result?.error || 'Failed to login with selected organization');
      }
    } catch (error) {
      console.error('❌ Organization login error:', error);
      Alert.alert('Error', 'An unexpected error occurred during login');
    } finally {
      setLoading(false);
      setSelectedOrg(null);
    }
  };

  const handleCancel = () => {
    try {
      if (navigation?.goBack) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Navigation back error:', error);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>
            Loading organizations...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.logoText}>🏢</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Select Organization
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Choose which organization to access
          </Text>
        </View>

        <View style={[styles.organizationsContainer, { backgroundColor: theme.colors.surface }]}>
          {organizations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                No organizations found
              </Text>
            </View>
          ) : (
            organizations.map((org, index) => (
              <TouchableOpacity
                key={org.id || index}
                style={[
                  styles.organizationCard,
                  {
                    backgroundColor: theme.colors.cardBackground || theme.colors.background,
                    borderColor: theme.colors.border
                  },
                  selectedOrg === org.id && styles.selectedCard
                ]}
                onPress={() => handleOrganizationSelect(org)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={styles.orgCardContent}>
                  <View style={styles.orgInfo}>
                    <Text style={[styles.orgName, { color: theme.colors.text }]}>
                      {org.name || 'Unknown Organization'}
                    </Text>
                    <Text style={[styles.orgRole, { color: theme.colors.textSecondary }]}>
                      Role: {org.userRole || 'Unknown'}
                    </Text>
                    {org.isActive === false && (
                      <Text style={[styles.orgStatus, { color: theme.colors.error }]}>
                        Inactive
                      </Text>
                    )}
                  </View>

                  <View style={styles.orgActions}>
                    {loading && selectedOrg === org.id ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <View style={[styles.selectButton, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.selectButtonText}>Select</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.colors.border }]}
            onPress={handleCancel}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  organizationsContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
  },
  organizationCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  orgCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  orgRole: {
    fontSize: 14,
    marginBottom: 2,
  },
  orgStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  orgActions: {
    marginLeft: 16,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  actionContainer: {
    marginTop: 20,
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrganizationSelectionScreen;