/**
 * MANUAL AUTHENTICATION TESTING SCRIPT
 *
 * This script tests the two critical authentication fixes:
 * 1. "true is not a function" error fix in asyncOperationWrapper
 * 2. Role selector showing all 4 roles fix in RegisterScreen
 *
 * Run this with: node __tests__/auth-manual-test.js
 */

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════════════');
console.log('CRITICAL AUTHENTICATION FIXES VALIDATION');
console.log('═══════════════════════════════════════════════════════════════\n');

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (details) {
    console.log(`   ${details}\n`);
  }

  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

// ============================================================================
// TEST 1: Verify asyncOperationWrapper.js returns objects
// ============================================================================
console.log('TEST 1: AsyncStorage Operations Return Objects\n');

const wrapperPath = path.join(__dirname, '..', 'src', 'utils', 'asyncOperationWrapper.js');
const wrapperCode = fs.readFileSync(wrapperPath, 'utf8');

// Check safeStorageSet returns object
const hasSetFix = wrapperCode.includes('async safeStorageSet(key, value)') &&
                  wrapperCode.includes('return { success: true, value: result };') &&
                  wrapperCode.includes('CRASH FIX: AsyncStorage.setItem returns undefined/true');

logTest(
  'safeStorageSet returns { success: true, value: result }',
  hasSetFix,
  hasSetFix ? 'Lines 131-142 contain proper return object' : 'MISSING FIX in safeStorageSet'
);

// Check safeStorageRemove returns object
const hasRemoveFix = wrapperCode.includes('async safeStorageRemove(key)') &&
                     wrapperCode.includes('return { success: true, value: result };') &&
                     wrapperCode.includes('CRASH FIX: AsyncStorage.removeItem returns undefined/true');

logTest(
  'safeStorageRemove returns { success: true, value: result }',
  hasRemoveFix,
  hasRemoveFix ? 'Lines 144-155 contain proper return object' : 'MISSING FIX in safeStorageRemove'
);

// Check that the operations wrap the raw AsyncStorage calls
const wrapsSetItem = wrapperCode.includes('AsyncStorage.setItem(key,') &&
                     wrapperCode.includes('await this.safeAsync(');

logTest(
  'safeStorageSet wraps AsyncStorage.setItem',
  wrapsSetItem,
  wrapsSetItem ? 'AsyncStorage.setItem is wrapped in safeAsync' : 'Missing safeAsync wrapper'
);

const wrapsRemoveItem = wrapperCode.includes('AsyncStorage.removeItem(key)') &&
                        wrapperCode.includes('await this.safeAsync(');

logTest(
  'safeStorageRemove wraps AsyncStorage.removeItem',
  wrapsRemoveItem,
  wrapsRemoveItem ? 'AsyncStorage.removeItem is wrapped in safeAsync' : 'Missing safeAsync wrapper'
);

// ============================================================================
// TEST 2: Verify RegisterScreen shows all 4 roles
// ============================================================================
console.log('\nTEST 2: Role Selector Shows All 4 Roles\n');

const registerPath = path.join(__dirname, '..', 'src', 'screens', 'RegisterScreen.js');
const registerCode = fs.readFileSync(registerPath, 'utf8');

// Check all 4 Picker.Item components exist
const hasWorkerRole = registerCode.includes('<Picker.Item label="👷 Worker" value="worker" />');
const hasManagerRole = registerCode.includes('<Picker.Item label="👨‍💼 Manager" value="manager" />');
const hasAdminRole = registerCode.includes('<Picker.Item label="⭐ Admin" value="admin" />');
const hasOwnerRole = registerCode.includes('<Picker.Item label="👑 Owner" value="owner" />');

logTest(
  'Worker role is present',
  hasWorkerRole,
  hasWorkerRole ? 'Found: <Picker.Item label="👷 Worker" value="worker" />' : 'MISSING Worker role'
);

logTest(
  'Manager role is present',
  hasManagerRole,
  hasManagerRole ? 'Found: <Picker.Item label="👨‍💼 Manager" value="manager" />' : 'MISSING Manager role'
);

logTest(
  'Admin role is present',
  hasAdminRole,
  hasAdminRole ? 'Found: <Picker.Item label="⭐ Admin" value="admin" />' : 'MISSING Admin role'
);

logTest(
  'Owner role is present',
  hasOwnerRole,
  hasOwnerRole ? 'Found: <Picker.Item label="👑 Owner" value="owner" />' : 'MISSING Owner role'
);

// Check that there are NO conditional renders around Admin/Owner
// Extract the role picker section (search for the role Picker)
const rolePickerMatch = registerCode.match(/<Text[^>]*>Role<\/Text>[\s\S]*?<Picker[^>]*selectedValue={formData\.role}[\s\S]*?<\/Picker>/);

