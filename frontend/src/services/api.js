import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Attach JWT on every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          err.config.headers.Authorization = `Bearer ${data.access_token}`
          return api(err.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (username, password) => {
  const form = new FormData()
  form.append('username', username)
  form.append('password', password)
  return api.post('/auth/login', form)
}
export const getMe = () => api.get('/auth/me')

// ── Projects ──────────────────────────────────────────────────────────────────
export const getProjects = (params) => api.get('/projects', { params })
export const getProject  = (id)     => api.get(`/projects/${id}`)
export const createProject = (data) => api.post('/projects', data)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)
export const deleteProject = (id)   => api.delete(`/projects/${id}`)

// ── DNS ───────────────────────────────────────────────────────────────────────
export const getDNSRecords    = (pid)      => api.get(`/projects/${pid}/dns`)
export const createDNSRecord  = (pid, d)   => api.post(`/projects/${pid}/dns`, d)
export const updateDNSRecord  = (pid, rid, d) => api.put(`/projects/${pid}/dns/${rid}`, d)
export const deleteDNSRecord  = (pid, rid) => api.delete(`/projects/${pid}/dns/${rid}`)
export const applyDNS         = (pid, ids) => api.post(`/projects/${pid}/dns/apply`, ids)

// ── Backups ───────────────────────────────────────────────────────────────────
export const getBackups     = (pid, params) => api.get(`/projects/${pid}/backups`, { params })
export const triggerBackup  = (pid)         => api.post(`/projects/${pid}/backups`)
export const restoreBackup  = (pid, bid)    => api.post(`/projects/${pid}/backups/${bid}/restore`)

// ── Deployments ───────────────────────────────────────────────────────────────
export const getDeployments    = (pid, params) => api.get(`/projects/${pid}/deployments`, { params })
export const triggerDeployment = (pid, data)   => api.post(`/projects/${pid}/deployments`, data)

export default api
