import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

// Import screens
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OrganizationSelectionScreen from '../screens/OrganizationSelectionScreen';
import DashboardScreen from '../screens/DashboardScreen';
import FarmsScreen from '../screens/FarmsScreen';
import BatchesScreen from '../screens/BatchesScreen';
import RecordsScreen from '../screens/RecordsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import FlockPerformanceScreen from '../screens/FlockPerformanceScreen';
import FinancialAnalyticsScreen from '../screens/FinancialAnalyticsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import SalesScreen from '../screens/SalesScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import FinancialSummaryScreen from '../screens/FinancialSummaryScreen';
import AddSaleScreen from '../screens/AddSaleScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import VaccinationScreen from '../screens/VaccinationScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';

// Import components
import ErrorBoundary from '../components/ErrorBoundary';

// Import context
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Wrap screen components with ErrorBoundary
const SafeWelcomeScreen = (props) => (
  <ErrorBoundary screenName="Welcome">
    <WelcomeScreen {...props} />
  </ErrorBoundary>
);

const SafeLoginScreen = (props) => (
  <ErrorBoundary screenName="Login">
    <LoginScreen {...props} />
  </ErrorBoundary>
);

const SafeRegisterScreen = (props) => (
  <ErrorBoundary screenName="Register">
    <RegisterScreen {...props} />
  </ErrorBoundary>
);

const SafeOrganizationSelectionScreen = (props) => (
  <ErrorBoundary screenName="Organization Selection">
    <OrganizationSelectionScreen {...props} />
  </ErrorBoundary>
);

const SafeDashboardScreen = (props) => (
  <ErrorBoundary screenName="Dashboard">
    <DashboardScreen {...props} />
  </ErrorBoundary>
);

const SafeFarmsScreen = (props) => (
  <ErrorBoundary screenName="Farms">
    <FarmsScreen {...props} />
  </ErrorBoundary>
);

const SafeBatchesScreen = (props) => (
  <ErrorBoundary screenName="Batches">
    <BatchesScreen {...props} />
  </ErrorBoundary>
);

const SafeRecordsScreen = (props) => (
  <ErrorBoundary screenName="Records">
    <RecordsScreen {...props} />
  </ErrorBoundary>
);

const SafeProfileScreen = (props) => (
  <ErrorBoundary screenName="Profile">
    <ProfileScreen {...props} />
  </ErrorBoundary>
);

const SafeAnalyticsScreen = (props) => (
  <ErrorBoundary screenName="Analytics">
    <AnalyticsScreen {...props} />
  </ErrorBoundary>
);

const SafeFlockPerformanceScreen = (props) => (
  <ErrorBoundary screenName="Flock Performance">
    <FlockPerformanceScreen {...props} />
  </ErrorBoundary>
);

const SafeFinancialAnalyticsScreen = (props) => (
  <ErrorBoundary screenName="Financial Analytics">
    <FinancialAnalyticsScreen {...props} />
  </ErrorBoundary>
);

const SafeCustomersScreen = (props) => (
  <ErrorBoundary screenName="Customers">
    <CustomersScreen {...props} />
  </ErrorBoundary>
);

const SafeSalesScreen = (props) => (
  <ErrorBoundary screenName="Sales">
    <SalesScreen {...props} />
  </ErrorBoundary>
);

const SafeExpensesScreen = (props) => (
  <ErrorBoundary screenName="Expenses">
    <ExpensesScreen {...props} />
  </ErrorBoundary>
);

const SafeFinancialSummaryScreen = (props) => (
  <ErrorBoundary screenName="Financial Summary">
    <FinancialSummaryScreen {...props} />
  </ErrorBoundary>
);

const SafeAddSaleScreen = (props) => (
  <ErrorBoundary screenName="Add Sale">
    <AddSaleScreen {...props} />
  </ErrorBoundary>
);

const SafeAddExpenseScreen = (props) => (
  <ErrorBoundary screenName="Add Expense">
    <AddExpenseScreen {...props} />
  </ErrorBoundary>
);

const SafeVaccinationScreen = (props) => (
  <ErrorBoundary screenName="Vaccination">
    <VaccinationScreen {...props} />
  </ErrorBoundary>
);

const SafeNotificationSettingsScreen = (props) => (
  <ErrorBoundary screenName="Notification Settings">
    <NotificationSettingsScreen {...props} />
  </ErrorBoundary>
);

// Profile Stack Navigator
const ProfileStack = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.headerBackground,
        },
        headerTintColor: theme.colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={SafeProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={SafeNotificationSettingsScreen}
        options={{ title: 'Notification Settings' }}
      />
    </Stack.Navigator>
  );
};