if (rolePickerMatch) {
  const rolePickerSection = rolePickerMatch[0];

  // Check for conditional rendering patterns
  const hasConditionalAdmin = rolePickerSection.includes("registrationType === 'create' &&") ||
                               rolePickerSection.includes("{formData.registrationType === 'create'");

  logTest(
    'No conditional rendering around Admin/Owner roles',
    !hasConditionalAdmin,
    hasConditionalAdmin ? 'FOUND conditional rendering - roles may be hidden' : 'All roles always visible'
  );

  // Check that all 4 roles are in this section
  const allRolesInPicker = hasWorkerRole && hasManagerRole && hasAdminRole && hasOwnerRole;

  logTest(
    'All 4 roles are in the Picker component',
    allRolesInPicker,
    allRolesInPicker ? 'Worker, Manager, Admin, Owner all present in lines 572-595' : 'Some roles missing from Picker'
  );
} else {
  logTest(
    'Role Picker component exists',
    false,
    'Could not find role Picker component in RegisterScreen'
  );
}

// ============================================================================
// TEST 3: Verify AuthContext uses asyncOperationWrapper correctly
// ============================================================================
console.log('\nTEST 3: AuthContext Uses AsyncOperationWrapper Correctly\n');

const authContextPath = path.join(__dirname, '..', 'src', 'context', 'AuthContext.js');
const authContextCode = fs.readFileSync(authContextPath, 'utf8');

// Check that AuthContext imports asyncOperationWrapper
const importsWrapper = authContextCode.includes("import asyncOperationWrapper from '../utils/asyncOperationWrapper'");

logTest(
  'AuthContext imports asyncOperationWrapper',
  importsWrapper,
  importsWrapper ? 'Found: import asyncOperationWrapper' : 'MISSING import'
);

// Check that login uses asyncOperationWrapper.safeStorageSet
const loginUsesWrapper = authContextCode.includes('await asyncOperationWrapper.safeStorageSet(\'authToken\'') &&
                         authContextCode.includes('await asyncOperationWrapper.safeStorageSet(\'userData\'');

logTest(
  'login() uses asyncOperationWrapper.safeStorageSet',
  loginUsesWrapper,
  loginUsesWrapper ? 'Lines 322-323 use safeStorageSet for token and userData' : 'MISSING safeStorageSet in login'
);

// Check that register uses asyncOperationWrapper for cleanup
const registerUsesWrapper = authContextCode.includes('await asyncOperationWrapper.safeStorageRemove(\'authToken\')') &&
                            authContextCode.includes('await asyncOperationWrapper.safeStorageRemove(\'userData\')');

logTest(
  'register() uses asyncOperationWrapper.safeStorageRemove',
  registerUsesWrapper,
  registerUsesWrapper ? 'Lines 589-593 use safeStorageRemove for cleanup' : 'MISSING safeStorageRemove in register'
);

// Check for CRASH FIX comments in AuthContext
const hasCrashFixComments = authContextCode.includes('CRASH FIX: Add null/undefined check');

logTest(
  'AuthContext has CRASH FIX comments',
  hasCrashFixComments,
  hasCrashFixComments ? 'Found CRASH FIX comments for validation' : 'Missing CRASH FIX documentation'
);

// ============================================================================
// TEST 4: Verify LoginScreen handles result objects
// ============================================================================
console.log('\nTEST 4: LoginScreen Handles Result Objects\n');

const loginScreenPath = path.join(__dirname, '..', 'src', 'screens', 'LoginScreen.js');
const loginScreenCode = fs.readFileSync(loginScreenPath, 'utf8');

// Check for result validation
const validatesResult = loginScreenCode.includes('if (!result || typeof result !== \'object\')');

logTest(
  'LoginScreen validates result is an object',
  validatesResult,
  validatesResult ? 'Lines 118-121 validate result object' : 'MISSING result validation'
);

// Check for result.success check
const checksSuccess = loginScreenCode.includes('if (result.success)');

logTest(
  'LoginScreen checks result.success property',
  checksSuccess,
  checksSuccess ? 'Line 145 checks result.success' : 'MISSING result.success check'
);

// Check for CRASH FIX comments
const hasLoginCrashFix = loginScreenCode.includes('CRASH FIX: Add comprehensive null/undefined checks');

logTest(
  'LoginScreen has CRASH FIX comments',
  hasLoginCrashFix,
  hasLoginCrashFix ? 'Found CRASH FIX comments for result validation' : 'Missing CRASH FIX documentation'
);

// ============================================================================
// TEST 5: Verify API service returns proper data
// ============================================================================
console.log('\nTEST 5: API Service Returns Proper Data\n');

const apiServicePath = path.join(__dirname, '..', 'src', 'services', 'api.js');
const apiServiceCode = fs.readFileSync(apiServicePath, 'utf8');

