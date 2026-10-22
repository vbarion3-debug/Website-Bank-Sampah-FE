import { useCallback, useEffect, useState } from 'react'
import { getAccessToken } from './api'
import { NotifikasiProvider } from './notifikasi'
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
import Notifikasi from './pages/Notifikasi'

// Navbar di Placeholder.jsx (halaman Penarikan) memakai id "transaksi" & "penarikan",
// sedangkan BottomNav memakai "history" & "withdraw". Alias ini menyamakan keduanya.
const PAGE_ALIAS = {
  transaksi: 'history',
  penarikan: 'withdraw',
}

// Halaman yang bisa dibuka tanpa login (notifikasi tidak dipantau di sini)
const PUBLIC_PAGES = ['welcome', 'register', 'login']

export default function App() {
  const [page, setPage] = useState(getAccessToken() ? 'dashboard' : 'welcome')
  const go = useCallback((target) => setPage(PAGE_ALIAS[target] ?? target), [])

  // Sesi habis (backend balas 401) -> kembali ke halaman login, dari halaman mana pun
  useEffect(() => {
    const saatSesiHabis = () => setPage((p) => (PUBLIC_PAGES.includes(p) ? p : 'login'))
    window.addEventListener('nasabah:unauthorized', saatSesiHabis)
    return () => window.removeEventListener('nasabah:unauthorized', saatSesiHabis)
  }, [])

  let content
  if (page === 'register') content = <Register onNavigate={go}/>
  else if (page === 'login') content = <Login onNavigate={go} onLoggedIn={()=>go('dashboard')}/>
  else if (page === 'dashboard') content = <Dashboard onNavigate={go} onLogout={()=>go('welcome')}/>
  else if (page === 'pengumuman') content = <Pengumuman onNavigate={go}/>
  else if (page === 'notifikasi') content = <Notifikasi onNavigate={go}/>
  else if (page === 'harga') content = <HargaSampah onNavigate={go}/>
  else if (page === 'history') content = <History onNavigate={go}/>
  else if (page === 'profile') content = <Profile onNavigate={go} onLogout={()=>go('welcome')}/>
  else if (page === 'withdraw') content = <Placeholder type="withdraw" onNavigate={go}/>
  else if (page === 'chat') content = <LiveChat onNavigate={go}/>
  else content = <Welcome onNavigate={go}/>

  return (
    <NotifikasiProvider aktif={!PUBLIC_PAGES.includes(page)} onBuka={go}>
      {content}
    </NotifikasiProvider>
  )
}