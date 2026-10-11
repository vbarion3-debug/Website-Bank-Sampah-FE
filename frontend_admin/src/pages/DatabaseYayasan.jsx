import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  MapPin,
  UserRound,
  Power,
  Save,
  Wallet,
  Info,
  CalendarDays,
} from 'lucide-react'

import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { API, getAuthHeaders } from '../api'

// ======================================================
// KONSTANTA & HELPER
// ======================================================

const PHONE_REGEX = /^(\+62|0)[0-9]{9,12}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NO_KATEGORI = '__none__'

const FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'inactive', label: 'Nonaktif' },
]

const EMPTY_FORM = {
  nama_mitra: '',
  nama_penanggung_jawab: '',
  no_hp: '',
  email: '',
  alamat: '',
  deskripsi: '',
}

const FORM_FIELDS = Object.keys(EMPTY_FORM)

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

// Backend menyimpan waktu UTC tanpa penanda zona -> tambahkan "Z"
const formatDate = (value) => {
  if (!value) return '-'
  const str = String(value)
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(str) ? str : `${str}Z`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

// Endpoint yang belum ada di api.js dibangun dari yang sudah ada
const urlStatus = (id) => `${API.mitraDetail(id)}/status`
const urlHargaItem = (id, idHarga) => `${API.mitraHarga(id)}/${idHarga}`

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400'

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
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-black text-slate-800">{value}</p>
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

function PriceInput({ value, onChange, onEnter, placeholder = '0', width = 'w-28' }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-slate-400">Rp</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onEnter?.()
          }
        }}
        className={`${width} rounded-lg border border-slate-200 px-3 py-1.5 text-right text-sm font-bold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100`}
      />
    </div>
  )
}

// Satu baris jenis sampah di tab "Harga Beli"
function HargaRow({ item, existing, value, dirty, saving, onChange, onSave, onRemove }) {
  const numeric = Number(value)
  const lowerThanNasabah = numeric > 0 && numeric < Number(item.harga_per_kg)

  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
      <div className="min-w-[140px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-slate-800">{item.nama_jenis}</p>
          {!existing && !dirty && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
              Belum diatur
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400">Harga ke nasabah {rupiah(item.harga_per_kg)}/kg</p>
      </div>

      <div className="flex items-center gap-1.5">
        <PriceInput value={value} onChange={onChange} onEnter={onSave} />
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          aria-label={`Simpan harga ${item.nama_jenis}`}
          className="rounded-lg bg-emerald-600 p-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        {existing && (
          <button
            type="button"
            onClick={onRemove}
            disabled={saving}
            aria-label={`Hapus harga ${item.nama_jenis}`}
            className="rounded-lg border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {lowerThanNasabah && (
        <p className="flex w-full items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle size={12} />
          Lebih rendah dari harga yang dibayar ke nasabah.
        </p>
      )}
    </li>
  )
}

// ======================================================
// DATABASE YAYASAN
// ======================================================

