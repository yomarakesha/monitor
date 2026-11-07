# Monitor

Desktop dashboard (Electron + React) for watching internet and local web apps.

- **Internet Apps / Local Apps** tabs: board of cards with name, live status (UP/SLOW/DOWN, HTTP code, latency) and an embedded webview of the app. Search and status filter, "only down" toggle.
- **Управление** tab: add, edit and delete apps; import and export the list as JSON (duplicates by kind + URL are skipped).
- **Настройки** tab: close to tray, autostart, start hidden, notification channels.
- Checks are HTTP GETs every N seconds through the webview session. Per app:
  - optional health URL (the webview keeps showing the main URL) and exact expected HTTP code (default: any 2xx/3xx);
  - latency threshold for the yellow SLOW state;
  - consecutive failures before DOWN (retries);
  - webview auto-reload every N minutes.
- On UP↔DOWN: system notification, Telegram bot message, email via SMTP (each channel optional, "Тест" button for each).
- Tray icon colour shows overall status (green / yellow / red / gray). Secrets (bot token, SMTP password) are encrypted with the OS keychain (`safeStorage`).
- Window size and position are restored on start.
- Local apps may use self-signed HTTPS certificates; internet apps are verified strictly.
- Data lives in `~/.config/monitor/apps.json` and `~/.config/monitor/settings.json`. Autostart on Linux writes `~/.config/autostart/monitor.desktop`.

## Run

```bash
npm install
npm run dev          # development
npm run build:linux  # AppImage in dist/
```
