const API_BASE_URL = import.meta.env.VITE_API_URL

export const API = {
  register: `${API_BASE_URL}/nasabah/register`,
  login: `${API_BASE_URL}/auth/nasabah/login`,
  profile: `${API_BASE_URL}/nasabah/profile`,
  logout: `${API_BASE_URL}/auth/nasabah/logout`,
  chatHistory: `${API_BASE_URL}/chat/history-nasabah`,
  // Endpoint khusus nasabah (bisa diakses token nasabah)
  pengumuman: `${API_BASE_URL}/pengumuman/nasabah/list`,
  jenisSampah: `${API_BASE_URL}/jenis-sampah/nasabah/list`,
  transaksiHistory: `${API_BASE_URL}/transaksi/history`,
  penarikanBase: `${API_BASE_URL}/penarikan`,
  penarikan: `${API_BASE_URL}/penarikan/ajukan`,
  penarikanHistory: `${API_BASE_URL}/penarikan/history`,
}

const NASABAH_TOKEN_KEY = 'nasabah_session_token'

export const getAccessToken = () => localStorage.getItem(NASABAH_TOKEN_KEY) || ''
export const setAccessToken = (token) => localStorage.setItem(NASABAH_TOKEN_KEY, token)
export const clearAccessToken = () => localStorage.removeItem(NASABAH_TOKEN_KEY)

export const getAuthHeaders = () => {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
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

export const chatWsUrl = (token) => {
  const wsBase = API_BASE_URL.replace(/^http/, 'ws')
  return `${wsBase}/chat/ws/nasabah?token=${encodeURIComponent(token)}`
}

// ======================================================
// HELPER DATA (pengumuman & harga sampah)
// ======================================================

// Backend menyimpan waktu WIB (UTC+7) tanpa penanda zona -> tambahkan "+07:00"
// supaya tampil benar di browser mana pun, bukan hanya yang berzona WIB.
export function parseDate(value) {
  if (!value) return new Date(0)
  const str = String(value)
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(str) ? str : `${str}+07:00`)
  return Number.isNaN(d.getTime()) ? new Date(0) : d
}

export function formatTanggal(value, withTime = true) {
  const d = parseDate(value)
  if (d.getTime() === 0) return '-'
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

async function getList(url) {
  const response = await fetch(url, { headers: getAuthHeaders() })
  const data = await parseResponse(response)
  return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
}

// Hanya pengumuman yang terbit (draft & arsip tidak ditampilkan ke nasabah), terbaru dulu.
export async function fetchActiveAnnouncements() {
  const list = await getList(API.pengumuman)
  return list
    .filter((a) => !a.status || a.status === 'terbit')
    .sort((a, b) => parseDate(b.tanggal_publikasi) - parseDate(a.tanggal_publikasi))
}

// Harga sampah terkini langsung dari tabel jenis_sampah.
export async function fetchHargaSampah() {
  const list = await getList(API.jenisSampah)
  return list.map((j) => ({
    id: j.id_jenis,
    nama: j.nama_jenis,
    kategori: j.kategori?.trim() || 'Lainnya',
    harga: Number(j.harga_per_kg) || 0,
  }))
}