// Analytics Stack Navigator
const AnalyticsStack = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.headerBackground,
        },
        headerTintColor: theme.colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="AnalyticsMain"
        component={SafeAnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
      <Stack.Screen
        name="FlockPerformance"
        component={SafeFlockPerformanceScreen}
        options={{ title: 'Flock Performance' }}
      />
      <Stack.Screen
        name="FinancialAnalytics"
        component={SafeFinancialAnalyticsScreen}
        options={{ title: 'Financial Analytics' }}
      />
      <Stack.Screen
        name="FinancialSummary"
        component={SafeFinancialSummaryScreen}
        options={{ title: 'Financial Summary' }}
      />
      <Stack.Screen
        name="Customers"
        component={SafeCustomersScreen}
        options={{ title: 'Customers' }}
      />
      <Stack.Screen
        name="Sales"
        component={SafeSalesScreen}
        options={{ title: 'Sales' }}
      />
      <Stack.Screen
        name="AddSale"
        component={SafeAddSaleScreen}
        options={{ title: 'Add Sale' }}
      />
      <Stack.Screen
        name="Expenses"
        component={SafeExpensesScreen}
        options={{ title: 'Expenses' }}
      />
      <Stack.Screen
        name="AddExpense"
        component={SafeAddExpenseScreen}
        options={{ title: 'Add Expense' }}
      />
      <Stack.Screen
        name="Vaccination"
        component={SafeVaccinationScreen}
        options={{ title: 'Vaccination Records' }}
      />
    </Stack.Navigator>
  );
};

// Auth Stack Navigator
const AuthStack = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.headerBackground,
        },
        headerTintColor: theme.colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={SafeWelcomeScreen}
        options={{
          title: 'Poultry360',
          headerShown: false
        }}
      />
      <Stack.Screen
        name="Login"
        component={SafeLoginScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        name="Register"
        component={SafeRegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="OrganizationSelection"
        component={SafeOrganizationSelectionScreen}
        options={{
          title: 'Select Organization',
          headerBackTitle: 'Back'
        }}
      />
    </Stack.Navigator>
  );
};

// Main App Tab Navigator
const MainTabNavigator = () => {
  const authContext = useAuth();
  const { theme } = useTheme();

  // CRASH FIX: Add proper null checks for auth context
  if (!authContext || !authContext.user) {
    console.warn('MainTabNavigator: Auth context or user is null');
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color="#2E8B57" />
        <Text style={styles(theme).loadingText}>Loading user data...</Text>
      </View>
    );
  }

  const { user } = authContext;
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.tabBarActiveTint,
        tabBarInactiveTintColor: theme.colors.tabBarInactiveTint,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBarBackground,
          borderTopColor: theme.colors.tabBarBorder,
        },
        headerStyle: {
          backgroundColor: theme.colors.headerBackground,
        },
        headerTintColor: theme.colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={SafeDashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>📊</Text>
          ),
          title: 'Dashboard',
        }}
      />
      {/* Only managers can access Farms */}
      {isManager && (
        <Tab.Screen
          name="Farms"
          component={SafeFarmsScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>🏠</Text>
            ),
            title: 'Farms',
          }}
        />
      )}
      <Tab.Screen
        name="Batches"
        component={SafeBatchesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>🐔</Text>
          ),
          title: 'Batches',
        }}
      />
      <Tab.Screen
        name="Records"
        component={SafeRecordsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>📝</Text>
          ),
          title: 'Records',
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>📊</Text>
          ),
          title: 'Analytics',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? theme.colors.tabBarActiveTint : theme.colors.tabBarInactiveTint }}>👤</Text>
          ),
          title: 'Profile',
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

// Loading Screen Component
const LoadingScreen = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles(theme).loadingContainer, { backgroundColor: theme.colors.loadingBackground }]}>
      <ActivityIndicator size="large" color={theme.colors.loadingText} />
      <Text style={[styles(theme).loadingText, { color: theme.colors.loadingText }]}>Loading...</Text>
    </View>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const authContext = useAuth();

  // CRASH FIX: Add null check for auth context
  if (!authContext) {
    console.error('AppNavigator: Auth context is null - critical error');
    return (
      <View style={styles(theme).loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={[styles(theme).loadingText, { color: '#FF3B30' }]}>
          Authentication Error
        </Text>
        <Text style={[styles(theme).loadingText, { fontSize: 12, marginTop: 10 }]}>
          Please restart the app
        </Text>
      </View>
    );
  }

  const { isAuthenticated, isLoading } = authContext;

  if (isLoading) {
    return <LoadingScreen />;
  }

  // CRASH FIX: Wrap NavigationContainer in try-catch error boundary
  try {
    return (
      <NavigationContainer
        onStateChange={(state) => {
          // CRASH FIX: Log navigation state changes for debugging
          if (__DEV__) {
            console.log('Navigation state changed:', state?.index, state?.routeNames?.[state?.index]);
          }
        }}
        onUnhandledAction={(action) => {
          // CRASH FIX: Handle navigation to non-existent routes
          console.warn('Unhandled navigation action:', action);
        }}
      >
        {isAuthenticated ? <MainTabNavigator /> : <AuthStack />}
      </NavigationContainer>
    );
  } catch (error) {
    console.error('Navigation error:', error);
    return (
      <View style={styles(theme).loadingContainer}>
        <Text style={[styles(theme).loadingText, { color: '#FF3B30' }]}>
          Navigation Error
        </Text>
        <Text style={[styles(theme).loadingText, { fontSize: 12, marginTop: 10 }]}>
          {error?.message || 'Unknown error'}
        </Text>
      </View>
    );
  }
};

const styles = (theme) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});

export default AppNavigator;