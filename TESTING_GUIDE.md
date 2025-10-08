# Profile Picture Testing Guide

## Pre-Testing Checklist
- [ ] Expo app is installed and running
- [ ] Device/simulator has camera access
- [ ] Device/simulator has photo library access
- [ ] User is logged into the app
- [ ] Profile screen is accessible

## Manual Testing Scenarios

### Scenario 1: Take Photo with Camera
**Steps:**
1. Navigate to Profile screen
2. Tap on the circular avatar/profile picture
3. Select "Take Photo" from the dialog
4. Grant camera permission if prompted
5. Take a photo using the camera
6. Adjust/crop the image as needed
7. Confirm the selection

**Expected Results:**
- Camera opens successfully
- Photo is captured
- Image editor appears (crop/adjust)
- After confirmation, profile picture updates immediately
- Camera icon badge shows on avatar
- Success alert appears

**Pass/Fail:** ___________

---

### Scenario 2: Choose from Gallery
**Steps:**
1. Navigate to Profile screen
2. Tap on the circular avatar/profile picture
3. Select "Choose from Gallery" from the dialog
4. Grant photo library permission if prompted
5. Select an existing photo
6. Adjust/crop the image as needed
7. Confirm the selection

**Expected Results:**
- Photo gallery opens successfully
- User can browse photos
- Photo is selected
- Image editor appears (crop/adjust)
- After confirmation, profile picture updates immediately
- Camera icon badge shows on avatar
- Success alert appears

**Pass/Fail:** ___________

---

### Scenario 3: Cancel Image Selection
**Steps:**
1. Navigate to Profile screen
2. Tap on the circular avatar/profile picture
3. Select "Cancel" from the dialog

**Expected Results:**
- Dialog closes
- No changes to profile picture
- No error messages

**Pass/Fail:** ___________

---

### Scenario 4: Permission Denied - Camera
**Steps:**
1. Navigate to Profile screen
2. Tap on the avatar
3. Select "Take Photo"
4. Deny camera permission when prompted

**Expected Results:**
- Alert appears: "Camera Permission Required"
- Alert message explains how to enable permission
- No crash or error
- Profile picture remains unchanged

**Pass/Fail:** ___________

---

### Scenario 5: Permission Denied - Gallery
**Steps:**
1. Navigate to Profile screen
2. Tap on the avatar
3. Select "Choose from Gallery"
4. Deny photo library permission when prompted

**Expected Results:**
- Alert appears: "Media Library Permission Required"
- Alert message explains how to enable permission
- No crash or error
- Profile picture remains unchanged

**Pass/Fail:** ___________

---

### Scenario 6: Image Persistence
**Steps:**
1. Set a profile picture (using camera or gallery)
2. Verify picture displays correctly
3. Close the app completely
4. Reopen the app
5. Navigate to Profile screen

**Expected Results:**
- Profile picture loads from storage
- Same image displays as before
- No loading errors
- Image loads within 1-2 seconds

**Pass/Fail:** ___________

---

### Scenario 7: Loading State
**Steps:**
1. Navigate to Profile screen
2. Tap on the avatar
3. Select "Take Photo" or "Choose from Gallery"
4. Observe the camera icon badge during processing

