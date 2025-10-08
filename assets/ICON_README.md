# Poultry360 Icon Design

## Design Concept
A cute, friendly white chicken with a modern, professional look on an orange gradient background.

## SVG Files Created
- `icon-design.svg` - Full app icon with background and 360° badge
- `adaptive-icon-design.svg` - Foreground layer for Android adaptive icons

## Converting SVG to PNG

You need to convert these SVG files to PNG format. Here are several options:

### Option 1: Online Converters (Easiest)
1. Visit https://convertio.co/svg-png/ or https://cloudconvert.com/svg-to-png
2. Upload `icon-design.svg`
3. Set output size to 1024x1024
4. Download and save as `icon.png`
5. Repeat for `adaptive-icon-design.svg` → `adaptive-icon.png`

### Option 2: Using Inkscape (Free Desktop App)
```bash
# Install Inkscape from https://inkscape.org/
inkscape icon-design.svg --export-type=png --export-width=1024 --export-height=1024 --export-filename=icon.png
inkscape adaptive-icon-design.svg --export-type=png --export-width=1024 --export-height=1024 --export-filename=adaptive-icon.png
```

### Option 3: Using ImageMagick
```bash
# Install ImageMagick from https://imagemagick.org/
magick convert -background none -size 1024x1024 icon-design.svg icon.png
magick convert -background none -size 1024x1024 adaptive-icon-design.svg adaptive-icon.png
```

### Option 4: Using Node.js (sharp library)
```bash
npm install sharp
node -e "const sharp = require('sharp'); sharp('icon-design.svg').resize(1024, 1024).png().toFile('icon.png')"
node -e "const sharp = require('sharp'); sharp('adaptive-icon-design.svg').resize(1024, 1024).png().toFile('adaptive-icon.png')"
```

## Icon Sizes Needed

After creating the 1024x1024 PNG files, you'll also need these sizes:

- **iOS**:
  - 20x20, 29x29, 40x40, 60x60, 76x76, 83.5x83.5, 1024x1024

- **Android**:
  - 48x48, 72x72, 96x96, 144x144, 192x192, 512x512

### Auto-generate All Sizes
Use this online tool to generate all required sizes automatically:
- https://easyappicon.com/
- https://appicon.co/

Just upload your 1024x1024 PNG and it will generate all sizes.

## Design Features

### Colors
- Background: Orange gradient (#FF6B35 to #F7931E)
- Chicken body: White to light gray gradient
- Comb & wattle: Red gradient (#FF4D4D to #D32F2F)
- Beak & feet: Orange (#FFA726)
- Eyes: Dark gray (#2C3E50) with white highlights
- 360° badge: White circle with orange text

### Design Elements
1. **Cute chicken character** - Friendly, approachable design
2. **Clean, modern style** - Professional appearance
3. **Orange gradient background** - Vibrant, energetic
4. **360° badge** - Brand identifier (in main icon only)
5. **Soft shadows** - Adds depth and professionalism

## Next Steps

1. Convert SVG files to PNG (1024x1024)
2. Generate all required icon sizes
3. Replace files in `/assets`:
   - `icon.png` (1024x1024)
   - `adaptive-icon.png` (1024x1024)
4. Update `app.json` if needed (already configured)
5. Rebuild the app with EAS Build

## Alternative Design Ideas

If you want to modify the design:
- Change background color in the gradient
- Add farm elements (barn, fence, grass)
- Different chicken pose (flying, eating)
- Add eggs or nest elements
- Different color scheme (blue, green, purple)
- Add text "Poultry360" below chicken
