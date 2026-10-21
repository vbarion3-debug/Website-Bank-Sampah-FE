export const API_BASE_URL = import.meta.env.VITE_API_URL

const ADMIN_TOKEN_KEY = 'admin_session_token'

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || ''
export const setAdminToken = (token) => localStorage.setItem(ADMIN_TOKEN_KEY, token)

// Diperbarui: Menambahkan penghapusan 'admin_nama'
export const clearAdminToken = () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem('admin_username')
  localStorage.removeItem('admin_nama')
}

export const getAdminUsername = () => localStorage.getItem('admin_username') || ''
export const setAdminUsername = (username) => localStorage.setItem('admin_username', username)

// Tambahan: Getter dan setter untuk admin_nama
export const getAdminName = () => localStorage.getItem('admin_nama') || ''
export const setAdminName = (nama) => localStorage.setItem('admin_nama', nama)

// Tambahan: Helper untuk format URL file
export const getFileUrl = (path) => {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return `${API_BASE_URL}${path}`
}

export const getAuthHeaders = () => {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const API = {
  jenisSampah: `${API_BASE_URL}/jenis-sampah/`,
  createJenisSampah: `${API_BASE_URL}/jenis-sampah/create`,
  updateJenisSampah: (id) => `${API_BASE_URL}/jenis-sampah/${id}`,
  deleteJenisSampah: (id) => `${API_BASE_URL}/jenis-sampah/${id}`,

  transaksiCreate: `${API_BASE_URL}/transaksi/create`,
  transaksiCreateManual: `${API_BASE_URL}/transaksi/create-manual`,
  transaksiHistory: `${API_BASE_URL}/transaksi/history-admin`,
  // Tambahan: Endpoint transaksi baru
  transaksiDetail: (id) => `${API_BASE_URL}/transaksi/${id}`,
  transaksiItem: (idTransaksi, idDetail) => `${API_BASE_URL}/transaksi/${idTransaksi}/detail/${idDetail}`,
  transaksiItemAdd: (idTransaksi) => `${API_BASE_URL}/transaksi/${idTransaksi}/detail`,

  nasabah: `${API_BASE_URL}/admin/nasabah/`,
  nasabahSearch: (search) =>
    `${API_BASE_URL}/admin/nasabah/?search=${encodeURIComponent(search)}`,
  nasabahDetail: (nik) => `${API_BASE_URL}/admin/nasabah/${nik}`,
  nasabahUpdate: (nik) => `${API_BASE_URL}/admin/nasabah/${nik}`,
  nasabahStatus: (nik) =>
    `${API_BASE_URL}/admin/nasabah/${nik}/status`,
  nasabahSaldo: (nik) =>
    `${API_BASE_URL}/admin/nasabah/${nik}/saldo`,
  nasabahSaldoHistory: (nik) =>
    `${API_BASE_URL}/admin/nasabah/${nik}/saldo/riwayat`,

  mitra: `${API_BASE_URL}/mitra-pengepul/`,
  mitraCreate: `${API_BASE_URL}/mitra-pengepul/create`,
  mitraDetail: (id) => `${API_BASE_URL}/mitra-pengepul/${id}`,
  mitraHarga: (id) => `${API_BASE_URL}/mitra-pengepul/${id}/harga`,
  transaksiJualMitra: `${API_BASE_URL}/transaksi-jual-mitra/create`,

  pengumuman: `${API_BASE_URL}/pengumuman/`,
  pengumumanCreate: `${API_BASE_URL}/pengumuman/create`,
  pengumumanDetail: (id) => `${API_BASE_URL}/pengumuman/${id}`,

  // AUTH
  adminLogin: `${API_BASE_URL}/auth/admin/login`,
  adminVerifyOtp: `${API_BASE_URL}/auth/admin/verify-otp`,
  adminLogout: `${API_BASE_URL}/auth/admin/logout`,

  // ------------------KELOLA AKUN ADMIN (khusus super admin)------------------
  kelolaAdminList: `${API_BASE_URL}/admin/list-admin`,
  kelolaAdminSearch: (search) =>
    `${API_BASE_URL}/admin/list-admin?search=${encodeURIComponent(search)}`,
  kelolaAdminCreate: `${API_BASE_URL}/admin/create-admin`,
  kelolaAdminEdit: (id) => `${API_BASE_URL}/admin/edit-admin/${id}`,
  kelolaAdminStatus: (id) => `${API_BASE_URL}/admin/status-admin/${id}`,
  kelolaAdminDelete: (id) => `${API_BASE_URL}/admin/delete-admin/${id}`,

  superAdminLogin: `${API_BASE_URL}/auth/super-admin/login`,
  superAdminVerifyOtp: `${API_BASE_URL}/auth/super-admin/verify-otp`,
  superAdminLogout: `${API_BASE_URL}/auth/super-admin/logout`,
  // ---------------------------------------------------------------------------


  chatConversations: `${API_BASE_URL}/chat/conversations`,
  chatClaim: (nik) => `${API_BASE_URL}/chat/claim/${nik}`,
  chatRelease: (nik) => `${API_BASE_URL}/chat/release/${nik}`,

  penarikanAdmin: `${API_BASE_URL}/admin/penarikan/`,
  penarikanAdminBukti: (id) => `${API_BASE_URL}/admin/penarikan/${id}/bukti`,
  penarikanAdminSelesai: (id) => `${API_BASE_URL}/admin/penarikan/${id}/selesai`,
  penarikanAdminTolak: (id) => `${API_BASE_URL}/admin/penarikan/${id}/tolak`,

  transaksiJualMitraList: `${API_BASE_URL}/transaksi-jual-mitra/`,
  transaksiJualMitraByMitra: (id) => `${API_BASE_URL}/transaksi-jual-mitra/mitra/${id}`,

  transaksiJualMitraLaporan: `${API_BASE_URL}/transaksi-jual-mitra/laporan`,
  transaksiJualMitraExport: `${API_BASE_URL}/transaksi-jual-mitra/laporan/export`,
  transaksiJualMitraStok: `${API_BASE_URL}/transaksi-jual-mitra/stok`,
}

export async function parseResponse(response) {
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const message = data?.message || data?.error || data?.detail || 'Permintaan ke server gagal.'
    throw new Error(message)
  }
  return data
}

export const chatHistory = (nik) => `${API_BASE_URL}/chat/history/${nik}`

export const chatWsUrl = (nik, token) => {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws')
  return `${wsBase}/chat/ws/admin/${nik}?token=${encodeURIComponent(token)}`
}