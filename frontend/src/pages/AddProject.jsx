import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createProject } from '../services/api'

const TECH_STACKS = ['nodejs', 'php', 'python', 'ruby', 'java', 'go', 'static', 'other']
const ENVIRONMENTS = ['production', 'staging', 'development']
const DEPLOY_PROFILES = [
  { id: 'git_app', label: 'Application Git classique' },
  { id: 'docker_compose', label: 'Application Docker/Compose existante' },
  { id: 'wordpress', label: 'WordPress (Docker)' },
]

export default function AddProject() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', domain: '', server_ip: '',
    tech_stack: 'nodejs', environment: 'production',
    deploy_profile: 'git_app',
    app_port: 3000,
    wordpress_app_port: 8080,
    ssh_user: 'root', ssh_port: 22,
    ssh_private_key: '',
    repo_url: '', repo_branch: 'main',
    env_file_content: '',
  })

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const isRepoRequired = form.deploy_profile === 'git_app' || form.deploy_profile === 'docker_compose'
    if (isRepoRequired && !form.repo_url.trim()) return toast.error('URL du repository Git obligatoire')
    if (!form.ssh_private_key.trim()) return toast.error('Clé SSH privée obligatoire')
    setLoading(true)
    try {
      const techStack = form.deploy_profile === 'wordpress' ? 'php' : form.tech_stack
      const ansibleExtraVars = {
        deploy_strategy: form.deploy_profile,
        deploy_method: 'git',
      }
      if (form.deploy_profile === 'docker_compose') {
        ansibleExtraVars.app_port = +form.app_port || 3000
      }
      if (form.deploy_profile === 'wordpress') {
        ansibleExtraVars.wordpress_app_port = +form.wordpress_app_port || 8080
      }

      const { data } = await createProject({
        ...form,
        tech_stack: techStack,
        ssh_port: +form.ssh_port,
        repo_url: form.repo_url.trim() || null,
        repo_branch: (form.repo_branch || 'main').trim(),
        ansible_extra_vars: ansibleExtraVars,
      })
      toast.success(`Projet "${data.name}" créé`)
      navigate(`/projects/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, children, required, hint }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
  const monoClass = inputClass + " font-mono text-xs"

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-brand-600">Projets</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Nouveau projet</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-6">Ajouter un projet</h1>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Informations générales ── */}
          <section>
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
          </section>

          {/* ── Serveur cible ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Serveur cible</h2>
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
              <Field
                label="Clé SSH privée"
                required
                hint="Collez ici la clé privée (-----BEGIN ... KEY-----) qui permet de se connecter à ce serveur."
              >
                <textarea
                  required
                  rows={6}
                  value={form.ssh_private_key}
                  onChange={set('ssh_private_key')}
                  placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1...\n-----END OPENSSH PRIVATE KEY-----"}
                  className={monoClass}
                />
              </Field>
            </div>
          </section>

          {/* ── Repository Git ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Profil de déploiement</h2>
            <Field label="Type de déploiement" required>
              <select required value={form.deploy_profile} onChange={set('deploy_profile')} className={inputClass}>
                {DEPLOY_PROFILES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
          </section>

          {/* ── Repository Git ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Repository Git</h2>
            <div className="space-y-4">
              <Field
                label="URL du repository"
                required
                hint="URL HTTPS ou SSH de votre repo GitHub. Ex : https://github.com/vous/projet ou git@github.com:vous/projet.git"
              >
                <input
                  required={form.deploy_profile !== 'wordpress'}
                  value={form.repo_url}
                  onChange={set('repo_url')}
                  placeholder="https://github.com/vous/mon-projet"
                  className={inputClass}
                />
              </Field>
              <Field label="Branche">
                <input value={form.repo_branch} onChange={set('repo_branch')} placeholder="main" className={inputClass} />
              </Field>
              {form.deploy_profile === 'docker_compose' && (
                <Field label="Port exposé par l'app Docker" hint="Port local sur le serveur vers lequel Nginx proxyfiera le domaine.">
                  <input type="number" min="1" max="65535" value={form.app_port} onChange={set('app_port')} className={inputClass} />
                </Field>
              )}
              {form.deploy_profile === 'wordpress' && (
                <Field label="Port WordPress (local serveur)" hint="WordPress sera démarré via docker-compose puis exposé derrière Nginx.">
                  <input type="number" min="1" max="65535" value={form.wordpress_app_port} onChange={set('wordpress_app_port')} className={inputClass} />
                </Field>
              )}
            </div>
          </section>

          {/* ── Configuration ── */}
          <section>
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
          </section>

          {/* ── Variables d'environnement ── */}
          <section>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Variables d'environnement</h2>
            <Field
              label="Fichier .env"
              hint="Collez ici le contenu complet de votre fichier .env. Il sera écrit sur le serveur avant chaque déploiement."
            >
              <textarea
                rows={8}
                value={form.env_file_content}
                onChange={set('env_file_content')}
                placeholder={"DATABASE_URL=postgresql://user:pass@localhost/db\nREDIS_URL=redis://localhost:6379\nSECRET_KEY=changeme\nDEBUG=false"}
                className={monoClass}
                spellCheck={false}
              />
            </Field>
            {form.env_file_content && (
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, env_file_content: '' }))}
                className="mt-1 text-xs text-gray-400 hover:text-red-500"
              >
                Effacer le .env
              </button>
            )}
          </section>

          {/* ── Actions ── */}
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
