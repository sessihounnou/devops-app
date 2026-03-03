export const saveTokens = ({ access_token, refresh_token }) => {
  localStorage.setItem('access_token', access_token)
  localStorage.setItem('refresh_token', refresh_token)
}

export const clearTokens = () => localStorage.clear()

export const isAuthenticated = () => !!localStorage.getItem('access_token')