**Expected Results:**
- Camera icon badge shows loading spinner while processing
- Avatar is disabled during loading (can't tap again)
- Loading state clears after image is saved
- No stuck loading states

**Pass/Fail:** ___________

---

### Scenario 8: Multiple Users (Different Accounts)
**Steps:**
1. User A logs in
2. User A sets a profile picture
3. User A logs out
4. User B logs in
5. Check User B's profile picture
6. User B sets a different profile picture
7. User B logs out
8. User A logs back in

**Expected Results:**
- User A sees their original picture (not User B's)
- User B sees their own picture (not User A's)
- Images are stored per user
- No image conflicts between users

**Pass/Fail:** ___________

---

### Scenario 9: Dark Mode vs Light Mode
**Steps:**
1. Set a profile picture in light mode
2. Toggle to dark mode (in app settings)
3. Check profile picture display
4. Toggle back to light mode
5. Check profile picture display

**Expected Results:**
- Profile picture displays correctly in both modes
- Camera icon badge styling adapts to theme
- Avatar border styling works in both modes
- No visual glitches or color issues

**Pass/Fail:** ___________

---

### Scenario 10: No Profile Picture (Initials Display)
**Steps:**
1. Create new user account
2. Navigate to Profile screen
3. Observe avatar display

**Expected Results:**
- Circular white background displays
- User's initials show (first letter of first name + first letter of last name)
- Initials are centered
- Camera icon badge displays
- Tapping avatar still shows options

**Pass/Fail:** ___________

---

### Scenario 11: Network Issues (Offline Mode)
**Steps:**
1. Enable airplane mode on device
2. Open the app
3. Navigate to Profile screen
4. Tap avatar and select image
5. Set profile picture

**Expected Results:**
- Image picker works offline
- Profile picture saves locally
- No network errors
- Image persists after saving
- Success message appears

**Pass/Fail:** ___________

---

### Scenario 12: Large Image Handling
**Steps:**
1. Navigate to Profile screen
2. Tap avatar
3. Choose a very large image (e.g., 10MB+ photo)
4. Confirm selection

**Expected Results:**
- Image is automatically compressed to ~70% quality
- No memory errors or crashes
- Image displays clearly
- App remains responsive
- Save completes within 5 seconds

**Pass/Fail:** ___________

---

### Scenario 13: Image Editing (Crop/Zoom)
**Steps:**
1. Navigate to Profile screen
2. Tap avatar and select image
3. In the image editor:
   - Zoom in/out
   - Pan around
   - Adjust crop area
4. Confirm

**Expected Results:**
- Image editor is responsive
- 1:1 aspect ratio is enforced (square)
- Cropped area saves correctly
- Final image is square (not distorted)

**Pass/Fail:** ___________

---

### Scenario 14: Error Recovery
**Steps:**
1. Navigate to Profile screen
2. Tap avatar
3. Select image that causes an error (if possible)
4. Observe error handling

**Expected Results:**
- Error alert displays with clear message
- App doesn't crash
- Can retry operation
- Previous profile picture remains unchanged
- No corrupted state

**Pass/Fail:** ___________

---

## Platform-Specific Testing

### iOS Testing
- [ ] Camera permission dialog shows correctly
- [ ] Photo library permission dialog shows correctly
- [ ] Image picker UI matches iOS style
- [ ] Profile picture displays on all iOS versions
- [ ] No crashes on iPhone
- [ ] No crashes on iPad
- [ ] Works on iOS 14, 15, 16, 17+

### Android Testing
- [ ] Camera permission dialog shows correctly
- [ ] Photo library permission dialog shows correctly
- [ ] Image picker UI matches Android style
- [ ] Profile picture displays on all Android versions
- [ ] No crashes on various Android devices
- [ ] Works on Android 10, 11, 12, 13+
- [ ] No issues with different screen sizes

---

## Performance Testing

### Load Time
- [ ] Profile picture loads in < 2 seconds on mount
- [ ] No blocking of UI during image load
- [ ] Smooth scrolling on Profile screen

### Memory Usage
- [ ] No memory leaks after multiple image changes
- [ ] App memory usage remains stable
- [ ] No crashes due to out-of-memory

### Storage
- [ ] AsyncStorage operations are fast (< 100ms)
- [ ] Image URIs are stored correctly
- [ ] No storage corruption

---

## Accessibility Testing
- [ ] Avatar is tappable with large touch target
- [ ] Loading states are clear
- [ ] Error messages are readable
- [ ] Works with VoiceOver (iOS) / TalkBack (Android)

---

## Edge Cases

### Edge Case 1: Very Long Names
**Steps:**
1. User with very long first/last names
2. Check initials display

**Expected Results:**
- Only first letter of each name shows
- Text doesn't overflow
- Still centered properly

**Pass/Fail:** ___________

---

### Edge Case 2: No Last Name
**Steps:**
1. User with only first name
2. Check initials display

**Expected Results:**
- Shows first letter of first name + "U"
- Or handles gracefully

**Pass/Fail:** ___________

---

### Edge Case 3: Special Characters in User ID
**Steps:**
1. User with special characters in ID
2. Set profile picture
3. Check AsyncStorage key

**Expected Results:**
- Storage key is properly escaped
- No storage errors
- Picture saves and loads correctly

**Pass/Fail:** ___________

---

## Bug Reporting Template

If you find a bug, use this template:

**Bug Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Screenshots:**
[Attach screenshots if applicable]

**Environment:**
- Device: [e.g., iPhone 14 Pro]
- OS Version: [e.g., iOS 17.1]
- App Version: [e.g., 1.0.0]

**Console Logs:**
```
[Paste relevant console logs]
```

---

## Testing Summary

| Test Scenario | iOS Pass/Fail | Android Pass/Fail | Notes |
|--------------|---------------|-------------------|-------|
| Take Photo | | | |
| Choose Gallery | | | |
| Cancel Selection | | | |
| Permission Denied | | | |
| Image Persistence | | | |
| Loading State | | | |
| Multiple Users | | | |
| Dark/Light Mode | | | |
| Initials Display | | | |
| Offline Mode | | | |
| Large Images | | | |
| Image Editing | | | |
| Error Recovery | | | |

**Overall Status:** ___________

**Tested By:** ___________

**Date:** ___________

**Additional Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

---

## Automation Testing (Future)

### Test Cases to Automate
```javascript
describe('ProfileScreen - Profile Picture', () => {
  test('loads saved profile picture on mount', async () => {
    // Test implementation
  });

  test('shows initials when no picture is set', () => {
    // Test implementation
  });

  test('displays loading indicator while processing image', () => {
    // Test implementation
  });

  test('shows error alert when image selection fails', () => {
    // Test implementation
  });

  test('stores profile picture with correct AsyncStorage key', () => {
    // Test implementation
  });
});
```

---

## Sign-Off

**Developer:** ___________
**Date:** ___________
**Signature:** ___________

**QA Tester:** ___________
**Date:** ___________
**Signature:** ___________

**Product Owner:** ___________
**Date:** ___________
**Signature:** ___________
