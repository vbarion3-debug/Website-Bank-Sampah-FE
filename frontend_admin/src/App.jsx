import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DatabaseNasabah from './pages/DatabaseNasabah'
import Pengumuman from './pages/Pengumuman'
import LiveChat from './pages/LiveChat'
import FormYayasan from './pages/FormYayasan'
import DatabaseYayasan from './pages/DatabaseYayasan'
import LaporanPengeluaran from './pages/LaporanPengeluaran'
import LaporanPemasukan from './pages/LaporanPemasukan'
import DatabaseSampah from './pages/DatabaseSampah'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/database-nasabah" element={<DatabaseNasabah />} />
        <Route path="/pengumuman" element={<Pengumuman />} />
        <Route path="/live-chat" element={<LiveChat />} />
        <Route path="/database-yayasan" element={<DatabaseYayasan />} />
        <Route path="/database-yayasan/tambah" element={<FormYayasan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/laporan-pengeluaran" element={<LaporanPengeluaran />}/>
        <Route path="/laporan-pemasukan" element={<LaporanPemasukan />}/>
        <Route path="/database-sampah" element={<DatabaseSampah />} />
      </Route>
    </Routes>
  )
}