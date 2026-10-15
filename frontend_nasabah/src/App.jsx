import { useState } from 'react'
import { getAccessToken } from './api'
import Welcome from './pages/Welcome'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import LiveChat from './pages/LiveChat'
import Placeholder from './pages/Placeholder'
import Pengumuman from './pages/Pengumuman'
import HargaSampah from './pages/HargaSampah'
import History from './pages/History'

// Navbar di Placeholder.jsx (halaman Penarikan) memakai id "transaksi" & "penarikan",
// sedangkan BottomNav memakai "history" & "withdraw". Alias ini menyamakan keduanya.
const PAGE_ALIAS = {
  transaksi: 'history',
  penarikan: 'withdraw',
}

export default function App() {
  const [page, setPage] = useState(getAccessToken() ? 'dashboard' : 'welcome')
  const go = (target) => setPage(PAGE_ALIAS[target] ?? target)

  if (page === 'welcome') return <Welcome onNavigate={go}/>
  if (page === 'register') return <Register onNavigate={go}/>
  if (page === 'login') return <Login onNavigate={go} onLoggedIn={()=>go('dashboard')}/>
  if (page === 'dashboard') return <Dashboard onNavigate={go} onLogout={()=>go('welcome')}/>
  if (page === 'pengumuman') return <Pengumuman onNavigate={go}/>
  if (page === 'harga') return <HargaSampah onNavigate={go}/>
  if (page === 'history') return <History onNavigate={go}/>
  if (page === 'profile') return <Profile onNavigate={go} onLogout={()=>go('welcome')}/>
  if (page === 'withdraw') return <Placeholder type="withdraw" onNavigate={go}/>
  if (page === 'chat') return <LiveChat onNavigate={go}/>
  return <Welcome onNavigate={go}/>
}