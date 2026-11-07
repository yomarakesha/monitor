import { Menu, Tray, nativeImage, type NativeImage } from 'electron'
import * as monitor from './monitor'
import type { State } from '../shared/types'

type Color = 'green' | 'yellow' | 'red' | 'gray'

const RGB: Record<Color, [number, number, number]> = {
  green: [46, 204, 113],
  yellow: [240, 180, 41],
  red: [255, 92, 92],
  gray: [139, 147, 163]
}

const SIZE = 32
const icons = new Map<Color, NativeImage>()
// Last non-"checking" state per app, so the icon does not flicker during every check.
const lastKnown = new Map<string, State>()
let tray: Tray | null = null
let current: Color | null = null

// Anti-aliased filled circle as a raw BGRA bitmap, rendered at 2x for HiDPI trays.
function circle(color: Color): NativeImage {
  const cached = icons.get(color)
  if (cached) return cached
  const [r, g, b] = RGB[color]
  const buf = Buffer.alloc(SIZE * SIZE * 4)
  const c = (SIZE - 1) / 2
  const radius = SIZE / 2 - 2
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const alpha = Math.max(0, Math.min(1, radius - Math.hypot(x - c, y - c) + 0.5))
      const i = (y * SIZE + x) * 4
      buf[i] = Math.round(b * alpha)
      buf[i + 1] = Math.round(g * alpha)
      buf[i + 2] = Math.round(r * alpha)
      buf[i + 3] = Math.round(255 * alpha)
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: SIZE, height: SIZE, scaleFactor: 2 })
  icons.set(color, img)
  return img
}

export function update(): void {
  if (!tray) return
  const statuses = monitor.allStatuses()
  const live = new Set(statuses.map((s) => s.id))
  for (const id of lastKnown.keys()) if (!live.has(id)) lastKnown.delete(id)
  for (const s of statuses) if (s.state !== 'checking') lastKnown.set(s.id, s.state)

  const states = [...lastKnown.values()]
  const down = states.filter((s) => s === 'down').length
  const slow = states.filter((s) => s === 'slow').length
  const color: Color = down ? 'red' : slow ? 'yellow' : states.length ? 'green' : 'gray'
  if (color !== current) {
    tray.setImage(circle(color))
    current = color
  }
  const parts = [down && `${down} down`, slow && `${slow} slow`].filter(Boolean)
  tray.setToolTip(`Monitor — ${parts.length ? parts.join(', ') : states.length ? 'всё работает' : 'нет данных'}`)
}

export function create(actions: { show: () => void; checkAll: () => void; quit: () => void }): void {
  tray = new Tray(circle('gray'))
  current = 'gray'
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Показать', click: actions.show },
      { label: 'Проверить все', click: actions.checkAll },
      { type: 'separator' },
      { label: 'Выход', click: actions.quit }
    ])
  )
  tray.on('click', actions.show)
  monitor.onStatus(update)
  update()
}
