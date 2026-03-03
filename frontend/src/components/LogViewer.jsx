import { useEffect, useRef, useState } from 'react'
import { streamJobLogs } from '../services/websocket'
import clsx from 'clsx'

/**
 * Panel latéral glissant affichant les logs Ansible en temps réel.
 * Props:
 *   open    : boolean
 *   jobId   : string  — id du job Celery/ansible
 *   title   : string
 *   onClose : () => void
 */
export default function LogViewer({ open, jobId, title, onClose }) {
  const [lines, setLines]   = useState([])
  const [done, setDone]     = useState(false)
  const [copied, setCopied] = useState(false)
  const bottomRef           = useRef(null)
  const closeWsRef          = useRef(null)

  // Reset + connect when jobId changes
  useEffect(() => {
    if (!open || !jobId) return
    setLines([])
    setDone(false)

    closeWsRef.current = streamJobLogs(jobId, {
      onLine:  (line) => setLines(prev => [...prev, line]),
      onDone:  ()     => setDone(true),
      onError: (err)  => setLines(prev => [...prev, `[ERREUR] ${err}`]),
    })

    return () => closeWsRef.current?.()
  }, [open, jobId])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const handleCopy = () => {
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={clsx(
        'fixed top-0 right-0 h-full w-full max-w-lg bg-gray-950 z-50',
        'flex flex-col shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <span className={clsx(
              'w-2 h-2 rounded-full',
              done ? 'bg-green-400' : 'bg-blue-400 animate-pulse'
            )} />
            <span className="text-sm font-medium text-gray-200 truncate">{title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800 transition-colors"
            >
              {copied ? '✓ Copié' : 'Copier'}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-xl leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
          {lines.length === 0 && !done && (
            <span className="text-gray-500">En attente des logs...</span>
          )}
          {lines.map((line, i) => (
            <div key={i} className={clsx(
              'whitespace-pre-wrap break-all',
              line.includes('fatal') || line.includes('FAILED') || line.includes('[ERREUR]')
                ? 'text-red-400'
                : line.includes('ok:') || line.includes('SUCCESS')
                ? 'text-green-400'
                : line.includes('changed:')
                ? 'text-yellow-400'
                : line.startsWith('PLAY') || line.startsWith('TASK')
                ? 'text-blue-300 font-medium'
                : 'text-gray-300'
            )}>
              {line}
            </div>
          ))}
          {done && (
            <div className="mt-3 text-green-400 font-medium">
              ✓ Terminé
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-500">
          {lines.length} ligne{lines.length !== 1 ? 's' : ''}
          {!done && ' · streaming...'}
        </div>
      </div>
    </>
  )
}
