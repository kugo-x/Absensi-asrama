import { useEffect, useState } from 'react'
import type { CurrentUser } from './types'
import { clearAuthToken } from './api'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import FasilPage from './pages/FasilPage'
import PenghuniPage from './pages/PenghuniPage'

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const saved = localStorage.getItem('sip-asrama-user')
      return saved ? JSON.parse(saved) as CurrentUser : null
    } catch {
      return null
    }
  })

  const login = (user: CurrentUser) => {
    localStorage.setItem('sip-asrama-user', JSON.stringify(user))
    setCurrentUser(user)
  }

  const logout = () => {
    localStorage.removeItem('sip-asrama-user')
    clearAuthToken()
    setCurrentUser(null)
  }

  useEffect(() => {
    const handleExpired = () => logout()
    const handleProfileUpdated = () => {
      const saved = localStorage.getItem('sip-asrama-user')
      if (saved) setCurrentUser(JSON.parse(saved) as CurrentUser)
    }
    window.addEventListener('auth-expired', handleExpired)
    window.addEventListener('profile-updated', handleProfileUpdated)
    return () => {
      window.removeEventListener('auth-expired', handleExpired)
      window.removeEventListener('profile-updated', handleProfileUpdated)
    }
  })

  if (!currentUser) {
    return <LoginPage onLogin={login} />
  }

  if (currentUser.role === 'admin') {
    return <AdminPage user={currentUser} onLogout={logout} />
  }

  if (currentUser.role === 'fasil') {
    return <FasilPage user={currentUser} onLogout={logout} />
  }

  return <PenghuniPage user={currentUser} onLogout={logout} />
}
