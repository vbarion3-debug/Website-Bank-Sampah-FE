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

export default function App() {
  const [page, setPage] = useState(getAccessToken() ? 'dashboard' : 'welcome')
  const go = setPage

  if (page === 'welcome') return <Welcome onNavigate={go}/>
  if (page === 'register') return <Register onNavigate={go}/>
  if (page === 'login') return <Login onNavigate={go} onLoggedIn={()=>go('dashboard')}/>
  if (page === 'dashboard') return <Dashboard onNavigate={go} onLogout={()=>go('welcome')}/>
  if (page === 'pengumuman') return <Pengumuman onNavigate={go}/>
  if (page === 'harga') return <HargaSampah onNavigate={go}/>
  if (page === 'profile') return <Profile onNavigate={go} onLogout={()=>go('welcome')}/>
  if (page === 'withdraw') return <Placeholder type="withdraw" onNavigate={go}/>
  if (page === 'chat') return <LiveChat onNavigate={go}/>

  return <Welcome onNavigate={go}/>
}
