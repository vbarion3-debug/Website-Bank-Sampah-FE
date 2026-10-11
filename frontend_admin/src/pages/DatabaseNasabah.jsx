import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye,
  Search,
  Loader2,
  RefreshCw,
  Pencil,
  UserCheck,
  UserX,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Phone,
  IdCard,
  Landmark,
  CalendarDays,
  Wallet,
  Save,
  Plus,
  Minus,
  History,
  ArrowRight,
} from 'lucide-react'

import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { API, getAuthHeaders } from '../api'

// ======================================================
// KONSTANTA & HELPER
// ======================================================

const PAGE_SIZE = 10
const PHONE_REGEX = /^(\+62|0)[0-9]{9,12}$/

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'inactive', label: 'Nonaktif' },
]

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

// Backend menyimpan waktu UTC tanpa penanda zona -> tambahkan "Z" agar tampil sesuai zona lokal
const formatDate = (value, withTime = false) => {
  if (!value) return '-'
  const str = String(value)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : `${str}Z`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

const getInitials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'

// FastAPI mengirim `detail` berupa string (HTTPException) atau array (validasi 422)
const extractError = (data) => {
  const d = data?.detail ?? data?.message ?? data?.error
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''
        return field ? `${field}: ${e.msg}` : e.msg
      })
      .join('; ')
  }
  if (typeof d === 'string') return d
  return 'Permintaan ke server gagal.'
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!response.ok) throw new Error(extractError(data))
  return data
}

// ======================================================
// KOMPONEN KECIL
// ======================================================

function ActiveBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
          : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {active ? 'Aktif' : 'Nonaktif'}
    </span>
  )
}

