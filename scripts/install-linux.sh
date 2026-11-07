#!/bin/sh
# Installs the built AppImage into ~/Applications and adds a menu/desktop shortcut.
set -e
cd "$(dirname "$0")/.."

APPIMAGE=$(ls -t dist/Monitor-*.AppImage 2>/dev/null | head -1)
[ -n "$APPIMAGE" ] || { echo "No AppImage in dist/. Run: npm run build:linux" >&2; exit 1; }

BIN_DIR="$HOME/Applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$BIN_DIR" "$ICON_DIR" "$APPS_DIR"

# Copy then rename: a running Monitor keeps its old file, and cp onto it would fail with "Text file busy".
cp "$APPIMAGE" "$BIN_DIR/Monitor.AppImage.new"
chmod +x "$BIN_DIR/Monitor.AppImage.new"
mv -f "$BIN_DIR/Monitor.AppImage.new" "$BIN_DIR/Monitor.AppImage"
python3 -c "from PIL import Image; Image.open('build/icon.png').resize((512, 512)).save('$ICON_DIR/monitor.png')" 2>/dev/null \
  || cp build/icon.png "$ICON_DIR/monitor.png"

# libfuse2 is missing on recent Ubuntu; extract-and-run works without it.
cat > "$APPS_DIR/monitor.desktop" <<DESKTOP
[Desktop Entry]
Name=Monitor
Comment=Monitoring of internet and local apps
Exec=env APPIMAGE_EXTRACT_AND_RUN=1 $BIN_DIR/Monitor.AppImage %U
Icon=monitor
Terminal=false
Type=Application
Categories=Network;Monitor;
StartupWMClass=monitor
DESKTOP
chmod +x "$APPS_DIR/monitor.desktop"

DESKTOP_DIR=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
if [ -d "$DESKTOP_DIR" ]; then
  cp "$APPS_DIR/monitor.desktop" "$DESKTOP_DIR/monitor.desktop"
  chmod +x "$DESKTOP_DIR/monitor.desktop"
  gio set "$DESKTOP_DIR/monitor.desktop" metadata::trusted true 2>/dev/null || true
fi
update-desktop-database "$APPS_DIR" 2>/dev/null || true
echo "Installed: $BIN_DIR/Monitor.AppImage, shortcut in app menu and on desktop"
