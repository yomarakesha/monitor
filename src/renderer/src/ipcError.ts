// ipcRenderer.invoke wraps main-process errors as "Error invoking remote method 'x': Error: <message>".
export function ipcError(err: unknown): string {
  return String((err as Error)?.message ?? err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
