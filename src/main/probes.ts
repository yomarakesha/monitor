import { execFile } from 'child_process'
import { connect } from 'net'
import { parseTcpTarget, isValidHost } from '../shared/target'

// Resolves with the time to an established TCP connection; the socket is closed right away.
export function tcp(target: string, timeoutMs: number): Promise<number> {
  const parsed = parseTcpTarget(target)
  if (!parsed) return Promise.reject(new Error(`Неверный адрес TCP: ${target}`))
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const socket = connect({ host: parsed.host, port: parsed.port })
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      resolve(Date.now() - started)
      socket.destroy()
    })
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error('Timeout'))
    })
    socket.once('error', (err: NodeJS.ErrnoException) => {
      socket.destroy()
      reject(new Error(err.code ?? err.message))
    })
  })
}

// ICMP needs a raw socket, which an unprivileged process cannot open, so the system `ping`
// is used. Arguments go through execFile (no shell) and the host is validated first.
export function ping(host: string, timeoutMs: number): Promise<number> {
  if (!isValidHost(host)) return Promise.reject(new Error(`Неверный хост: ${host}`))
  const sec = Math.max(1, Math.round(timeoutMs / 1000))
  const args =
    process.platform === 'win32'
      ? ['-n', '1', '-w', String(sec * 1000), host]
      : process.platform === 'darwin'
        ? ['-c', '1', '-t', String(sec), host]
        : ['-c', '1', '-W', String(sec), host]
  return new Promise((resolve, reject) => {
    const started = Date.now()
    execFile('ping', args, { timeout: timeoutMs + 2000, windowsHide: true }, (err, stdout, stderr) => {
      // Windows ping exits 0 for "Destination host unreachable", so a reply is detected by its TTL.
      const replied = /ttl[=:]/i.test(stdout)
      if (err || !replied) {
        const line = (stderr + '\n' + stdout).split('\n').find((l) => /unreachable|недоступ|unknown|not known|could not find|100%/i.test(l))
        if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') return reject(new Error('Команда ping не найдена'))
        return reject(new Error(line?.trim() || 'Нет ответа'))
      }
      // "time=12.3 ms", "time<1ms", localized "время=12мс".
      const m = stdout.match(/[=<]\s*([\d.,]+)\s*(ms|мс)/i)
      resolve(m ? Math.round(Number(m[1].replace(',', '.'))) : Date.now() - started)
    })
  })
}
