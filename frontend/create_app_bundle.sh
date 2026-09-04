#!/bin/bash

APP_DIR="$HOME/Applications/NebulaVault.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

echo "Building standalone Native macOS App Bundle at $APP_DIR..."

mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

# Build production Vite web asset bundle
npm run build

# Create Info.plist for macOS App Bundle
cat << 'EOF' > "$CONTENTS_DIR/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>NebulaVault</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.nebulavault.studio</string>
    <key>CFBundleName</key>
    <string>NebulaVault</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>3.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Create executable launcher script
cat << 'EOF' > "$MACOS_DIR/NebulaVault"
#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/../../.."
open http://localhost:3000/
EOF

chmod +x "$MACOS_DIR/NebulaVault"

echo "Successfully generated NebulaVault.app in $HOME/Applications!"
ls -la "$APP_DIR"
