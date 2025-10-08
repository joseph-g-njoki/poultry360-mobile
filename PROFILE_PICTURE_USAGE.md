# Profile Picture Quick Reference Guide

## For Developers

### How to Use Profile Picture in Other Screens

If you need to display the user's profile picture in other screens (e.g., Home, Settings), here's how:

#### 1. Import Required Components
```javascript
import { Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
```

#### 2. Load Profile Picture
```javascript
const { user } = useAuth();
const [profilePicture, setProfilePicture] = useState(null);

useEffect(() => {
  loadProfilePicture();
}, [user?.id]);

const loadProfilePicture = async () => {
  try {
    if (user?.id) {
      const savedPicture = await AsyncStorage.getItem(`@profile_picture_${user.id}`);
      if (savedPicture) {
        setProfilePicture(savedPicture);
      }
    }
  } catch (error) {
    console.error('Error loading profile picture:', error);
  }
};
```

#### 3. Display Profile Picture with Fallback
```javascript
{profilePicture ? (
  <Image
    source={{ uri: profilePicture }}
    style={{ width: 40, height: 40, borderRadius: 20 }}
    resizeMode="cover"
  />
) : (
  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
      {String(user?.firstName || 'U').charAt(0)}
      {String(user?.lastName || 'U').charAt(0)}
    </Text>
  </View>
)}
```

### Storage Key Pattern
Always use this pattern for consistency:
```javascript
const STORAGE_KEY = `@profile_picture_${user.id}`;
```

### AuthContext Integration
The user object now includes a `profilePicture` field:
```javascript
const { user } = useAuth();
// user.profilePicture contains the image URI (if set)
```

## For Backend Developers

### Current Implementation
- Profile pictures are stored locally on the device using AsyncStorage
- Storage key format: `@profile_picture_${userId}`
- Image format: Local file URI (e.g., `file:///path/to/image.jpg`)

### Backend Integration Plan

#### Step 1: Create Upload Endpoint
```javascript
// POST /api/users/profile-picture
// Headers: { Authorization: Bearer ${token} }
// Body: { image: base64String, userId: string }

app.post('/api/users/profile-picture', authenticate, async (req, res) => {
  try {
    const { image, userId } = req.body;

    // 1. Validate image
    if (!image || !image.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    // 2. Decode base64
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 3. Upload to S3/Cloudinary/Storage
    const imageUrl = await uploadToCloudStorage(buffer, userId);

    // 4. Update user record in database
    await db.users.update(
      { profilePictureUrl: imageUrl },
      { where: { id: userId } }
    );

    // 5. Return URL
    res.json({ success: true, imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

#### Step 2: Update Mobile Code to Use Backend
```javascript
// In ProfileScreen.js, modify saveProfilePicture function

const saveProfilePicture = async (uri) => {
  try {
    if (user?.id) {
      // Save locally first (for immediate display)
      await AsyncStorage.setItem(`@profile_picture_${user.id}`, uri);
      setProfilePicture(uri);

      // Convert to base64 for upload
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const base64Data = `data:image/jpeg;base64,${base64}`;

      // Upload to backend
      try {
        const response = await apiService.uploadProfilePicture({
          image: base64Data,
          userId: user.id,
        });

        if (response.success && response.imageUrl) {
          // Save server URL instead of local URI
          await AsyncStorage.setItem(`@profile_picture_${user.id}`, response.imageUrl);

          // Update user in AuthContext
          const updatedUser = {
            ...user,
            profilePicture: response.imageUrl,
          };
          await updateUser(updatedUser);
        }
      } catch (uploadError) {
        console.warn('Failed to upload to server, using local image:', uploadError);
        // Continue with local storage if server upload fails
      }

      Alert.alert('Success', 'Profile picture updated successfully!');
    }
  } catch (error) {
    console.error('Error saving profile picture:', error);
    Alert.alert('Error', 'Failed to save profile picture');
  }
};
```

#### Step 3: Add API Service Method
```javascript
// In src/services/api.js

uploadProfilePicture: async (data) => {
  try {
    const response = await axiosInstance.post('/users/profile-picture', data);
    return response.data;
  } catch (error) {
    console.error('Upload profile picture error:', error);
    throw new Error(error.response?.data?.message || 'Failed to upload profile picture');
  }
},
```

### Database Schema Update
Add to User model:
```sql
ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(500);
```

Or in TypeORM/Sequelize:
```javascript
@Column({ nullable: true })
profilePictureUrl: string;
```

### Image Storage Options

#### Option 1: AWS S3
```javascript
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

