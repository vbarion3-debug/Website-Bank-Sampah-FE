import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import SuperAdminRoute from './components/SuperAdminRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DatabaseNasabah from './pages/DatabaseNasabah'
import Pengumuman from './pages/Pengumuman'
import LiveChat from './pages/LiveChat'
import FormPengepul from './pages/FormPengepul'
import DatabasePengepul from './pages/DatabasePengepul'
import LaporanPengeluaran from './pages/LaporanPengeluaran'
import LaporanPemasukan from './pages/LaporanPemasukan'
import DatabaseSampah from './pages/DatabaseSampah'
import DatabaseAdmin from './pages/DatabaseAdmin'
import Penarikan from './pages/Penarikan'
import TransaksiPengepul from './pages/TransaksiPengepul'

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
        <Route path="/database-pengepul" element={<DatabasePengepul />} />
        <Route path="/database-pengepul/tambah" element={<FormPengepul />} />
        <Route path="/penarikan" element={<Penarikan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/laporan-pengeluaran" element={<LaporanPengeluaran />}/>
        <Route path="/laporan-pemasukan" element={<LaporanPemasukan />}/>
        <Route path="/database-sampah" element={<DatabaseSampah />} />
        <Route
          path="/database-admin"
          element={
            <SuperAdminRoute>
              <DatabaseAdmin />
            </SuperAdminRoute>
          }
        />
        <Route path="/transaksi-pengepul" element={<TransaksiPengepul />} />
      </Route>
    </Routes>
  )
}
