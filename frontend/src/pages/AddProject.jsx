import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createProject } from '../services/api'

const TECH_STACKS = ['nodejs', 'php', 'python', 'ruby', 'java', 'go', 'static', 'other']
const ENVIRONMENTS = ['production', 'staging', 'development']

export default function AddProject() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', domain: '', server_ip: '',
    tech_stack: 'nodejs', environment: 'production',
    ssh_user: 'root', ssh_port: 22,
    deploy_method: 'git',
    git_repo: '',
    git_branch: 'main',
    deploy_archive_url: ''
  })

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.deploy_method === 'git' && !form.git_repo.trim()) {
      return toast.error('URL du repo Git obligatoire')
    }
    if (form.deploy_method === 'archive' && !form.deploy_archive_url.trim()) {
      return toast.error("URL de l'archive obligatoire")
    }
    setLoading(true)
    try {
      const {
        deploy_method,
        git_repo,
        git_branch,
        deploy_archive_url,
        ...baseProject
      } = form

      const ansible_extra_vars = {
        deploy_method,
        ...(deploy_method === 'git'
          ? { git_repo: git_repo.trim(), git_branch: (git_branch || 'main').trim() }
          : { deploy_archive_url: deploy_archive_url.trim() })
      }

      const { data } = await createProject({
        ...baseProject,
        ssh_port: +baseProject.ssh_port,
        ansible_extra_vars
      })
      toast.success(`Projet "${data.name}" créé`)
      navigate(`/projects/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, children, required }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-brand-600">Projets</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Nouveau projet</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Ajouter un projet</h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section : Informations générales */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informations générales</h2>
            <div className="space-y-4">
              <Field label="Nom du projet" required>
                <input required value={form.name} onChange={set('name')} placeholder="mon-projet" className={inputClass} />
              </Field>
              <Field label="Description">
                <textarea rows={2} value={form.description} onChange={set('description')} placeholder="Description optionnelle..." className={inputClass} />
              </Field>
              <Field label="Domaine principal" required>
                <input required value={form.domain} onChange={set('domain')} placeholder="mon-site.fr" className={inputClass} />
              </Field>
            </div>
          </div>

          {/* Section : Serveur */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Serveur</h2>
            <div className="space-y-4">
              <Field label="Adresse IP du serveur" required>
                <input required value={form.server_ip} onChange={set('server_ip')} placeholder="192.168.1.10" className={inputClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Utilisateur SSH" required>
                  <input required value={form.ssh_user} onChange={set('ssh_user')} placeholder="root" className={inputClass} />
                </Field>
                <Field label="Port SSH">
                  <input type="number" value={form.ssh_port} onChange={set('ssh_port')} className={inputClass} />
                </Field>
              </div>
            </div>
          </div>

          {/* Section : Configuration */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Stack technique" required>
                <select required value={form.tech_stack} onChange={set('tech_stack')} className={inputClass}>
                  {TECH_STACKS.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Environnement" required>
                <select required value={form.environment} onChange={set('environment')} className={inputClass}>
                  {ENVIRONMENTS.map(e => (
                    <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {/* Section : Source du code */}
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Source du code</h2>
            <div className="space-y-4">
              <Field label="Methode de deploiement" required>
                <select required value={form.deploy_method} onChange={set('deploy_method')} className={inputClass}>
                  <option value="git">Git</option>
                  <option value="archive">Archive</option>
                </select>
              </Field>

              {form.deploy_method === 'git' && (
                <>
                  <Field label="Repository Git" required>
                    <input
                      required
                      value={form.git_repo}
                      onChange={set('git_repo')}
                      placeholder="git@github.com:org/projet.git"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Branche">
                    <input
                      value={form.git_branch}
                      onChange={set('git_branch')}
                      placeholder="main"
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              {form.deploy_method === 'archive' && (
                <Field label="URL de l'archive" required>
                  <input
                    required
                    value={form.deploy_archive_url}
                    onChange={set('deploy_archive_url')}
                    placeholder="https://exemple.com/build.tar.gz"
                    className={inputClass}
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
              Annuler
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Création...' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
