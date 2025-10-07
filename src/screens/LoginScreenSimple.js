// SIMPLIFIED LOGIN SCREEN HANDLER - NO ALERTS
// This file contains the replacement handleLogin function with no Alert.alert() calls
// Copy this into LoginScreen.js to replace the existing handleLogin function

const handleLogin = async () => {
  // SILENT FIX: Validate but don't show alerts - just log and return
  if (!email.trim() || !password.trim()) {
    console.log('[LoginScreen] Validation failed - empty fields');
    return;
  }

  if (!validateEmail(email)) {
    console.log('[LoginScreen] Validation failed - invalid email');
    return;
  }

  setLoading(true);
  try {
    console.log(`[LoginScreen] Attempting login for: ${email}`);
    const result = await login(email.toLowerCase().trim(), password);

    if (result.success) {
      console.log('[LoginScreen] Login successful:', result);
      // SILENT FIX: Don't show any alerts - just proceed silently
      // Navigation will be handled automatically by AuthContext
    } else if (result.requiresOrgSelection && result.organizations) {
      console.log('[LoginScreen] Organization selection required');
      try {
        navigation.navigate('OrganizationSelection', {
          email: email.toLowerCase().trim(),
          password: password,
          organizationsList: result.organizations
        });
      } catch (navError) {
        console.error('[LoginScreen] Navigation error:', navError);
      }
    } else {
      // SILENT FIX: Log failure but don't show alert
      console.error('[LoginScreen] Login failed:', result.error || 'Invalid credentials');
    }
  } catch (error) {
    // SILENT FIX: Log error but don't show alert
    console.error('[LoginScreen] Login error:', error?.message || error);
  } finally {
    setLoading(false);
  }
};