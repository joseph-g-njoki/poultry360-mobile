/**
 * Auth Storage Service
 *
 * Handles secure storage of user credentials for offline login capability.
 * Uses bcryptjs for password hashing - never stores raw passwords.
 *
 * FLOW:
 * 1. On first successful online login → store hashed credentials locally
 * 2. On subsequent logins → if offline, validate against stored hash
 * 3. On registration → must be online, then store credentials for future offline use
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import bcrypt from 'bcryptjs';

const CREDENTIALS_KEY = 'secure_user_credentials';
const SALT_ROUNDS = 10;

class AuthStorageService {
  constructor() {
    this.serviceName = 'AuthStorageService';
  }

  /**
   * Store user credentials securely after successful online login
   * @param {string} email - User's email
   * @param {string} password - User's password (will be hashed)
   * @param {object} userData - Full user data from backend
   */
  async storeCredentials(email, password, userData) {
    try {
      console.log('[AuthStorage] Storing credentials for offline login capability...');

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      const credentialsData = {
        email: email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        userData: userData,
        storedAt: new Date().toISOString(),
        version: 1
      };

      await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentialsData));
      console.log('[AuthStorage] ✅ Credentials stored securely for offline login');
      return true;
    } catch (error) {
      console.error('[AuthStorage] ❌ Failed to store credentials:', error);
      return false;
    }
  }

  /**
   * Validate credentials for offline login
   * @param {string} email - User's email
   * @param {string} password - User's password to verify
   * @returns {object|null} User data if valid, null if invalid
   */
  async validateOfflineCredentials(email, password) {
    try {
      console.log('[AuthStorage] Validating credentials for offline login...');

      const storedData = await AsyncStorage.getItem(CREDENTIALS_KEY);
      if (!storedData) {
        console.log('[AuthStorage] No stored credentials found');
        return null;
      }

      const credentials = JSON.parse(storedData);

      // Check if email matches
      if (credentials.email !== email.toLowerCase().trim()) {
        console.log('[AuthStorage] Email does not match stored credentials');
        return null;
      }

      // Verify password against stored hash
      const isValid = await bcrypt.compare(password, credentials.passwordHash);

      if (isValid) {
        console.log('[AuthStorage] ✅ Credentials valid - offline login successful');
        return credentials.userData;
      } else {
        console.log('[AuthStorage] ❌ Invalid password');
        return null;
      }
    } catch (error) {
      console.error('[AuthStorage] Error validating credentials:', error);
      return null;
    }
  }

  /**
   * Check if user has stored credentials for offline login
   * @param {string} email - User's email
   * @returns {boolean} True if credentials exist
   */
  async hasStoredCredentials(email) {
    try {
      const storedData = await AsyncStorage.getItem(CREDENTIALS_KEY);
      if (!storedData) return false;

      const credentials = JSON.parse(storedData);
      return credentials.email === email.toLowerCase().trim();
    } catch (error) {
      console.error('[AuthStorage] Error checking stored credentials:', error);
      return false;
    }
  }

  /**
   * Clear stored credentials (on logout or account deletion)
   */
  async clearCredentials() {
    try {
      console.log('[AuthStorage] Clearing stored credentials...');
      await AsyncStorage.removeItem(CREDENTIALS_KEY);
      console.log('[AuthStorage] ✅ Credentials cleared');
      return true;
    } catch (error) {
      console.error('[AuthStorage] ❌ Failed to clear credentials:', error);
      return false;
    }
  }

  /**
   * Get stored user data without password verification
   * Used for checking if offline login is possible
   */
  async getStoredUserData() {
    try {
      const storedData = await AsyncStorage.getItem(CREDENTIALS_KEY);
      if (!storedData) return null;

      const credentials = JSON.parse(storedData);
      return {
        email: credentials.email,
        userData: credentials.userData,
        storedAt: credentials.storedAt
      };
    } catch (error) {
      console.error('[AuthStorage] Error getting stored user data:', error);
      return null;
    }
  }
}

export default new AuthStorageService();
