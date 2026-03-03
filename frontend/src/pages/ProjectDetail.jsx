import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getProject, getDNSRecords, createDNSRecord, deleteDNSRecord, applyDNS,
  getBackups, triggerBackup
} from '../services/api'
import StatusBadge from '../components/StatusBadge'
import Modal from '../components/Modal'
import LogViewer from '../components/LogViewer'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject]     = useState(null)
  const [dns, setDns]             = useState([])
  const [backups, setBackups]     = useState([])
  const [tab, setTab]             = useState('overview')
  const [dnsModal, setDnsModal]   = useState(false)
  const [newDns, setNewDns]       = useState({ record_type: 'A', name: '', value: '', ttl: 3600 })
  const [logPanel, setLogPanel]   = useState({ open: false, jobId: null, title: '' })
  const [selectedDns, setSelectedDns] = useState([])

  useEffect(() => {
    getProject(id).then(r => setProject(r.data)).catch(() => toast.error('Projet introuvable'))
    getDNSRecords(id).then(r => setDns(r.data)).catch(() => {})
    getBackups(id, { per_page: 10 }).then(r => setBackups(r.data.items)).catch(() => {})
  }, [id])

  const handleBackup = async () => {
    try {
      const { data } = await triggerBackup(id)
      toast.success('Backup lancé')
      setLogPanel({ open: true, jobId: data.job_id, title: `Backup — ${project.name}` })
    } catch { toast.error('Erreur backup') }
  }

  const handleAddDns = async (e) => {
    e.preventDefault()
    try {
      const { data } = await createDNSRecord(id, newDns)
      setDns(prev => [...prev, data])
      setDnsModal(false)
      setNewDns({ record_type: 'A', name: '', value: '', ttl: 3600 })
      toast.success('Enregistrement DNS ajouté')
    } catch { toast.error('Erreur ajout DNS') }
  }

  const handleDeleteDns = async (rid) => {
    try {
      await deleteDNSRecord(id, rid)
      setDns(prev => prev.filter(r => r.id !== rid))
      toast.success('Enregistrement supprimé')
    } catch { toast.error('Erreur suppression DNS') }
  }

  const handleApplyDns = async () => {
    const ids = selectedDns.length > 0 ? selectedDns : dns.map(r => r.id)
    try {
      const { data } = await applyDNS(id, ids)
      toast.success('Application DNS en cours...')
      setLogPanel({ open: true, jobId: data.job_id, title: `DNS — ${project?.name}` })
    } catch { toast.error('Erreur application DNS') }
  }

  if (!project) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Chargement...</div>
  )

  const tabs = ['overview', 'dns', 'backups']

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-brand-600">Projets</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{project.name}</span>
      </div>

      {/* Hero */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{project.domain}</p>
            <div className="flex items-center gap-2 mt-3">
              <StatusBadge status={project.environment} />
              {project.last_deploy_status && <StatusBadge status={project.last_deploy_status} />}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBackup}
              className="flex items-center gap-1.5 text-sm border border-gray-200 hover:border-brand-300 hover:text-brand-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              💾 Backup
            </button>
            <button
              onClick={() => navigate(`/deploy?project=${id}`)}
              className="flex items-center gap-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              🚀 Déployer
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          {[
            ['Serveur', project.server_ip],
            ['Stack', project.tech_stack],
            ['SSH user', project.ssh_user],
            ['Port SSH', project.ssh_port],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">{k}</dt>
              <dd className="text-sm font-medium text-gray-700 mt-0.5 font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'Aperçu' : t === 'dns' ? 'DNS' : 'Backups'}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Derniers backups</h3>
            {backups.length === 0
              ? <p className="text-sm text-gray-400">Aucun backup disponible</p>
              : backups.slice(0, 5).map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="text-sm text-gray-600">{new Date(b.created_at).toLocaleString('fr-FR')}</div>
                  <div className="flex items-center gap-3">
                    {b.size_mb && <span className="text-xs text-gray-400">{b.size_mb} Mo</span>}
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Tab: DNS */}
      {tab === 'dns' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Enregistrements DNS</h3>
            <div className="flex gap-2">
              {dns.length > 0 && (
                <button
                  onClick={handleApplyDns}
                  className="text-xs text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Appliquer via Ansible
                </button>
              )}
              <button
                onClick={() => setDnsModal(true)}
                className="text-xs border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Type', 'Nom', 'Valeur', 'TTL', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dns.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun enregistrement DNS</td></tr>
              )}
              {dns.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5"><span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.record_type}</span></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.value}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.ttl}s</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => handleDeleteDns(r.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Backups */}
      {tab === 'backups' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-700">Historique des backups</h3>
            <button onClick={handleBackup} className="text-xs text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg">
              💾 Nouveau backup
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Date', 'Taille', 'Statut', 'Checksum', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {backups.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Aucun backup</td></tr>
              )}
              {backups.map(b => (
                <tr key={b.id}>
                  <td className="px-4 py-2.5 text-gray-700">{new Date(b.created_at).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{b.size_mb ? `${b.size_mb} Mo` : '—'}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400 truncate max-w-32">{b.checksum ? b.checksum.slice(0, 12) + '…' : '—'}</td>
                  <td className="px-4 py-2.5">
                    {b.status === 'success' && (
                      <button className="text-xs text-brand-600 hover:underline">Restaurer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal ajout DNS */}
      <Modal open={dnsModal} onClose={() => setDnsModal(false)} title="Ajouter un enregistrement DNS" size="sm">
        <form onSubmit={handleAddDns} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={newDns.record_type}
                onChange={e => setNewDns(n => ({ ...n, record_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">TTL (secondes)</label>
              <input
                type="number"
                value={newDns.ttl}
                onChange={e => setNewDns(n => ({ ...n, ttl: +e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom (@ = racine)</label>
            <input
              required
              value={newDns.name}
              onChange={e => setNewDns(n => ({ ...n, name: e.target.value }))}
              placeholder="@ ou www"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valeur</label>
            <input
              required
              value={newDns.value}
              onChange={e => setNewDns(n => ({ ...n, value: e.target.value }))}
              placeholder="1.2.3.4"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDnsModal(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Annuler</button>
            <button type="submit" className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg">Ajouter</button>
          </div>
        </form>
      </Modal>

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
