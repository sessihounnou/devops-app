import clsx from 'clsx'

const variants = {
  // Deploy / backup status
  success:     'bg-green-100 text-green-800',
  failed:      'bg-red-100 text-red-800',
  running:     'bg-blue-100 text-blue-800 animate-pulse',
  pending:     'bg-yellow-100 text-yellow-800',
  rolled_back: 'bg-orange-100 text-orange-800',
  // Environments
  production:  'bg-red-100 text-red-700',
  staging:     'bg-yellow-100 text-yellow-700',
  development: 'bg-green-100 text-green-700',
}

const labels = {
  success:     'OK',
  failed:      'Échec',
  running:     'En cours',
  pending:     'En attente',
  rolled_back: 'Rollback',
  production:  'PROD',
  staging:     'STG',
  development: 'DEV',
}

export default function StatusBadge({ status, className }) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
      variants[status] ?? 'bg-gray-100 text-gray-600',
      className
    )}>
      {labels[status] ?? status}
    </span>
  )
}
