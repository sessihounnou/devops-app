/**
 * Ouvre un WebSocket vers /ws/jobs/{jobId}/logs
 * et appelle onLine(line) pour chaque ligne de log reçue.
 * Retourne une fonction close() pour fermer la connexion.
 */
export function streamJobLogs(jobId, { onLine, onDone, onError } = {}) {
  const token = localStorage.getItem('access_token')
  const proto  = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host   = window.location.host
  const url    = `${proto}://${host}/ws/jobs/${jobId}/logs?token=${token}`

  const ws = new WebSocket(url)

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'log')  onLine?.(msg.data)
      if (msg.type === 'done') { onDone?.(); ws.close() }
      if (msg.type === 'error') onError?.(msg.data)
    } catch { /* ignore */ }
  }

  ws.onerror = (e) => onError?.('WebSocket error')
  ws.onclose = ()  => onDone?.()

  return () => ws.readyState === WebSocket.OPEN && ws.close()
}
