# Monitor

Desktop dashboard (Electron + React) for watching internet and local web apps.

- **Internet Apps / Local Apps** tabs: board of cards with name, live status (UP/SLOW/DOWN, HTTP code, latency) and an embedded webview of the app. Search and status filter, "only down" toggle.
- **Управление** tab: add, edit and delete apps; import and export the list as JSON (duplicates by kind + URL are skipped).
- **Настройки** tab: close to tray, autostart, start hidden, notification channels.
- Check types: HTTP (GET through the webview session), TCP port (`host:port`, e.g. a database or Redis) and ping (system `ping` command). TCP and ping apps need no page URL; without one the card shows only the status.
- Per app:
  - HTTP only: optional health URL (the webview keeps showing the main URL) and exact expected HTTP code (default: any 2xx/3xx);
  - latency threshold for the yellow SLOW state;
  - consecutive failures before DOWN (retries);
  - webview auto-reload every N minutes.
- On UP↔DOWN: system notification, email via Gmail (sent from your address to itself) (each channel optional, "Тест" button for each).
- Tray icon colour shows overall status (green / yellow / red / gray). The Gmail app password is encrypted with the OS keychain (`safeStorage`).
- Window size and position are restored on start.
- History in SQLite (`~/.config/monitor/history.db`, built-in `node:sqlite`): uptime for 24 h / 7 d / 30 d on every card, "История" window with a response-time chart and an outage log. Checks are kept for 30 days, outages for 90.
- Local apps may use self-signed HTTPS certificates; internet apps are verified strictly.
- Data lives in `~/.config/monitor/apps.json` and `~/.config/monitor/settings.json`. Autostart on Linux writes `~/.config/autostart/monitor.desktop`.

## Run

```bash
npm install
npm run dev          # development
npm run build:linux  # AppImage in dist/
npm run build:win    # Windows installer + portable .exe in dist/ (run on Windows)
```

GitHub Actions (`.github/workflows/build-windows.yml`) builds the Windows `.exe` on every push to `main` and on manual run; download it from the run's artifacts. Pushing a `v*` tag also attaches the `.exe` files to a GitHub release.
