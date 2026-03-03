import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getProjects, getDeployments, triggerDeployment } from '../services/api'
import StatusBadge from '../components/StatusBadge'
import LogViewer from '../components/LogViewer'

const COMPONENTS = [
  { id: 'application', label: 'Application' },
  { id: 'nginx',       label: 'Nginx (vhost)' },
  { id: 'database',    label: 'Base de données' },
  { id: 'systemd',     label: 'Service systemd' },
]

export default function Deploy() {
  const [searchParams] = useSearchParams()
  const [projects, setProjects]   = useState([])
  const [history, setHistory]     = useState([])
  const [logPanel, setLogPanel]   = useState({ open: false, jobId: null, title: '' })
  const [loading, setLoading]     = useState(false)
  const [form, setForm] = useState({
    project_id: searchParams.get('project') ?? '',
    target_host: '',
    target_ssh_user: 'root',
    target_environment: 'production',
    components: ['application', 'nginx'],
  })

  useEffect(() => {
    getProjects({ per_page: 100 }).then(r => setProjects(r.data.items)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.project_id) return
    getDeployments(form.project_id, { per_page: 10 }).then(r => setHistory(r.data.items)).catch(() => {})
  }, [form.project_id])

  const toggleComponent = (id) => {
    setForm(f => ({
      ...f,
      components: f.components.includes(id)
        ? f.components.filter(c => c !== id)
        : [...f.components, id]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.project_id) return toast.error('Sélectionnez un projet')
    if (!form.target_host) return toast.error('Saisissez l\'IP cible')
    setLoading(true)
    try {
      const { data } = await triggerDeployment(form.project_id, {
        target_host:        form.target_host,
        target_ssh_user:    form.target_ssh_user,
        target_environment: form.target_environment,
        components:         form.components,
      })
      const project = projects.find(p => +p.id === +form.project_id)
      toast.success('Déploiement lancé')
      setLogPanel({ open: true, jobId: data.job_id, title: `Déploiement — ${project?.name} → ${form.target_host}` })
      // Refresh history
      getDeployments(form.project_id, { per_page: 10 }).then(r => setHistory(r.data.items)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Erreur lors du déploiement')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Déployer un projet</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Formulaire */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Projet <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.project_id}
                onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Sélectionner un projet...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.environment})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                IP du serveur cible <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.target_host}
                onChange={e => setForm(f => ({ ...f, target_host: e.target.value }))}
                placeholder="10.0.0.5"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur SSH</label>
                <input
                  value={form.target_ssh_user}
                  onChange={e => setForm(f => ({ ...f, target_ssh_user: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Environnement cible</label>
                <select
                  value={form.target_environment}
                  onChange={e => setForm(f => ({ ...f, target_environment: e.target.value }))}
                  className={inputClass}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Développement</option>
                </select>
              </div>
            </div>

            {/* Composants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Composants à déployer</label>
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTS.map(c => (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.components.includes(c.id)
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded accent-brand-600"
                      checked={form.components.includes(c.id)}
                      onChange={() => toggleComponent(c.id)}
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Avertissement prod */}
            {form.target_environment === 'production' && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span>⚠️</span>
                <span>Vous déployez vers l'environnement de <strong>production</strong>. Un rollback automatique sera effectué en cas d'échec.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {loading ? 'Lancement en cours...' : '🚀 Lancer le déploiement'}
            </button>
          </form>
        </div>

        {/* Historique */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">Historique</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {history.length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">
                  {form.project_id ? 'Aucun déploiement' : 'Sélectionnez un projet'}
                </p>
              )}
              {history.map(d => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-500">{d.target_host}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(d.created_at).toLocaleString('fr-FR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
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
