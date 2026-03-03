import { Link, NavLink, useNavigate } from 'react-router-dom'
import { clearTokens } from '../services/auth'

const navItems = [
  { to: '/',         label: 'Projets' },
  { to: '/backups',  label: 'Backups' },
  { to: '/deploy',   label: 'Déployer' },
]

export default function Navbar({ user }) {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearTokens()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-600 text-lg">
            <span className="text-xl">⚡</span>
            AnsibleFlow
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">{user.username}</span>
                {' '}·{' '}
                <span className="capitalize">{user.role}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Déconnexion
            </button>
          </div>

        </div>
      </div>
    </nav>
  )
}
