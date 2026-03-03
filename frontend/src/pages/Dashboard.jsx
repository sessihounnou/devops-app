import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProjects, deleteProject, triggerBackup } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import LogViewer from '../components/LogViewer'

const TECH_ICONS = {
  nodejs: '🟩', php: '🐘', python: '🐍',
  ruby: '💎', java: '☕', go: '🔵', static: '📄', other: '⚙️'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState({ environment: '', search: '', page: 1 })
  const [logPanel, setLogPanel] = useState({ open: false, jobId: null, title: '' })

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const params = { page: filter.page, per_page: 20 }
      if (filter.environment) params.environment = filter.environment
      if (filter.search)      params.search = filter.search
      const { data } = await getProjects(params)
      setProjects(data.items)
      setTotal(data.total)
    } catch {
      toast.error('Erreur lors du chargement des projets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProjects() }, [filter])

  const handleBackup = async (project) => {
    try {
      const { data } = await triggerBackup(project.id)
      toast.success(`Backup lancé pour ${project.name}`)
      setLogPanel({ open: true, jobId: data.job_id, title: `Backup — ${project.name}` })
    } catch {
      toast.error('Erreur lors du lancement du backup')
    }
  }

  const handleDelete = async (project) => {
    if (!confirm(`Supprimer "${project.name}" ?`)) return
    try {
      await deleteProject(project.id)
      toast.success('Projet supprimé')
      fetchProjects()
    } catch {
      toast.error('Erreur lors de la suppression')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projets</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} projet{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          to="/projects/new"
          className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Nouveau projet
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Rechercher un projet..."
          value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <select
          value={filter.environment}
          onChange={e => setFilter(f => ({ ...f, environment: e.target.value, page: 1 }))}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Tous les environnements</option>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Développement</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Projet</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Env</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Serveur</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Stack</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Déploiement</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dernier backup</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && projects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="text-gray-400 text-sm">Aucun projet trouvé</div>
                  <Link to="/projects/new" className="text-brand-600 text-sm mt-1 inline-block hover:underline">
                    Ajouter le premier projet →
                  </Link>
                </td>
              </tr>
            )}
            {projects.map(p => (
              <tr
                key={p.id}
                className="hover:bg-gray-50/50 cursor-pointer"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.domain}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.environment} />
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.server_ip}</td>
                <td className="px-4 py-3 text-gray-600">
                  {TECH_ICONS[p.tech_stack]} {p.tech_stack}
                </td>
                <td className="px-4 py-3">
                  {p.last_deploy_status
                    ? <StatusBadge status={p.last_deploy_status} />
                    : <span className="text-gray-400 text-xs">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {p.last_backup_at
                    ? new Date(p.last_backup_at).toLocaleString('fr-FR')
                    : '—'
                  }
                </td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => handleBackup(p)}
                      title="Lancer un backup"
                      className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                    >
                      💾
                    </button>
                    <button
                      onClick={() => navigate(`/deploy?project=${p.id}`)}
                      title="Déployer"
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    >
                      🚀
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      title="Supprimer"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page {filter.page} · {total} résultats
            </span>
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
