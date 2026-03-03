import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { isAuthenticated } from './services/auth'
import { getMe } from './services/api'

import Navbar       from './components/Navbar'
import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import AddProject   from './pages/AddProject'
import Backups      from './pages/Backups'
import Deploy       from './pages/Deploy'

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [user, setUser] = useState(null)
  const location = useLocation()
  const isLogin  = location.pathname === '/login'

  useEffect(() => {
    if (!isAuthenticated()) return
    getMe().then(r => setUser(r.data)).catch(() => {})
  }, [location.pathname])

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

      {!isLogin && isAuthenticated() && <Navbar user={user} />}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        <Route path="/projects/new" element={
          <PrivateRoute><AddProject /></PrivateRoute>
        } />
        <Route path="/projects/:id" element={
          <PrivateRoute><ProjectDetail /></PrivateRoute>
        } />
        <Route path="/backups" element={
          <PrivateRoute><Backups /></PrivateRoute>
        } />
        <Route path="/deploy" element={
          <PrivateRoute><Deploy /></PrivateRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
