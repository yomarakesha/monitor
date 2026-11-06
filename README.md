# Monitor

Desktop dashboard (Electron + React) for watching internet and local web apps.

- **Internet Apps / Local Apps** tabs: board of cards with name, live status (UP/DOWN, HTTP code, latency) and an embedded webview of the app.
- **Управление** tab: add, edit and delete apps (name, address, description, type, check interval).
- Status is an HTTP GET from the main process every N seconds; 2xx/3xx = UP.
- Local apps may use self-signed HTTPS certificates; internet apps are verified strictly.
- Data lives in `~/.config/monitor/apps.json`.

## Run

```bash
npm install
npm run dev          # development
npm run build:linux  # AppImage in dist/
```
