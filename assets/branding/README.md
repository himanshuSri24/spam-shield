# Hang Up - Asset Generation Guide
#
# SVG source files are in assets/branding/
# To generate production PNGs, use one of these methods:
#
# Option 1: Using sharp-cli (Node.js)
#   npm install -g sharp-cli
#   sharp -i assets/branding/icon-source.svg -o assets/images/icon.png resize 1024 1024
#   sharp -i assets/branding/adaptive-foreground.svg -o assets/images/android-icon-foreground.png resize 1024 1024
#   sharp -i assets/branding/adaptive-background.svg -o assets/images/android-icon-background.png resize 1024 1024
#   sharp -i assets/branding/icon-source.svg -o assets/images/splash-icon.png resize 512 512
#   sharp -i assets/branding/feature-graphic.svg -o assets/branding/feature-graphic.png resize 1024 500
#
# Option 2: Using Inkscape CLI
#   inkscape assets/branding/icon-source.svg -o assets/images/icon.png -w 1024 -h 1024
#   inkscape assets/branding/adaptive-foreground.svg -o assets/images/android-icon-foreground.png -w 1024 -h 1024
#   inkscape assets/branding/adaptive-background.svg -o assets/images/android-icon-background.png -w 1024 -h 1024
#
# Option 3: Use Figma / online SVG-to-PNG converter
#   Upload SVGs and export at required dimensions.
#
# Required sizes for Play Store:
#   - App icon: 512x512 (Play Store listing)
#   - Feature graphic: 1024x500
#   - Adaptive icon foreground: 1024x1024 (with safe zone padding)
#   - Adaptive icon background: 1024x1024
#   - Splash icon: 200px wide (as configured in app.json)

# Assets reference:
# icon-source.svg        → Full app icon with text (for icon.png, favicon.png)
# adaptive-foreground.svg → Phone+block symbol only (for android-icon-foreground.png)
# adaptive-background.svg → Cream bg with subtle pattern (for android-icon-background.png)
# feature-graphic.svg    → Play Store banner with branding