export default function DatabaseYayasan() {
  // -----------------------------
  // LIST
  // -----------------------------
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  // -----------------------------
  // MASTER JENIS SAMPAH (sumber harga & kategori)
  // -----------------------------
  const [jenis, setJenis] = useState([])
  const [jenisError, setJenisError] = useState('')

  // -----------------------------
  // DETAIL (info + harga beli)
  // -----------------------------
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('info') // 'info' | 'harga'
  const [drafts, setDrafts] = useState({}) // { id_jenis: "8500" }
  const [rowSaving, setRowSaving] = useState({}) // { id_jenis: true }
  const [bulk, setBulk] = useState({}) // { kategoriKey: "3000" }
  const [bulkSaving, setBulkSaving] = useState('')

  // -----------------------------
  // FORM TAMBAH / EDIT
  // -----------------------------
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // objek yayasan, atau null = tambah
  const [step, setStep] = useState(1) // 1 = info, 2 = harga default per kategori
  const [form, setForm] = useState(EMPTY_FORM)
  const [katPrices, setKatPrices] = useState({}) // { kategoriKey: "3000" }
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
  const showToast = (type, message) => setToast({ type, message })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // ======================================================
  // GET LIST / SEARCH  ->  GET /mitra-pengepul/ [?search=]
  // Response: { total, data: [...] }
  // ======================================================

  const requestId = useRef(0)

  const getMitra = useCallback(async (keyword) => {
    const id = ++requestId.current
    setLoading(true)
    setError('')
    try {
      const term = keyword.trim()
      const url = term ? `${API.mitra}?search=${encodeURIComponent(term)}` : API.mitra
      const result = await request(url)
      if (id !== requestId.current) return
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
    const timer = setTimeout(() => getMitra(q), 300)
    return () => clearTimeout(timer)
  }, [q, getMitra])

  // ======================================================
  // GET JENIS SAMPAH  ->  GET /jenis-sampah/
  // ======================================================

  const getJenis = useCallback(async () => {
    setJenisError('')
    try {
      const result = await request(API.jenisSampah)
      setJenis(Array.isArray(result) ? result : result?.data || [])
    } catch (err) {
      console.error(err)
      setJenisError(err.message)
    }
  }, [])

  useEffect(() => {
    getJenis()
  }, [getJenis])

  const refreshAll = () => {
    getMitra(q)
    getJenis()
  }

  // ======================================================
  // DATA TURUNAN
  // ======================================================

  // Jenis sampah dikelompokkan per kategori
  const groups = useMemo(() => {
    const map = new Map()
    jenis.forEach((j) => {
      const key = j.kategori?.trim() || NO_KATEGORI
      if (!map.has(key)) {
        map.set(key, { key, label: key === NO_KATEGORI ? 'Tanpa Kategori' : key, items: [] })
      }
      map.get(key).items.push(j)
    })
    const list = [...map.values()]
    list.forEach((g) =>
      g.items.sort((a, b) => String(a.nama_jenis).localeCompare(String(b.nama_jenis), 'id'))
    )
    return list.sort((a, b) =>
      a.key === NO_KATEGORI ? 1 : b.key === NO_KATEGORI ? -1 : a.label.localeCompare(b.label, 'id')
    )
  }, [jenis])

  const hargaMap = useMemo(
    () => new Map((detail?.harga_jenis_sampah || []).map((h) => [h.id_jenis, h])),
    [detail]
  )

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    return { total: rows.length, active, inactive: rows.length - active }
  }, [rows])

  const filtered = useMemo(() => {
    if (filter === 'active') return rows.filter((r) => r.is_active)
    if (filter === 'inactive') return rows.filter((r) => !r.is_active)
    return rows
  }, [rows, filter])

  const hargaTerisi = jenis.filter((j) => hargaMap.has(j.id_jenis)).length

  // ======================================================
  // DETAIL  ->  GET /mitra-pengepul/{id}
  // ======================================================

  const openDetail = async (id, startTab = 'info') => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setDetail(null)
    setTab(startTab)
    setDrafts({})
    setBulk({})
    try {
      setDetail(await request(API.mitraDetail(id)))
    } catch (err) {
      console.error(err)
      setDetailError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const reloadDetail = async (id) => {
    try {
      setDetail(await request(API.mitraDetail(id)))
      setDrafts({})
    } catch (err) {
      console.error(err)
      showToast('error', err.message)
    }
  }

  // Gabungkan perubahan info/status (response tanpa daftar harga) ke state
  const mergeMitra = (updated) => {
    setRows((prev) => prev.map((r) => (r.id_mitra === updated.id_mitra ? { ...r, ...updated } : r)))
    setDetail((prev) => (prev && prev.id_mitra === updated.id_mitra ? { ...prev, ...updated } : prev))
  }

  // ======================================================
  // HARGA PER JENIS
  //   POST   /mitra-pengepul/{id}/harga
  //   PUT    /mitra-pengepul/{id}/harga/{id_harga}
  //   DELETE /mitra-pengepul/{id}/harga/{id_harga}
  // ======================================================

  const draftValue = (item) => {
    if (drafts[item.id_jenis] !== undefined) return drafts[item.id_jenis]
    const existing = hargaMap.get(item.id_jenis)
    return existing ? String(Number(existing.harga_beli_per_kg)) : ''
  }

  const isDirty = (item) => {
    if (drafts[item.id_jenis] === undefined) return false
    const existing = hargaMap.get(item.id_jenis)
    return drafts[item.id_jenis] !== (existing ? String(Number(existing.harga_beli_per_kg)) : '')
  }

  const upsertHarga = (idMitra, item, harga) => {
    const existing = hargaMap.get(item.id_jenis)
    return existing
      ? request(urlHargaItem(idMitra, existing.id_harga), {
          method: 'PUT',
          body: JSON.stringify({ harga_beli_per_kg: harga }),
        })
      : request(API.mitraHarga(idMitra), {
          method: 'POST',
          body: JSON.stringify({ id_jenis: item.id_jenis, harga_beli_per_kg: harga }),
        })
  }

  const saveHarga = async (item) => {
    if (!detail) return
    const harga = Number(draftValue(item))
    if (!(harga > 0)) {
      showToast('error', 'Harga beli harus lebih dari 0.')
      return
    }

    setRowSaving((s) => ({ ...s, [item.id_jenis]: true }))
    try {
      const saved = await upsertHarga(detail.id_mitra, item, harga)
      setDetail((prev) => {
        const list = prev.harga_jenis_sampah.filter((h) => h.id_jenis !== item.id_jenis)
        return { ...prev, harga_jenis_sampah: [...list, saved] }
      })
      setDrafts((d) => {
        const { [item.id_jenis]: _removed, ...rest } = d
        return rest
      })
      showToast('success', `Harga ${item.nama_jenis} disimpan: ${rupiah(harga)}/kg.`)
    } catch (err) {
      console.error(err)
      showToast('error', err.message)
    } finally {
      setRowSaving((s) => ({ ...s, [item.id_jenis]: false }))
    }
  }

  const removeHarga = async (item) => {
    const existing = hargaMap.get(item.id_jenis)
    if (!detail || !existing) return
    if (
      !window.confirm(
        `Hapus harga "${item.nama_jenis}" untuk ${detail.nama_mitra}? Penjualan jenis ini ke yayasan tidak bisa dicatat sampai harga diatur lagi.`
      )
    )
      return

    setRowSaving((s) => ({ ...s, [item.id_jenis]: true }))
    try {
      await request(urlHargaItem(detail.id_mitra, existing.id_harga), { method: 'DELETE' })
      setDetail((prev) => ({
        ...prev,
        harga_jenis_sampah: prev.harga_jenis_sampah.filter((h) => h.id_jenis !== item.id_jenis),
      }))
      setDrafts((d) => {
        const { [item.id_jenis]: _removed, ...rest } = d
        return rest
      })
      showToast('success', `Harga ${item.nama_jenis} dihapus.`)
    } catch (err) {
      console.error(err)
      showToast('error', err.message)
    } finally {
      setRowSaving((s) => ({ ...s, [item.id_jenis]: false }))
    }
  }

  // Terapkan satu harga ke semua jenis dalam satu kategori
  const applyBulk = async (group) => {
    if (!detail) return
    const harga = Number(bulk[group.key])
    if (!(harga > 0)) {
      showToast('error', `Isi harga untuk kategori ${group.label} lebih dari 0.`)
      return
    }

    const overwriting = group.items.filter(
      (i) =>
        hargaMap.has(i.id_jenis) &&
        Number(hargaMap.get(i.id_jenis).harga_beli_per_kg) !== harga
    ).length

    if (
      overwriting > 0 &&
      !window.confirm(
        `${overwriting} jenis di kategori ${group.label} sudah punya harga lain dan akan ditimpa menjadi ${rupiah(harga)}/kg. Lanjutkan?`
      )
    )
      return

    setBulkSaving(group.key)
    const results = await Promise.allSettled(
      group.items.map((item) => upsertHarga(detail.id_mitra, item, harga))
    )
    const failed = results.filter((r) => r.status === 'rejected')

    await reloadDetail(detail.id_mitra)
    setBulk((b) => ({ ...b, [group.key]: '' }))
    setBulkSaving('')

    if (failed.length === 0) {
      showToast('success', `${group.items.length} jenis ${group.label} diatur ke ${rupiah(harga)}/kg.`)
    } else {
      showToast(
        'error',
        `${failed.length} dari ${group.items.length} gagal disimpan: ${failed[0].reason?.message || 'error'}`
      )
    }
  }

  // ======================================================
  // FORM TAMBAH / EDIT
  // ======================================================

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setKatPrices({})
    setStep(1)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm(FORM_FIELDS.reduce((acc, k) => ({ ...acc, [k]: row[k] ?? '' }), {}))
    setStep(1)
    setFormError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    if (!saving) setFormOpen(false)
  }

  const validateInfo = () => {
    const nama = form.nama_mitra.trim()
    if (nama.length < 3) return 'Nama yayasan minimal 3 karakter.'
    if (nama.length > 150) return 'Nama yayasan maksimal 150 karakter.'
    if (form.nama_penanggung_jawab.trim().length > 100)
      return 'Nama penanggung jawab maksimal 100 karakter.'
    if (form.no_hp.trim() && !PHONE_REGEX.test(form.no_hp.trim()))
      return 'No HP harus diawali 0 atau +62, diikuti 9–12 digit.'
    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim()))
      return 'Format email tidak valid.'
    return ''
  }

  const nextStep = (e) => {
    e.preventDefault()
    const invalid = validateInfo()
    if (invalid) {
      setFormError(invalid)
      return
    }
    setFormError('')
    setStep(2)
  }

  // ---------- EDIT: PUT /mitra-pengepul/{id} ----------
  const submitEdit = async (e) => {
    e.preventDefault()
    const invalid = validateInfo()
    if (invalid) {
      setFormError(invalid)
      return
    }

    const payload = {}
    FORM_FIELDS.forEach((k) => {
      const next = form[k].trim()
      if (next !== String(editing[k] ?? '')) payload[k] = next || null
    })

    if (Object.keys(payload).length === 0) {
      setFormOpen(false)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const updated = await request(API.mitraDetail(editing.id_mitra), {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      mergeMitra(updated)
      showToast('success', `Data ${updated.nama_mitra} diperbarui.`)
      setFormOpen(false)
    } catch (err) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ---------- TAMBAH: POST /create, lalu harga default per kategori ----------
  const submitCreate = async () => {
    const entries = groups
      .map((g) => ({ group: g, harga: Number(katPrices[g.key]) }))
      .filter((x) => x.harga > 0)

    setSaving(true)
    setFormError('')

    let created
    try {
      const payload = { nama_mitra: form.nama_mitra.trim() }
      FORM_FIELDS.forEach((k) => {
        if (k !== 'nama_mitra' && form[k].trim()) payload[k] = form[k].trim()
      })
      created = await request(API.mitraCreate, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error(err)
      setFormError(err.message)
      setSaving(false)
      return
    }

    // Yayasan sudah tersimpan; sekarang isi harga semua jenis dari kategori yang diisi
    const jobs = entries.flatMap(({ group, harga }) =>
      group.items.map((item) =>
        request(API.mitraHarga(created.id_mitra), {
          method: 'POST',
          body: JSON.stringify({ id_jenis: item.id_jenis, harga_beli_per_kg: harga }),
        })
      )
    )
    const results = await Promise.allSettled(jobs)
    const failed = results.filter((r) => r.status === 'rejected').length

    setSaving(false)
    setFormOpen(false)
    getMitra(q)

    if (failed === 0) {
      showToast(
        'success',
        jobs.length > 0
          ? `${created.nama_mitra} ditambahkan dengan ${jobs.length} harga beli.`
          : `${created.nama_mitra} ditambahkan. Harga beli bisa diatur kapan saja.`
      )
    } else {
      showToast(
        'error',
        `${created.nama_mitra} tersimpan, tapi ${failed} harga gagal. Lengkapi di tab Harga Beli.`
      )
      openDetail(created.id_mitra, 'harga')
    }
  }

  // ======================================================
  // STATUS  ->  PATCH /mitra-pengepul/{id}/status
  // ======================================================

  const openStatusDialog = (row) => {
    setStatusTarget(row)
    setStatusError('')
  }

  const closeStatusDialog = () => {
    if (!statusSaving) setStatusTarget(null)
  }

  const submitStatus = async () => {
    if (!statusTarget) return
    setStatusSaving(true)
    setStatusError('')
    try {
      const updated = await request(urlStatus(statusTarget.id_mitra), {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !statusTarget.is_active }),
      })
      mergeMitra(updated)
      showToast(
        'success',
        `${updated.nama_mitra} ${updated.is_active ? 'diaktifkan' : 'dinonaktifkan'}.`
      )
      setStatusTarget(null)
    } catch (err) {
      console.error(err)
      setStatusError(err.message)
    } finally {
      setStatusSaving(false)
    }
  }

  // ======================================================
  // HAPUS  ->  DELETE /mitra-pengepul/{id}
  // ======================================================

  const openDelete = (row) => {
    setDeleteTarget(row)
    setDeleteError('')
  }

  const closeDelete = () => {
    if (!deleting) setDeleteTarget(null)
  }

  const submitDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await request(API.mitraDetail(deleteTarget.id_mitra), { method: 'DELETE' })
      showToast('success', `${deleteTarget.nama_mitra} dihapus.`)
      if (detail?.id_mitra === deleteTarget.id_mitra) setDetailOpen(false)
      setDeleteTarget(null)
      getMitra(q)
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

  return (
    <div className="mx-auto max-w-[1180px]">
      {/* ================= HEADER ================= */}
      <PageHeader
        title="Database Yayasan"
        action={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={refreshAll}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <Plus size={18} />
              Tambah Yayasan
            </button>
          </div>
        }
      />

      {/* ================= TOAST ================= */}
      {toast && (
        <div
          role="status"
          className={`fixed right-6 top-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="Tutup">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ================= STATISTIK ================= */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Total Yayasan" value={stats.total} tone="slate" />
        <StatCard icon={Power} label="Kerjasama Aktif" value={stats.active} tone="emerald" />
        <StatCard icon={Power} label="Nonaktif" value={stats.inactive} tone="rose" />
      </div>

      {/* ================= ERROR ================= */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button onClick={() => getMitra(q)} className="font-bold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {jenisError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            Daftar jenis sampah gagal dimuat ({jenisError}). Pengaturan harga belum bisa dipakai.
          </span>
          <button onClick={getJenis} className="font-bold underline underline-offset-2">
            Muat ulang
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
            placeholder="Cari nama yayasan atau penanggung jawab..."
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
            Memuat data yayasan...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
            <Building2 size={36} className="text-slate-300" />
            {q
              ? 'Yayasan tidak ditemukan.'
              : filter !== 'all'
                ? 'Tidak ada yayasan pada filter ini.'
                : 'Belum ada yayasan. Klik "Tambah Yayasan" untuk memulai.'}
          </div>
        ) : (
          <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Yayasan</th>
                  <th className="px-6 py-4">Kontak</th>
                  <th className="px-6 py-4">Alamat</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id_mitra}
                    className="border-t border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            r.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Building2 size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800">{r.nama_mitra}</p>
                          <p className="text-xs text-slate-400">
                            PJ: {r.nama_penanggung_jawab || '-'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      <p>{r.no_hp || '-'}</p>
                      <p className="text-xs text-slate-400">{r.email || '-'}</p>
                    </td>

                    <td className="max-w-[220px] px-6 py-4 text-sm text-slate-600">
                      <p className="line-clamp-2">{r.alamat || '-'}</p>
                    </td>

                    <td className="px-6 py-4">
                      <ActiveBadge active={r.is_active} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetail(r.id_mitra, 'info')}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => openDetail(r.id_mitra, 'harga')}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50"
                        >
                          <Wallet size={14} />
                          Harga Beli
                        </button>
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit data"
                          aria-label={`Edit ${r.nama_mitra}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => openStatusDialog(r)}
                          title={r.is_active ? 'Nonaktifkan kerjasama' : 'Aktifkan kerjasama'}
                          aria-label={`${r.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${r.nama_mitra}`}
                          className={`rounded-lg border p-2 transition ${
                            r.is_active
                              ? 'border-rose-200 text-rose-500 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================
          MODAL DETAIL (INFO + HARGA BELI)
      ================================================== */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.nama_mitra || 'Detail Yayasan'}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Memuat detail...
          </div>
        ) : !detail ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {detailError || 'Data yayasan tidak ditemukan.'}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Ringkasan */}
            <div className="flex items-center justify-between gap-3">
              <ActiveBadge active={detail.is_active} />
              <p className="text-xs text-slate-400">
                Harga terisi{' '}
                <b className="text-slate-700">
                  {hargaTerisi}/{jenis.length}
                </b>{' '}
                jenis sampah
              </p>
            </div>

            {/* Tab */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { key: 'info', label: 'Informasi' },
                { key: 'harga', label: 'Harga Beli' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
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
                  <InfoRow icon={UserRound} label="Penanggung Jawab">
                    {detail.nama_penanggung_jawab || '-'}
                  </InfoRow>
                  <InfoRow icon={Phone} label="No Handphone">
                    {detail.no_hp || '-'}
                  </InfoRow>
                  <InfoRow icon={Mail} label="Email">
                    {detail.email || '-'}
                  </InfoRow>
                  <InfoRow icon={CalendarDays} label="Ditambahkan">
                    {formatDate(detail.tanggal_ditambahkan)}
                  </InfoRow>
                </div>

                <InfoRow icon={MapPin} label="Alamat">
                  {detail.alamat || '-'}
                </InfoRow>

                <InfoRow icon={Info} label="Deskripsi">
                  {detail.deskripsi || '-'}
                </InfoRow>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button
                    onClick={() => openDelete(detail)}
                    className="flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 size={16} />
                    Hapus
                  </button>
                  <button
                    onClick={() => openStatusDialog(detail)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Power size={16} />
                    {detail.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button
                    onClick={() => openEdit(detail)}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Pencil size={16} />
                    Edit Data
                  </button>
                </div>
              </>
            ) : jenis.length === 0 ? (
              <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">
                Belum ada jenis sampah. Tambahkan dulu di menu Database Sampah.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Progress kelengkapan */}
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600">Kelengkapan harga beli</span>
                    <span className="text-slate-400">
                      {hargaTerisi} dari {jenis.length} jenis
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(hargaTerisi / jenis.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    Isi harga per kategori lewat kolom "Semua", lalu sesuaikan per jenis bila
                    perlu. Tekan Enter atau tombol centang untuk menyimpan.
                  </p>
                </div>

                {groups.map((g) => {
                  const filled = g.items.filter((i) => hargaMap.has(i.id_jenis)).length
                  return (
                    <div key={g.key} className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-black text-slate-800">{g.label}</p>
                          <p className="text-xs text-slate-400">
                            {filled}/{g.items.length} jenis terisi
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400">Semua</span>
                          <PriceInput
                            value={bulk[g.key] ?? ''}
                            onChange={(v) => setBulk((b) => ({ ...b, [g.key]: v }))}
                            onEnter={() => applyBulk(g)}
                          />
                          <button
                            type="button"
                            onClick={() => applyBulk(g)}
                            disabled={bulkSaving === g.key || !(Number(bulk[g.key]) > 0)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {bulkSaving === g.key && (
                              <Loader2 size={12} className="animate-spin" />
                            )}
                            Terapkan
                          </button>
                        </div>
                      </div>

                      <ul>
                        {g.items.map((item) => (
                          <HargaRow
                            key={item.id_jenis}
                            item={item}
                            existing={hargaMap.get(item.id_jenis)}
                            value={draftValue(item)}
                            dirty={isDirty(item)}
                            saving={!!rowSaving[item.id_jenis]}
                            onChange={(v) =>
                              setDrafts((d) => ({ ...d, [item.id_jenis]: v }))
                            }
                            onSave={() => saveHarga(item)}
                            onRemove={() => removeHarga(item)}
                          />
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ==================================================
          MODAL FORM TAMBAH / EDIT
      ================================================== */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editing ? 'Edit Data Yayasan' : 'Tambah Yayasan'}
      >
        {step === 1 ? (
          <form onSubmit={editing ? submitEdit : nextStep} className="space-y-4">
            {!editing && (
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Langkah 1 dari 2 · Informasi yayasan
              </p>
            )}

            <ErrorBox>{formError}</ErrorBox>

            <Field label="Nama Yayasan">
              <input
                value={form.nama_mitra}
                onChange={(e) => setForm({ ...form, nama_mitra: e.target.value })}
                placeholder="Contoh: Yayasan Hijau Lestari"
                className={inputCls}
                autoFocus
              />
            </Field>

            <Field label="Penanggung Jawab">
              <input
                value={form.nama_penanggung_jawab}
                onChange={(e) => setForm({ ...form, nama_penanggung_jawab: e.target.value })}
                placeholder="Nama kontak di pihak yayasan"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="No Handphone" hint="Contoh: 081234567890">
                <input
                  value={form.no_hp}
                  onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                  inputMode="tel"
                  className={inputCls}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="yayasan@email.com"
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Alamat">
              <textarea
                value={form.alamat}
                onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field label="Deskripsi / Lokasi">
              <textarea
                value={form.deskripsi}
                onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                rows={2}
                placeholder="Catatan tambahan, misal kecamatan atau jenis kerjasama"
                className={`${inputCls} resize-none`}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
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
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editing ? (
                  <Save size={16} />
                ) : null}
                {editing ? 'Simpan Perubahan' : 'Lanjut'}
              </button>
            </div>
          </form>
        ) : (
          /* ---------- LANGKAH 2: HARGA DEFAULT PER KATEGORI ---------- */
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Langkah 2 dari 2 · Harga beli default per kategori
            </p>

            <p className="text-sm text-slate-600">
              Isi harga per kategori, nanti otomatis diterapkan ke semua jenis sampah di
              kategori itu. Kategori yang dikosongkan dilewati, dan harga per jenis tetap bisa
              diubah setelah yayasan dibuat.
            </p>

            <ErrorBox>{formError}</ErrorBox>

            {groups.length === 0 ? (
              <p className="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">
                Belum ada jenis sampah. Yayasan tetap bisa disimpan, harga diatur nanti.
              </p>
            ) : (
              <ul className="space-y-2">
                {groups.map((g) => {
                  const prices = g.items.map((i) => Number(i.harga_per_kg))
                  const min = Math.min(...prices)
                  const max = Math.max(...prices)
                  return (
                    <li
                      key={g.key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800">{g.label}</p>
                        <p className="text-xs text-slate-400">
                          {g.items.length} jenis · harga ke nasabah{' '}
                          {min === max ? rupiah(min) : `${rupiah(min)}–${rupiah(max)}`}/kg
                        </p>
                      </div>
                      <PriceInput
                        value={katPrices[g.key] ?? ''}
                        onChange={(v) => setKatPrices((p) => ({ ...p, [g.key]: v }))}
                        width="w-32"
                      />
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={saving}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Simpan Yayasan
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================
          MODAL KONFIRMASI STATUS
      ================================================== */}
      <Modal
        open={!!statusTarget}
        onClose={closeStatusDialog}
        title={statusTarget?.is_active ? 'Nonaktifkan Kerjasama' : 'Aktifkan Kerjasama'}
      >
        {statusTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                <Building2 size={18} />
              </div>
              <p className="truncate font-bold text-slate-800">{statusTarget.nama_mitra}</p>
            </div>

            <p className="text-sm text-slate-600">
              {statusTarget.is_active
                ? 'Yayasan yang dinonaktifkan tidak bisa dipilih untuk mencatat penjualan sampah. Data dan harganya tetap tersimpan.'
                : 'Yayasan akan kembali bisa dipilih untuk mencatat penjualan sampah.'}
            </p>

            <ErrorBox>{statusError}</ErrorBox>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeStatusDialog}
                disabled={statusSaving}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={submitStatus}
                disabled={statusSaving}
                className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  statusTarget.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {statusSaving && <Loader2 size={16} className="animate-spin" />}
                {statusTarget.is_active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================================================
          MODAL HAPUS
      ================================================== */}
      <Modal open={!!deleteTarget} onClose={closeDelete} title="Hapus Yayasan">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={18} />
              </div>
              <p className="truncate font-bold text-slate-800">{deleteTarget.nama_mitra}</p>
            </div>

            <p className="text-sm text-slate-600">
              Yayasan beserta seluruh harga belinya akan dihapus permanen. Jika yayasan sudah
              punya riwayat penjualan, penghapusan bisa gagal. Gunakan "Nonaktifkan" untuk
              menghentikan kerjasama tanpa menghapus data.
            </p>

            <ErrorBox>{deleteError}</ErrorBox>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={submitDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting && <Loader2 size={16} className="animate-spin" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
