const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertIcons() {
  console.log('🎨 Starting icon conversion...\n');

  try {
    // Convert main icon
    console.log('📱 Converting main icon (icon.png)...');
    await sharp(path.join(__dirname, 'assets', 'icon-design.svg'))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(__dirname, 'assets', 'icon.png'));
    console.log('✅ icon.png created (1024x1024)');

    // Convert adaptive icon
    console.log('\n📱 Converting adaptive icon (adaptive-icon.png)...');
    await sharp(path.join(__dirname, 'assets', 'adaptive-icon-design.svg'))
      .resize(1024, 1024)
      .png()
      .toFile(path.join(__dirname, 'assets', 'adaptive-icon.png'));
    console.log('✅ adaptive-icon.png created (1024x1024)');

    // Create splash icon (same as main icon but optimized for splash screen)
    console.log('\n📱 Creating splash icon (splash-icon.png)...');
    await sharp(path.join(__dirname, 'assets', 'icon-design.svg'))
      .resize(512, 512)
      .png()
      .toFile(path.join(__dirname, 'assets', 'splash-icon.png'));
    console.log('✅ splash-icon.png created (512x512)');

    // Create favicon
    console.log('\n🌐 Creating favicon (favicon.png)...');
    await sharp(path.join(__dirname, 'assets', 'icon-design.svg'))
      .resize(48, 48)
      .png()
      .toFile(path.join(__dirname, 'assets', 'favicon.png'));
    console.log('✅ favicon.png created (48x48)');

    console.log('\n🎉 All icons converted successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Review the generated PNG files in /assets');
    console.log('2. Run: npx eas-cli build --profile production --platform android');
    console.log('3. Download and test the new APK with the cute chicken icon!');

  } catch (error) {
    console.error('❌ Error converting icons:', error.message);
    process.exit(1);
  }
}

convertIcons();
