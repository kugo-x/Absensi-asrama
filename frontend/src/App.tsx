import { useState } from 'react'
import type { CurrentUser } from './types'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import FasilPage from './pages/FasilPage'
import PenghuniPage from './pages/PenghuniPage'

export default function App() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />
  }

  if (currentUser.role === 'admin') {
    return <AdminPage user={currentUser} onLogout={() => setCurrentUser(null)} />
  }

  if (currentUser.role === 'fasil') {
    return <FasilPage user={currentUser} onLogout={() => setCurrentUser(null)} />
  }

  return <PenghuniPage user={currentUser} onLogout={() => setCurrentUser(null)} />
}