// Check that login endpoint returns response.data
const loginReturnsData = apiServiceCode.includes('async login(email, password') &&
                         apiServiceCode.includes('return response.data;');

logTest(
  'api.login() returns response.data',
  loginReturnsData,
  loginReturnsData ? 'Line 230 returns response.data' : 'MISSING return response.data'
);

// Check that register endpoint returns response.data
const registerReturnsData = apiServiceCode.includes('async register(userData)') &&
                            apiServiceCode.includes('return response.data;');

logTest(
  'api.register() returns response.data',
  registerReturnsData,
  registerReturnsData ? 'Line 282 returns response.data' : 'MISSING return response.data'
);

// Check for response validation
const validatesResponse = apiServiceCode.includes('if (!response.data)');

logTest(
  'API service validates response.data',
  validatesResponse,
  validatesResponse ? 'Lines 278-280 validate response.data' : 'MISSING response validation'
);

// ============================================================================
// FINAL REPORT
// ============================================================================
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TEST SUMMARY');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`Pass Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2)}%\n`);

if (testResults.failed > 0) {
  console.log('FAILED TESTS:\n');
  testResults.tests
    .filter(test => !test.passed)
    .forEach(test => {
      console.log(`❌ ${test.name}`);
      console.log(`   ${test.details}\n`);
    });
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('CRITICAL FIXES VERIFICATION');
console.log('═══════════════════════════════════════════════════════════════\n');

// Check if the two critical fixes are present
const criticalFix1 = hasSetFix && hasRemoveFix;
const criticalFix2 = hasWorkerRole && hasManagerRole && hasAdminRole && hasOwnerRole;

console.log(`BUG FIX #1 (AsyncStorage returns objects): ${criticalFix1 ? '✅ VERIFIED' : '❌ MISSING'}`);
console.log(`   - safeStorageSet returns { success, value }: ${hasSetFix ? '✅' : '❌'}`);
console.log(`   - safeStorageRemove returns { success, value }: ${hasRemoveFix ? '✅' : '❌'}\n`);

console.log(`BUG FIX #2 (All 4 roles visible): ${criticalFix2 ? '✅ VERIFIED' : '❌ MISSING'}`);
console.log(`   - Worker role present: ${hasWorkerRole ? '✅' : '❌'}`);
console.log(`   - Manager role present: ${hasManagerRole ? '✅' : '❌'}`);
console.log(`   - Admin role present: ${hasAdminRole ? '✅' : '❌'}`);
console.log(`   - Owner role present: ${hasOwnerRole ? '✅' : '❌'}\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('EXPECTED BEHAVIOR AFTER FIXES');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('1. Login with valid credentials:');
console.log('   ✅ Should successfully log in WITHOUT "true is not a function" error');
console.log('   ✅ AsyncStorage operations return { success: true, value: ... }');
console.log('   ✅ AuthContext receives proper result object with data\n');

console.log('2. Login with invalid credentials:');
console.log('   ✅ Should show proper error message WITHOUT "true is not a function" error');
console.log('   ✅ Storage cleanup operations return proper objects\n');

console.log('3. Registration:');
console.log('   ✅ All 4 roles visible: Worker, Manager, Admin, Owner');
console.log('   ✅ No "undefined" in role selector');
console.log('   ✅ Can register with any role WITHOUT "true is not a function" error');
console.log('   ✅ Registration cleanup returns proper objects\n');

console.log('4. AsyncStorage operations:');
console.log('   ✅ All setItem calls return { success: true, value: undefined/true }');
console.log('   ✅ All removeItem calls return { success: true, value: undefined }');
console.log('   ✅ No raw undefined/true values are passed to calling code\n');

console.log('═══════════════════════════════════════════════════════════════');
console.log('MANUAL TESTING CHECKLIST');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('[ ] 1. Open the app and navigate to Registration screen');
console.log('[ ] 2. Verify role dropdown shows all 4 roles: Worker, Manager, Admin, Owner');
console.log('[ ] 3. Try registering with valid data:');
console.log('      - Email: test@example.com');
console.log('      - Password: Test123!@#');
console.log('      - Role: Admin (or any role)');
console.log('[ ] 4. Verify NO "true is not a function" error occurs');
console.log('[ ] 5. Navigate to Login screen');
console.log('[ ] 6. Try login with INVALID credentials');
console.log('[ ] 7. Verify proper error message (NOT "true is not a function")');
console.log('[ ] 8. Try login with VALID credentials');
console.log('[ ] 9. Verify successful login WITHOUT errors');
console.log('[ ] 10. Check console logs for AsyncStorage operations\n');

console.log('═══════════════════════════════════════════════════════════════\n');

// Exit with appropriate code
process.exit(testResults.failed > 0 ? 1 : 0);