function Avatar({ name, active = true, size = 'md' }) {
  const dim = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dim} ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
      }`}
    >
      {getInitials(name)}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, tone }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-xl font-black text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
      <Icon size={18} className="mt-0.5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1 break-words text-sm font-bold text-slate-800">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function ErrorBox({ children }) {
  if (!children) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400'

const EMPTY_FORM = {
  nama_nasabah: '',
  no_hp: '',
  no_rekening: '',
  nama_bank: '',
  nama_pemilik_rekening: '',
  alamat: '',
}

const FORM_FIELDS = Object.keys(EMPTY_FORM)

// ======================================================
// DATABASE NASABAH
// ======================================================

export default function DatabaseNasabah() {
  // -----------------------------
  // LIST
  // -----------------------------
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  // -----------------------------
  // DETAIL / EDIT
  // -----------------------------
  const [detailOpen, setDetailOpen] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('info') // 'info' | 'saldo'
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // -----------------------------
  // SALDO
  // -----------------------------
  const [riwayat, setRiwayat] = useState([])
  const [loadingRiwayat, setLoadingRiwayat] = useState(false)
  const [riwayatError, setRiwayatError] = useState('')
  const [saldoMode, setSaldoMode] = useState('tambah') // 'tambah' | 'kurangi'
  const [saldoJumlah, setSaldoJumlah] = useState('')
  const [saldoKet, setSaldoKet] = useState('')
  const [saldoSaving, setSaldoSaving] = useState(false)
  const [saldoError, setSaldoError] = useState('')

  // -----------------------------
  // STATUS
  // -----------------------------
  const [statusTarget, setStatusTarget] = useState(null)
  const [keterangan, setKeterangan] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState('')

  // -----------------------------
  // TOAST
  // -----------------------------
  const [toast, setToast] = useState(null)
  const showToast = (type, message) => setToast({ type, message })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // ======================================================
  // GET LIST / SEARCH  ->  GET /admin/nasabah/ [?search=]
  // Response: { total, data: [...] }
  // ======================================================

  const requestId = useRef(0)

  const getNasabah = useCallback(async (keyword) => {
    const id = ++requestId.current
    setLoading(true)
    setError('')

    try {
      const term = keyword.trim()
      const result = await request(term ? API.nasabahSearch(term) : API.nasabah)
      if (id !== requestId.current) return // abaikan response usang
      setRows(Array.isArray(result) ? result : result?.data || [])
    } catch (err) {
      if (id !== requestId.current) return
      console.error(err)
      setError(err.message)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => getNasabah(q), 300)
    return () => clearTimeout(timer)
  }, [q, getNasabah])

  useEffect(() => {
    setPage(1)
  }, [q, filter])

  // ======================================================
  // DATA TURUNAN
  // ======================================================

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    return {
      total: rows.length,
      active,
      inactive: rows.length - active,
      saldo: rows.reduce((sum, r) => sum + (Number(r.saldo) || 0), 0),
    }
  }, [rows])

  const filtered = useMemo(() => {
    if (filter === 'active') return rows.filter((r) => r.is_active)
    if (filter === 'inactive') return rows.filter((r) => !r.is_active)
    return rows
  }, [rows, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // ======================================================
  // DETAIL  ->  GET /admin/nasabah/{nik}
  // ======================================================

  const beginEdit = (data) => {
    setForm(
      FORM_FIELDS.reduce((acc, k) => ({ ...acc, [k]: data?.[k] ?? '' }), {})
    )
    setFormError('')
    setEditing(true)
  }

  const openDetail = async (nik, startEditing = false) => {
    setDetailOpen(true)
    setLoadingDetail(true)
    setSelected(null)
    setEditing(false)
    setTab('info')
    setFormError('')
    setRiwayat([])
    setSaldoJumlah('')
    setSaldoKet('')
    setSaldoError('')

    try {
      const data = await request(API.nasabahDetail(nik))
      setSelected(data)
      if (startEditing) beginEdit(data)
    } catch (err) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setEditing(false)
  }

  // ======================================================
  // EDIT  ->  PUT /admin/nasabah/{nik}  (partial update)
  // ======================================================

  const validateForm = () => {
    if (form.nama_nasabah.trim().length < 3) return 'Nama minimal 3 karakter.'
    if (!PHONE_REGEX.test(form.no_hp.trim()))
      return 'No HP harus diawali 0 atau +62, diikuti 9–12 digit.'
    if (form.no_rekening.trim().length < 10) return 'No rekening minimal 10 karakter.'
    if (form.nama_bank.trim().length < 3) return 'Nama bank minimal 3 karakter.'
    if (form.nama_pemilik_rekening.trim().length < 3)
      return 'Nama pemilik rekening minimal 3 karakter.'
    return ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selected) return

    const invalid = validateForm()
    if (invalid) {
      setFormError(invalid)
      return
    }

    const payload = {}
    FORM_FIELDS.forEach((k) => {
      const next = String(form[k]).trim()
      if (next !== String(selected[k] ?? '')) payload[k] = next
    })

    if (Object.keys(payload).length === 0) {
      setEditing(false)
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const updated = await request(API.nasabahUpdate(selected.nik), {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setSelected(updated)
      setEditing(false)
      showToast('success', 'Data nasabah berhasil diperbarui.')
      getNasabah(q)
    } catch (err) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ======================================================
  // STATUS  ->  PATCH /admin/nasabah/{nik}/status
  // ======================================================

  const openStatusDialog = (nasabah) => {
    setStatusTarget(nasabah)
    setKeterangan('')
    setStatusError('')
  }

  const closeStatusDialog = () => {
    if (!statusSaving) setStatusTarget(null)
  }

  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    if (!statusTarget) return

    const deactivating = statusTarget.is_active
    const body = { is_active: !deactivating }
    if (deactivating && keterangan.trim()) body.keterangan = keterangan.trim()

    setStatusSaving(true)
    setStatusError('')

    try {
      const updated = await request(API.nasabahStatus(statusTarget.nik), {
        method: 'PATCH',
        body: JSON.stringify(body),
      })

      if (detailOpen && selected?.nik === updated.nik) setSelected(updated)

      showToast(
        'success',
        `${updated.nama_nasabah} berhasil ${deactivating ? 'dinonaktifkan' : 'diaktifkan'}.`
      )
      setStatusTarget(null)
      getNasabah(q)
    } catch (err) {
      console.error(err)
      setStatusError(err.message)
    } finally {
      setStatusSaving(false)
    }
  }

  // ======================================================
  // RIWAYAT SALDO  ->  GET /admin/nasabah/{nik}/saldo/riwayat
  // ======================================================

  const loadRiwayat = useCallback(async (nik) => {
    setLoadingRiwayat(true)
    setRiwayatError('')
    try {
      const result = await request(API.nasabahSaldoHistory(nik))
      setRiwayat(Array.isArray(result) ? result : result?.data || [])
    } catch (err) {
      console.error(err)
      setRiwayatError(err.message)
    } finally {
      setLoadingRiwayat(false)
    }
  }, [])

  const openSaldoTab = () => {
    setTab('saldo')
    setEditing(false)
    if (selected) loadRiwayat(selected.nik)
  }

  // ======================================================
  // KOREKSI SALDO  ->  PATCH /admin/nasabah/{nik}/saldo
  // ======================================================

  const handleSaldoSubmit = async (e) => {
    e.preventDefault()
    if (!selected) return

    const nominal = Number(saldoJumlah)
    if (!nominal || nominal <= 0) {
      setSaldoError('Masukkan nominal lebih dari 0.')
      return
    }
    if (saldoKet.trim().length < 5) {
      setSaldoError('Keterangan wajib diisi (minimal 5 karakter) untuk audit.')
      return
    }

    const jumlah = saldoMode === 'kurangi' ? -nominal : nominal
    if (Number(selected.saldo) + jumlah < 0) {
      setSaldoError('Saldo tidak boleh menjadi negatif.')
      return
    }

    setSaldoSaving(true)
    setSaldoError('')

    try {
      const updated = await request(API.nasabahSaldo(selected.nik), {
        method: 'PATCH',
        body: JSON.stringify({ jumlah, keterangan: saldoKet.trim() }),
      })
      setSelected(updated)
      setSaldoJumlah('')
      setSaldoKet('')
      showToast('success', 'Saldo berhasil dikoreksi.')
      loadRiwayat(updated.nik)
      getNasabah(q)
    } catch (err) {
      console.error(err)
      setSaldoError(err.message)
    } finally {
      setSaldoSaving(false)
    }
  }

  // ======================================================
  // RENDER
  // ======================================================

  const targetDeactivating = !!statusTarget?.is_active

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* ================= HEADER ================= */}
      <PageHeader
        title="Database Nasabah"
        action={
          <button
            onClick={() => getNasabah(q)}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        }
      />

      {/* ================= TOAST ================= */}
      {toast && (
        <div
          role="status"
          className="fixed right-6 top-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-lg"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ================= STATISTIK ================= */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Nasabah" value={stats.total} tone="slate" />
        <StatCard icon={UserCheck} label="Aktif" value={stats.active} tone="emerald" />
        <StatCard icon={UserX} label="Nonaktif" value={stats.inactive} tone="rose" />
        <StatCard icon={Wallet} label="Total Saldo" value={rupiah(stats.saldo)} tone="amber" />
      </div>

      {/* ================= ERROR ================= */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button onClick={() => getNasabah(q)} className="font-bold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* ================= TOOLBAR ================= */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <Search size={18} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari NIK, nama, atau nomor HP..."
            className="w-full text-sm outline-none"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Hapus pencarian"
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-bold transition ${
                filter === f.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= TABEL ================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Memuat data nasabah...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
            <Users size={36} className="text-slate-300" />
            {q
              ? 'Nasabah tidak ditemukan.'
              : filter !== 'all'
                ? 'Tidak ada nasabah pada filter ini.'
                : 'Belum ada data nasabah.'}
          </div>
        ) : (
          <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">Nasabah</th>
                  <th className="whitespace-nowrap px-6 py-4">NIK</th>
                  <th className="whitespace-nowrap px-6 py-4">No Handphone</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Saldo</th>
                  <th className="whitespace-nowrap px-6 py-4">Status</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {pageRows.map((r) => (
                  <tr
                    key={r.nik}
                    className="border-t border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.nama_nasabah} active={r.is_active} />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">{r.nama_nasabah}</p>
                          <p className="text-xs text-slate-400">
                            Daftar {formatDate(r.tanggal_daftar)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono text-sm text-slate-600">{r.nik}</td>

                    <td className="px-6 py-4 text-sm text-slate-600">{r.no_hp || '-'}</td>

                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-bold text-slate-800">
                      {rupiah(r.saldo)}
                    </td>

                    <td className="px-6 py-4">
                      <ActiveBadge active={r.is_active} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetail(r.nik)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50"
                        >
                          <Eye size={15} />
                          Detail
                        </button>

                        <button
                          onClick={() => openDetail(r.nik, true)}
                          title="Edit data"
                          aria-label={`Edit ${r.nama_nasabah}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => openStatusDialog(r)}
                          title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          aria-label={`${r.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${r.nama_nasabah}`}
                          className={`rounded-lg border p-2 transition ${
                            r.is_active
                              ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {r.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================= PAGINATION ================= */}
        {filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500 sm:flex-row">
            <p>
              Menampilkan{' '}
              <b className="text-slate-700">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </b>{' '}
              dari <b className="text-slate-700">{filtered.length}</b> nasabah
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="Halaman sebelumnya"
                className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[90px] text-center font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                aria-label="Halaman berikutnya"
                className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================
          MODAL DETAIL / EDIT / SALDO
      ================================================== */}
      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={editing ? 'Edit Data Nasabah' : 'Detail Nasabah'}
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Memuat detail...
          </div>
        ) : !selected ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {formError || 'Data nasabah tidak ditemukan.'}
          </p>
        ) : editing ? (
          /* ---------- MODE EDIT ---------- */
          <form onSubmit={handleSave} className="space-y-4">
            <ErrorBox>{formError}</ErrorBox>

            <Field label="NIK (tidak dapat diubah)">
              <input value={selected.nik} disabled className={`${inputCls} font-mono`} />
            </Field>

            <Field label="Nama Lengkap">
              <input
                value={form.nama_nasabah}
                onChange={(e) => setForm({ ...form, nama_nasabah: e.target.value })}
                className={inputCls}
                autoFocus
              />
            </Field>

            <Field label="No Handphone" hint="Contoh: 081234567890 atau +6281234567890">
              <input
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                inputMode="tel"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nama Bank">
                <input
                  value={form.nama_bank}
                  onChange={(e) => setForm({ ...form, nama_bank: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="No Rekening">
                <input
                  value={form.no_rekening}
                  onChange={(e) => setForm({ ...form, no_rekening: e.target.value })}
                  inputMode="numeric"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Nama Pemilik Rekening">
              <input
                value={form.nama_pemilik_rekening}
                onChange={(e) => setForm({ ...form, nama_pemilik_rekening: e.target.value })}
                className={inputCls}
              />
            </Field>

            <Field label="Alamat">
              <textarea
                value={form.alamat}
                onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Perubahan
              </button>
            </div>
          </form>
        ) : (
          /* ---------- MODE LIHAT ---------- */
          <div className="space-y-4">
            {/* Ringkasan */}
            <div className="flex items-center gap-4">
              <Avatar name={selected.nama_nasabah} active={selected.is_active} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-slate-800">
                  {selected.nama_nasabah}
                </p>
                <div className="mt-1">
                  <ActiveBadge active={selected.is_active} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Saldo</p>
                <p className="text-lg font-black text-emerald-600">{rupiah(selected.saldo)}</p>
              </div>
            </div>

            {/* Tab */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { key: 'info', label: 'Informasi', onClick: () => setTab('info') },
                { key: 'saldo', label: 'Saldo & Riwayat', onClick: openSaldoTab },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={t.onClick}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                    tab === t.key
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'info' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <InfoRow icon={IdCard} label="NIK">
                    <span className="font-mono">{selected.nik}</span>
                  </InfoRow>
                  <InfoRow icon={Phone} label="No Handphone">
                    {selected.no_hp || '-'}
                  </InfoRow>
                  <InfoRow icon={Landmark} label="Rekening">
                    {selected.nama_bank} · {selected.no_rekening}
                    <p className="mt-0.5 text-xs font-normal text-slate-500">
                      a.n. {selected.nama_pemilik_rekening}
                    </p>
                  </InfoRow>
                  <InfoRow icon={CalendarDays} label="Tanggal Daftar">
                    {formatDate(selected.tanggal_daftar, true)}
                  </InfoRow>
                </div>

                <InfoRow icon={MapPin} label="Alamat">
                  {selected.alamat || '-'}
                </InfoRow>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    onClick={() => openStatusDialog(selected)}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition ${
                      selected.is_active
                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {selected.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                    {selected.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => beginEdit(selected)}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Pencil size={16} />
                    Edit Data
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Form koreksi saldo */}
                <form
                  onSubmit={handleSaldoSubmit}
                  className="space-y-3 rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-sm font-bold text-slate-700">Koreksi Saldo Manual</p>

                  <div className="inline-flex rounded-lg border border-slate-200 p-1">
                    {[
                      { key: 'tambah', label: 'Tambah', icon: Plus },
                      { key: 'kurangi', label: 'Kurangi', icon: Minus },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSaldoMode(key)}
                        className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-bold transition ${
                          saldoMode === key
                            ? key === 'tambah'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr]">
                    <Field label="Nominal (Rp)">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={saldoJumlah}
                        onChange={(e) => setSaldoJumlah(e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Keterangan (wajib)">
                      <input
                        value={saldoKet}
                        onChange={(e) => setSaldoKet(e.target.value)}
                        placeholder="Alasan koreksi, untuk audit"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <ErrorBox>{saldoError}</ErrorBox>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={saldoSaving}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saldoSaving && <Loader2 size={16} className="animate-spin" />}
                      Terapkan Koreksi
                    </button>
                  </div>
                </form>

                {/* Riwayat */}
                <div>
                  <p className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <History size={16} className="text-slate-400" />
                    Riwayat Koreksi Saldo
                  </p>

                  {loadingRiwayat ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                      <Loader2 size={18} className="animate-spin" />
                      Memuat riwayat...
                    </div>
                  ) : riwayatError ? (
                    <ErrorBox>{riwayatError}</ErrorBox>
                  ) : riwayat.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">
                      Belum ada koreksi saldo.
                    </p>
                  ) : (
                    <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {riwayat.map((h) => {
                        const plus = Number(h.jumlah) >= 0
                        return (
                          <li
                            key={h.id_adjustment}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`text-sm font-black ${
                                  plus ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {plus ? '+' : '−'}
                                {rupiah(Math.abs(Number(h.jumlah)))}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatDate(h.tanggal, true)}
                              </span>
                            </div>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                              {rupiah(h.saldo_sebelum)}
                              <ArrowRight size={12} />
                              <b className="text-slate-700">{rupiah(h.saldo_sesudah)}</b>
                            </p>
                            <p className="mt-1.5 text-sm text-slate-700">{h.keterangan}</p>
                            <p className="mt-1 text-xs text-slate-400">Admin #{h.id_admin}</p>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ==================================================
          MODAL KONFIRMASI STATUS
      ================================================== */}
      <Modal
        open={!!statusTarget}
        onClose={closeStatusDialog}
        title={targetDeactivating ? 'Nonaktifkan Nasabah' : 'Aktifkan Nasabah'}
      >
        {statusTarget && (
          <form onSubmit={handleStatusSubmit} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <Avatar name={statusTarget.nama_nasabah} active={statusTarget.is_active} />
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{statusTarget.nama_nasabah}</p>
                <p className="font-mono text-xs text-slate-500">{statusTarget.nik}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {targetDeactivating
                ? 'Nasabah yang dinonaktifkan tidak dapat login maupun melakukan setoran sampai diaktifkan kembali.'
                : 'Nasabah akan dapat kembali login dan melakukan setoran seperti biasa.'}
            </p>

            {targetDeactivating && (
              <Field label="Keterangan (opsional)">
                <textarea
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Nasabah pindah domisili"
                  className={`${inputCls} resize-none`}
                  autoFocus
                />
              </Field>
            )}

            <ErrorBox>{statusError}</ErrorBox>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeStatusDialog}
                disabled={statusSaving}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={statusSaving}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  targetDeactivating
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusSaving && <Loader2 size={16} className="animate-spin" />}
                {targetDeactivating ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
