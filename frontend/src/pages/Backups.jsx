import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getProjects, getBackups, triggerBackup, restoreBackup } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import LogViewer from '../components/LogViewer'

export default function Backups() {
  const [projects, setProjects] = useState([])
  const [backups, setBackups]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [filter, setFilter]     = useState({ project_id: '', status: '', page: 1 })
  const [logPanel, setLogPanel] = useState({ open: false, jobId: null, title: '' })

  useEffect(() => {
    getProjects({ per_page: 100 }).then(r => setProjects(r.data.items)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!filter.project_id) { setBackups([]); setTotal(0); return }
    setLoading(true)
    const params = { page: filter.page, per_page: 20 }
    if (filter.status) params.status = filter.status
    getBackups(filter.project_id, params)
      .then(r => { setBackups(r.data.items); setTotal(r.data.total) })
      .catch(() => toast.error('Erreur chargement backups'))
      .finally(() => setLoading(false))
  }, [filter])

  const handleBackup = async () => {
    if (!filter.project_id) return toast.error('Sélectionnez un projet')
    try {
      const { data } = await triggerBackup(filter.project_id)
      const project = projects.find(p => +p.id === +filter.project_id)
      toast.success('Backup lancé')
      setLogPanel({ open: true, jobId: data.job_id, title: `Backup — ${project?.name}` })
    } catch { toast.error('Erreur lors du backup') }
  }

  const handleRestore = async (backup) => {
    if (!confirm('Restaurer ce backup ? L\'état actuel du serveur sera écrasé.')) return
    try {
      const { data } = await restoreBackup(filter.project_id, backup.id)
      const project = projects.find(p => +p.id === +filter.project_id)
      toast.success('Restauration lancée')
      setLogPanel({ open: true, jobId: data.job_id, title: `Restauration — ${project?.name}` })
    } catch { toast.error('Erreur lors de la restauration') }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Backups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historique et gestion des sauvegardes</p>
        </div>
        <button
          onClick={handleBackup}
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          💾 Nouveau backup
        </button>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filter.project_id}
          onChange={e => setFilter(f => ({ ...f, project_id: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Sélectionner un projet...</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Tous les statuts</option>
          <option value="success">Succès</option>
          <option value="failed">Échec</option>
          <option value="running">En cours</option>
          <option value="pending">En attente</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Taille</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Stockage</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Checksum</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Durée</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!filter.project_id && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                  Sélectionnez un projet pour voir ses backups
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">Chargement...</td>
              </tr>
            )}
            {!loading && filter.project_id && backups.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">Aucun backup pour ce projet</td>
              </tr>
            )}
            {backups.map(b => {
              const duration = b.finished_at
                ? Math.round((new Date(b.finished_at) - new Date(b.created_at)) / 1000)
                : null
              return (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-700">
                    {new Date(b.created_at).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {b.size_mb ? `${b.size_mb} Mo` : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{b.storage_server ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                    {b.checksum ? b.checksum.slice(0, 10) + '…' : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {duration != null ? `${duration}s` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'success' && (
                      <button
                        onClick={() => handleRestore(b)}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        Restaurer
                      </button>
                    )}
                    {b.error_message && (
                      <span title={b.error_message} className="text-xs text-red-400 cursor-help">⚠ Erreur</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Page {filter.page} · {total} résultats</span>
            <div className="flex gap-1">
              <button
                disabled={filter.page === 1}
                onClick={() => setFilter(f => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                ← Préc.
              </button>
              <button
                disabled={filter.page * 20 >= total}
                onClick={() => setFilter(f => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Suiv. →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log panel */}
      <LogViewer
        open={logPanel.open}
        jobId={logPanel.jobId}
        title={logPanel.title}
        onClose={() => setLogPanel(p => ({ ...p, open: false }))}
      />
    </div>
  )
}