const uploadToS3 = async (buffer, userId) => {
  const key = `profile-pictures/${userId}/${Date.now()}.jpg`;
  await s3.putObject({
    Bucket: 'poultry360-images',
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    ACL: 'public-read',
  }).promise();

  return `https://poultry360-images.s3.amazonaws.com/${key}`;
};
```

#### Option 2: Cloudinary
```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (base64Data, userId) => {
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64Data}`,
    {
      folder: 'poultry360/profile-pictures',
      public_id: userId,
      overwrite: true,
      transformation: [
        { width: 500, height: 500, crop: 'fill' },
        { quality: 'auto:good' },
      ],
    }
  );

  return result.secure_url;
};
```

#### Option 3: Local File Storage
```javascript
const fs = require('fs').promises;
const path = require('path');

const uploadToLocal = async (buffer, userId) => {
  const uploadDir = path.join(__dirname, '../uploads/profile-pictures');
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${userId}-${Date.now()}.jpg`;
  const filepath = path.join(uploadDir, filename);

  await fs.writeFile(filepath, buffer);

  return `/uploads/profile-pictures/${filename}`;
};
```

### Security Considerations
1. **File Size Limit**: Max 5MB per image
2. **File Type Validation**: Only allow JPEG, PNG
3. **Image Scanning**: Scan for malware (optional)
4. **Rate Limiting**: Limit uploads to 1 per minute
5. **Authentication**: Always verify JWT token
6. **Authorization**: Users can only update their own pictures

### Example Backend Validation
```javascript
const validateImage = (base64Data) => {
  // Check if it's a valid base64 image
  if (!base64Data.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }

  // Check file size (base64 is ~33% larger than original)
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > 5) {
    throw new Error('Image size must be less than 5MB');
  }

  // Check image type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const mimeType = base64Data.split(';')[0].split(':')[1];

  if (!allowedTypes.includes(mimeType)) {
    throw new Error('Only JPEG and PNG images are allowed');
  }

  return true;
};
```

## Testing the Feature

### Manual Testing Steps
1. Open Poultry360 mobile app
2. Navigate to Profile screen
3. Tap on the avatar (profile picture area)
4. Select "Take Photo" and take a picture
5. Crop/adjust the image
6. Verify image is displayed immediately
7. Close and reopen the app
8. Verify image persists
9. Repeat with "Choose from Gallery"
10. Test on both iOS and Android

### Automated Testing (Future)
```javascript
// Example test case
describe('ProfileScreen - Profile Picture', () => {
  it('should load saved profile picture on mount', async () => {
    // Mock AsyncStorage
    AsyncStorage.getItem.mockResolvedValue('file:///mock/image.jpg');

    const { getByTestId } = render(<ProfileScreen />);

    await waitFor(() => {
      expect(getByTestId('profile-image')).toBeTruthy();
    });
  });

  it('should show initials when no picture is set', () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const { getByText } = render(<ProfileScreen />);

    expect(getByText('JD')).toBeTruthy(); // John Doe initials
  });
});
```

## Troubleshooting

### Issue: "Image not loading"
**Solution**: Check AsyncStorage key format and ensure user.id is available

### Issue: "Permission denied"
**Solution**: Guide user to device settings to enable camera/photos permission

### Issue: "Image too large"
**Solution**: Image is already compressed to 70%, consider reducing quality further

### Issue: "Image not persisting"
**Solution**: Verify AsyncStorage is working and user.id is consistent

### Issue: "Camera not working in simulator"
**Solution**: Test on physical device, camera may not work in all simulators

## API Documentation

### Endpoints (To Be Implemented)

#### Upload Profile Picture
```
POST /api/users/profile-picture
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
  "userId": "user-uuid-here"
}

Success Response (200):
{
  "success": true,
  "imageUrl": "https://cdn.poultry360.com/profile/user123.jpg",
  "message": "Profile picture uploaded successfully"
}

Error Response (400):
{
  "success": false,
  "error": "Invalid image format"
}
```

#### Get Profile Picture
```
GET /api/users/:userId/profile-picture
Authorization: Bearer {token}

Success Response (200):
{
  "success": true,
  "imageUrl": "https://cdn.poultry360.com/profile/user123.jpg"
}
```

#### Delete Profile Picture
```
DELETE /api/users/profile-picture
Authorization: Bearer {token}

Success Response (200):
{
  "success": true,
  "message": "Profile picture deleted successfully"
}
```

## Support
For questions or issues, contact the development team.
