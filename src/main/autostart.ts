import { app } from 'electron'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Passed by the login item so the app starts minimized to the tray.
export const HIDDEN_ARG = '--hidden'

const linuxFile = () => join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'autostart', 'monitor.desktop')

// Inside an AppImage, process.execPath points into the temporary mount, so the image path is used.
function linuxExec(): string {
  const bin = process.env.APPIMAGE || process.execPath
  const args = app.isPackaged ? [] : [app.getAppPath()]
  const prefix = process.env.APPIMAGE ? 'env APPIMAGE_EXTRACT_AND_RUN=1 ' : ''
  return prefix + [bin, ...args, HIDDEN_ARG].map((a) => `"${a}"`).join(' ')
}

export function apply(enabled: boolean): void {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: enabled, args: [HIDDEN_ARG] })
    return
  }
  const file = linuxFile()
  if (!enabled) {
    if (existsSync(file)) unlinkSync(file)
    return
  }
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(
    file,
    ['[Desktop Entry]', 'Type=Application', 'Name=Monitor', `Exec=${linuxExec()}`, 'Icon=monitor', 'X-GNOME-Autostart-enabled=true', ''].join('\n')
  )
}
