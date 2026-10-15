import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
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
  Plus,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { API, getAuthHeaders } from '../api'

// ======================================================
// KONSTANTA & HELPER
// ======================================================
const PAGE_SIZE = 10
const PHONE_REGEX = /^(\+62|0)[0-9]{9,12}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'inactive', label: 'Nonaktif' },
]

// Backend menyimpan waktu UTC tanpa penanda zona -> tambahkan "Z" agar tampil sesuai zona lokal
const formatDate = (value) => {
  if (!value) return '-'
  const str = String(value)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : `${str}+07:00`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
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

function RoleBadge({ role }) {
  const isSuper = role === 'super_admin'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        isSuper ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isSuper && <ShieldCheck size={12} />}
      {isSuper ? 'Super Admin' : 'Admin'}
    </span>
  )
}

function Avatar({ name, active = true }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
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

function PasswordInput({ value, onChange, placeholder, autoComplete = 'new-password' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`${inputCls} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

const EMPTY_FORM = { nama_admin: '', username: '', email: '', no_hp: '', password: '' }

// ======================================================
// DATABASE ADMIN (khusus super admin)
// ======================================================
export default function DatabaseAdmin() {
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
  // FORM TAMBAH / EDIT
  // -----------------------------
  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // -----------------------------
  // STATUS & HAPUS
  // -----------------------------
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // -----------------------------
  // TOAST
  // -----------------------------
  const [toast, setToast] = useState(null)
  const showToast = (message) => setToast({ message })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // ======================================================
  // GET LIST / SEARCH  ->  GET /admin/list-admin [?search=]
  // Response: { total, data: [...] }
  // ======================================================
  const requestId = useRef(0)
  const getAdmins = useCallback(async (keyword) => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const term = keyword.trim()
      const result = await request(term ? API.kelolaAdminSearch(term) : API.kelolaAdminList)
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
    const timer = setTimeout(() => getAdmins(q), 300)
    return () => clearTimeout(timer)
  }, [q, getAdmins])

  useEffect(() => {
    setPage(1)
  }, [q, filter])

  // ======================================================
  // DATA TURUNAN
  // ======================================================
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    return { total: rows.length, active, inactive: rows.length - active }
  }, [rows])

  const filtered = useMemo(() => {
    if (filter === 'active') return rows.filter((r) => r.is_active)
    if (filter === 'inactive') return rows.filter((r) => !r.is_active)
    return rows
  }, [rows, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const fromRow = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const toRow = Math.min(currentPage * PAGE_SIZE, filtered.length)

  // ======================================================
  // FORM: buka / tutup / validasi
  // ======================================================
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setEditTarget(null)
    setFormMode('create')
  }

  const openEdit = (admin) => {
    setForm({
      nama_admin: admin.nama_admin ?? '',
      username: admin.username ?? '',
      email: admin.email ?? '',
      no_hp: admin.no_hp ?? '',
      password: '',
    })
    setFormError('')
    setEditTarget(admin)
    setFormMode('edit')
  }

  const closeForm = () => {
    if (!saving) setFormMode(null)
  }

  const validateForm = () => {
    const creating = formMode === 'create'
    const nama = form.nama_admin.trim()
    const email = form.email.trim()
    const noHp = form.no_hp.trim()

    if (nama && nama.length < 3) return 'Nama minimal 3 karakter.'
    if (creating && !nama) return 'Nama wajib diisi.'
    if (creating && form.username.trim().length < 5) return 'Username minimal 5 karakter.'
    if (creating && !email) return 'Email wajib diisi.'
    if (email && !EMAIL_REGEX.test(email)) return 'Format email tidak valid.'
    if (creating && !noHp) return 'No HP wajib diisi.'
    if (noHp && !PHONE_REGEX.test(noHp)) return 'No HP harus diawali 0 atau +62, diikuti 9–12 digit.'
    if (creating && form.password.length < 8) return 'Password minimal 8 karakter.'
    if (!creating && form.password && form.password.length < 8)
      return 'Password baru minimal 8 karakter.'
    return ''
  }

  // ======================================================
  // SIMPAN
  //   tambah -> POST  /admin/create-admin
  //   edit   -> PATCH /admin/edit-admin/{id}  (partial update)
  // ======================================================
  const handleSubmit = async (e) => {
    e.preventDefault()
    const invalid = validateForm()
    if (invalid) {
      setFormError(invalid)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (formMode === 'create') {
        const created = await request(API.kelolaAdminCreate, {
          method: 'POST',
          body: JSON.stringify({
            nama_admin: form.nama_admin.trim(),
            username: form.username.trim(),
            email: form.email.trim(),
            no_hp: form.no_hp.trim(),
            password: form.password,
          }),
        })
        showToast(`Akun admin "${created.username}" berhasil dibuat.`)
      } else {
        const payload = {}
        ;['nama_admin', 'email', 'no_hp'].forEach((k) => {
          const next = form[k].trim()
          if (next && next !== String(editTarget[k] ?? '')) payload[k] = next
        })
        if (form.password) payload.password = form.password

        if (Object.keys(payload).length === 0) {
          setFormMode(null)
          return
        }
        await request(API.kelolaAdminEdit(editTarget.id_admin), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        showToast(
          payload.password
            ? 'Data diperbarui. Password direset, admin tersebut harus login ulang.'
            : 'Data admin berhasil diperbarui.'
        )
      }
      setFormMode(null)
      getAdmins(q)
    } catch (err) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ======================================================
  // STATUS  ->  PATCH /admin/status-admin/{id}  { is_active }
  // ======================================================
  const openStatusDialog = (admin) => {
    setStatusTarget(admin)
    setStatusError('')
  }

  const closeStatusDialog = () => {
    if (!statusSaving) setStatusTarget(null)
  }

  const handleStatusSubmit = async () => {
    if (!statusTarget) return
    const deactivating = statusTarget.is_active
    setStatusSaving(true)
    setStatusError('')
    try {
      const updated = await request(API.kelolaAdminStatus(statusTarget.id_admin), {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !deactivating }),
      })
      showToast(`${updated.nama_admin} berhasil ${deactivating ? 'dinonaktifkan' : 'diaktifkan'}.`)
      setStatusTarget(null)
      getAdmins(q)
    } catch (err) {
      console.error(err)
      setStatusError(err.message)
    } finally {
      setStatusSaving(false)
    }
  }

  // ======================================================
  // HAPUS  ->  DELETE /admin/delete-admin/{id}
  // Ditolak 409 oleh backend kalau admin sudah punya riwayat.
  // ======================================================
  const openDeleteDialog = (admin) => {
    setDeleteTarget(admin)
    setDeleteError('')
  }

  const closeDeleteDialog = () => {
    if (!deleting) setDeleteTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await request(API.kelolaAdminDelete(deleteTarget.id_admin), { method: 'DELETE' })
      showToast(`Akun "${deleteTarget.username}" berhasil dihapus.`)
      setDeleteTarget(null)
      getAdmins(q)
    } catch (err) {
      console.error(err)
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
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
        title="Database Admin"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => getAdmins(q)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-emerald-600 px-5 py-3 font-bold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus size={18} />
              Tambah Admin
            </button>
          </div>
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
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Total Akun" value={stats.total} tone="slate" />
        <StatCard icon={UserCheck} label="Aktif" value={stats.active} tone="emerald" />
        <StatCard icon={UserX} label="Nonaktif" value={stats.inactive} tone="rose" />
      </div>

      {/* ================= ERROR ================= */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button onClick={() => getAdmins(q)} className="font-bold underline underline-offset-2">
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
            placeholder="Cari nama, username, atau email..."
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
            Memuat data admin...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
            <Users size={36} className="text-slate-300" />
            {q
              ? 'Admin tidak ditemukan.'
              : filter !== 'all'
                ? 'Tidak ada admin pada filter ini.'
                : 'Belum ada data admin.'}
          </div>
        ) : (
          <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">Admin</th>
                  <th className="whitespace-nowrap px-6 py-4">Email</th>
                  <th className="whitespace-nowrap px-6 py-4">No Handphone</th>
                  <th className="whitespace-nowrap px-6 py-4">Role</th>
                  <th className="whitespace-nowrap px-6 py-4">Status</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const isSuper = r.role === 'super_admin'
                  return (
                    <tr
                      key={r.id_admin}
                      className="border-t border-slate-100 transition hover:bg-slate-50/70"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.nama_admin} active={r.is_active} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800">{r.nama_admin}</p>
                            <p className="text-xs text-slate-400">
                              @{r.username} · dibuat {formatDate(r.tanggal_dibuat)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{r.no_hp || '-'}</td>
                      <td className="px-6 py-4">
                        <RoleBadge role={r.role} />
                      </td>
                      <td className="px-6 py-4">
                        <ActiveBadge active={r.is_active} />
                      </td>
                      <td className="px-6 py-4">
                        {isSuper ? (
                          <p className="text-right text-xs font-bold text-slate-400">Dilindungi</p>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(r)}
                              title="Edit akun"
                              aria-label={`Edit ${r.nama_admin}`}
                              className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => openStatusDialog(r)}
                              title={r.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              aria-label={`${r.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${r.nama_admin}`}
                              className={`rounded-lg border p-2 transition ${
                                r.is_active
                                  ? 'border-amber-200 text-amber-600 hover:bg-amber-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {r.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                            <button
                              onClick={() => openDeleteDialog(r)}
                              title="Hapus akun"
                              aria-label={`Hapus ${r.nama_admin}`}
                              className="rounded-lg border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
            <span>
              Menampilkan {fromRow}–{toRow} dari {filtered.length} akun
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Halaman sebelumnya"
                className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-bold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Halaman berikutnya"
                className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: TAMBAH / EDIT ================= */}
      <Modal
        open={formMode !== null}
        onClose={closeForm}
        title={formMode === 'create' ? 'Tambah Akun Admin' : 'Edit Akun Admin'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nama Lengkap">
            <input
              value={form.nama_admin}
              onChange={setField('nama_admin')}
              className={inputCls}
              placeholder="Nama admin"
            />
          </Field>

          <Field
            label="Username"
            hint={
              formMode === 'edit'
                ? 'Username tidak bisa diubah. Kalau salah ketik, nonaktifkan lalu buat akun baru.'
                : 'Minimal 5 karakter, dipakai untuk login.'
            }
          >
            <input
              value={form.username}
              onChange={setField('username')}
              disabled={formMode === 'edit'}
              autoComplete="off"
              className={inputCls}
              placeholder="username"
            />
          </Field>

          <Field label="Email" hint="Kode OTP login dikirim ke email ini.">
            <input
              type="email"
              value={form.email}
              onChange={setField('email')}
              className={inputCls}
              placeholder="admin@email.com"
            />
          </Field>

          <Field label="No Handphone">
            <input
              value={form.no_hp}
              onChange={setField('no_hp')}
              className={inputCls}
              placeholder="081234567890"
            />
          </Field>

          <Field
            label={formMode === 'edit' ? 'Password Baru' : 'Password'}
            hint={
              formMode === 'edit'
                ? 'Kosongkan jika tidak ingin mengubah. Kalau diisi, admin ini otomatis logout dan harus login ulang.'
                : 'Minimal 8 karakter.'
            }
          >
            <PasswordInput
              value={form.password}
              onChange={setField('password')}
              placeholder={formMode === 'edit' ? 'Biarkan kosong jika tidak diubah' : 'Password awal'}
            />
          </Field>

          <ErrorBox>{formError}</ErrorBox>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Menyimpan...' : formMode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ================= MODAL: NONAKTIFKAN / AKTIFKAN ================= */}
      <Modal
        open={!!statusTarget}
        onClose={closeStatusDialog}
        title={targetDeactivating ? 'Nonaktifkan Akun Admin' : 'Aktifkan Akun Admin'}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {targetDeactivating ? (
              <>
                Akun <b>{statusTarget?.nama_admin}</b> (@{statusTarget?.username}) akan{' '}
                <b>langsung logout</b> dan tidak bisa login lagi. Chat yang sedang ditanganinya
                dilepas supaya admin lain bisa mengambil alih. Data dan riwayatnya tetap utuh, dan
                akun bisa diaktifkan kembali kapan saja.
              </>
            ) : (
              <>
                Akun <b>{statusTarget?.nama_admin}</b> (@{statusTarget?.username}) akan bisa login
                kembali.
              </>
            )}
          </p>
          <ErrorBox>{statusError}</ErrorBox>
          <div className="flex justify-end gap-3">
            <button
              onClick={closeStatusDialog}
              disabled={statusSaving}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Batal
            </button>
            <button
              onClick={handleStatusSubmit}
              disabled={statusSaving}
              className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                targetDeactivating
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {statusSaving && <Loader2 size={16} className="animate-spin" />}
              {targetDeactivating ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: HAPUS ================= */}
      <Modal open={!!deleteTarget} onClose={closeDeleteDialog} title="Hapus Akun Admin">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Hapus permanen akun <b>{deleteTarget?.nama_admin}</b> (@{deleteTarget?.username})?
            Penghapusan hanya bisa untuk akun yang <b>belum punya riwayat apa pun</b> (pengumuman,
            koreksi saldo, transaksi, penarikan). Kalau sudah punya riwayat, pakai Nonaktifkan.
          </p>
          <ErrorBox>{deleteError}</ErrorBox>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={closeDeleteDialog}
              disabled={deleting}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Batal
            </button>
            {deleteError && deleteTarget?.is_active && (
              <button
                onClick={() => {
                  const target = deleteTarget
                  setDeleteTarget(null)
                  openStatusDialog(target)
                }}
                className="rounded-lg border border-amber-300 px-5 py-2.5 text-sm font-bold text-amber-600 transition hover:bg-amber-50"
              >
                Nonaktifkan saja
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting && <Loader2 size={16} className="animate-spin" />}
              Ya, Hapus
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
