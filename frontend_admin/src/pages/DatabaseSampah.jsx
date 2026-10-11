import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  RefreshCw,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Recycle,
  Tags,
  Cpu,
  Save,
} from 'lucide-react'

import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { API, getAuthHeaders } from '../api'

// ======================================================
// HELPER
// ======================================================

const rupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

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

const SORTS = [
  { key: 'nama', label: 'Nama (A–Z)' },
  { key: 'harga_desc', label: 'Harga tertinggi' },
  { key: 'harga_asc', label: 'Harga terendah' },
]

const EMPTY_FORM = { nama_jenis: '', kategori: '', harga_per_kg: '', kode_ml: '' }

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

// ======================================================
// KOMPONEN KECIL
// ======================================================

function StatCard({ icon: Icon, label, value, tone, hint }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
  }
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-black text-slate-800">{value}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
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

// ======================================================
// DATABASE SAMPAH
// ======================================================

export default function DatabaseSampah() {
  // -----------------------------
  // LIST
  // -----------------------------
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [q, setQ] = useState('')
  const [kategoriFilter, setKategoriFilter] = useState('')
  const [sort, setSort] = useState('nama')

  // -----------------------------
  // MODAL TAMBAH / EDIT
  // -----------------------------
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null) // objek jenis sampah, atau null = tambah baru
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // -----------------------------
  // EDIT HARGA INLINE
  // -----------------------------
  const [inlineId, setInlineId] = useState(null)
  const [inlineValue, setInlineValue] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)

  // -----------------------------
  // HAPUS
  // -----------------------------
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
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  // ======================================================
  // GET SEMUA  ->  GET /jenis-sampah/
  // ======================================================

  const getJenis = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await request(API.jenisSampah)
      setRows(Array.isArray(result) ? result : result?.data || [])
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getJenis()
  }, [getJenis])

  // ======================================================
  // DATA TURUNAN
  // ======================================================

  const kategoriList = useMemo(
    () =>
      [...new Set(rows.map((r) => r.kategori).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'id')
      ),
    [rows]
  )

  const stats = useMemo(
    () => ({
      total: rows.length,
      kategori: kategoriList.length,
      belumML: rows.filter((r) => !r.kode_ml).length,
    }),
    [rows, kategoriList]
  )

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (kategoriFilter && r.kategori !== kategoriFilter) return false
      if (!term) return true
      return [r.nama_jenis, r.kategori, r.kode_ml].some((v) =>
        String(v || '').toLowerCase().includes(term)
      )
    })
    return list.sort((a, b) => {
      if (sort === 'harga_desc') return Number(b.harga_per_kg) - Number(a.harga_per_kg)
      if (sort === 'harga_asc') return Number(a.harga_per_kg) - Number(b.harga_per_kg)
      return String(a.nama_jenis).localeCompare(String(b.nama_jenis), 'id')
    })
  }, [rows, q, kategoriFilter, sort])

  // ======================================================
  // MODAL TAMBAH / EDIT
  // ======================================================

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      nama_jenis: row.nama_jenis ?? '',
      kategori: row.kategori ?? '',
      harga_per_kg: String(Number(row.harga_per_kg)),
      kode_ml: row.kode_ml ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (!saving) setModalOpen(false)
  }

  // Backend tidak mengecek duplikat nama saat edit & kode_ml (kolom unique -> error 500),
  // jadi dicek di sini sebelum dikirim.
  const validate = () => {
    const nama = form.nama_jenis.trim()
    const kode = form.kode_ml.trim()
    const harga = Number(form.harga_per_kg)
    const others = rows.filter((r) => r.id_jenis !== editing?.id_jenis)

    if (nama.length < 2) return 'Nama jenis minimal 2 karakter.'
    if (nama.length > 100) return 'Nama jenis maksimal 100 karakter.'
    if (!(harga > 0)) return 'Harga per kg harus lebih dari 0.'
    if (form.kategori.trim().length > 50) return 'Kategori maksimal 50 karakter.'
    if (kode.length > 50) return 'Kode ML maksimal 50 karakter.'
    if (others.some((r) => r.nama_jenis.trim().toLowerCase() === nama.toLowerCase()))
      return 'Jenis sampah dengan nama ini sudah ada.'
    if (kode && others.some((r) => r.kode_ml === kode))
      return `Kode ML "${kode}" sudah dipakai jenis sampah lain.`
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const invalid = validate()
    if (invalid) {
      setFormError(invalid)
      return
    }

    const nama = form.nama_jenis.trim()
    const kategori = form.kategori.trim()
    const kode = form.kode_ml.trim()
    const harga = Number(form.harga_per_kg)

    setSaving(true)
    setFormError('')

    try {
      if (editing) {
        // PUT partial: kirim hanya field yang berubah. Kosong -> null (hapus nilai)
        const payload = {}
        if (nama !== editing.nama_jenis) payload.nama_jenis = nama
        if (kategori !== (editing.kategori ?? '')) payload.kategori = kategori || null
        if (harga !== Number(editing.harga_per_kg)) payload.harga_per_kg = harga
        if (kode !== (editing.kode_ml ?? '')) payload.kode_ml = kode || null

        if (Object.keys(payload).length === 0) {
          setModalOpen(false)
          return
        }

        await request(API.updateJenisSampah(editing.id_jenis), {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showToast('success', `"${nama}" berhasil diperbarui.`)
      } else {
        const payload = { nama_jenis: nama, harga_per_kg: harga }
        if (kategori) payload.kategori = kategori
        if (kode) payload.kode_ml = kode

        await request(API.createJenisSampah, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        showToast('success', `"${nama}" berhasil ditambahkan.`)
      }

      setModalOpen(false)
      getJenis()
    } catch (err) {
      console.error(err)
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ======================================================
  // EDIT HARGA INLINE  ->  PUT /jenis-sampah/{id}  { harga_per_kg }
  // ======================================================

  const startInline = (row) => {
    setInlineId(row.id_jenis)
    setInlineValue(String(Number(row.harga_per_kg)))
  }

  const cancelInline = () => {
    if (!inlineSaving) setInlineId(null)
  }

  const saveInline = async (e) => {
    e.preventDefault()
    const row = rows.find((r) => r.id_jenis === inlineId)
    if (!row) return

    const harga = Number(inlineValue)
    if (!(harga > 0)) {
      showToast('error', 'Harga harus lebih dari 0.')
      return
    }
    if (harga === Number(row.harga_per_kg)) {
      setInlineId(null)
      return
    }

    setInlineSaving(true)
    try {
      const updated = await request(API.updateJenisSampah(row.id_jenis), {
        method: 'PUT',
        body: JSON.stringify({ harga_per_kg: harga }),
      })
      setRows((prev) => prev.map((r) => (r.id_jenis === updated.id_jenis ? updated : r)))
      showToast('success', `Harga ${row.nama_jenis} diubah menjadi ${rupiah(harga)}/kg.`)
      setInlineId(null)
    } catch (err) {
      console.error(err)
      showToast('error', err.message)
    } finally {
      setInlineSaving(false)
    }
  }

  // ======================================================
  // HAPUS  ->  DELETE /jenis-sampah/{id}
  // ======================================================

  const openDelete = (row) => {
    setDeleteTarget(row)
    setDeleteError('')
  }

  const closeDelete = () => {
    if (!deleting) setDeleteTarget(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await request(API.deleteJenisSampah(deleteTarget.id_jenis), { method: 'DELETE' })
      showToast('success', `"${deleteTarget.nama_jenis}" berhasil dihapus.`)
      setDeleteTarget(null)
      getJenis()
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
        title="Database Sampah"
        action={
          <div className="flex flex-wrap gap-3">
            <button
              onClick={getJenis}
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
              Tambah Jenis Sampah
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
        <StatCard icon={Recycle} label="Jenis Sampah" value={stats.total} tone="emerald" />
        <StatCard icon={Tags} label="Kategori" value={stats.kategori} tone="slate" />
        <StatCard
          icon={Cpu}
          label="Belum Terpetakan ML"
          value={stats.belumML}
          tone="amber"
          hint={stats.belumML > 0 ? 'Belum punya Kode ML' : 'Semua sudah terpetakan'}
        />
      </div>

      {/* ================= ERROR ================= */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span className="flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button onClick={getJenis} className="font-bold underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {/* ================= TOOLBAR ================= */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
          <Search size={18} className="text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, kategori, atau kode ML..."
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

        <div className="flex flex-wrap gap-3">
          <select
            value={kategoriFilter}
            onChange={(e) => setKategoriFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-emerald-500"
          >
            <option value="">Semua Kategori</option>
            {kategoriList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 outline-none focus:border-emerald-500"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= TABEL ================= */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            Memuat data sampah...
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-slate-400">
            <Recycle size={36} className="text-slate-300" />
            {rows.length === 0
              ? 'Belum ada jenis sampah. Klik "Tambah Jenis Sampah" untuk memulai.'
              : 'Tidak ada jenis sampah yang cocok.'}
          </div>
        ) : (
          <div className={`overflow-x-auto transition ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Jenis Sampah</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4 text-right">Harga / kg</th>
                  <th className="px-6 py-4">Kode ML</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id_jenis}
                    className="border-t border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{r.nama_jenis}</p>
                      <p className="text-xs text-slate-400">ID #{r.id_jenis}</p>
                    </td>

                    <td className="px-6 py-4">
                      {r.kategori ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                          {r.kategori}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {inlineId === r.id_jenis ? (
                        <form
                          onSubmit={saveInline}
                          className="flex items-center justify-end gap-1.5"
                        >
                          <span className="text-xs text-slate-400">Rp</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            autoFocus
                            value={inlineValue}
                            onChange={(e) => setInlineValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && cancelInline()}
                            className="w-28 rounded-lg border border-emerald-500 px-3 py-1.5 text-right text-sm font-bold outline-none ring-2 ring-emerald-100"
                          />
                          <button
                            type="submit"
                            disabled={inlineSaving}
                            aria-label="Simpan harga"
                            className="rounded-lg bg-emerald-600 p-2 text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {inlineSaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelInline}
                            aria-label="Batal"
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
                          >
                            <X size={14} />
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => startInline(r)}
                          title="Klik untuk ubah harga"
                          className="group inline-flex items-center gap-2 rounded-lg px-2 py-1 font-bold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          {rupiah(r.harga_per_kg)}
                          <Pencil
                            size={13}
                            className="text-emerald-500 opacity-0 transition group-hover:opacity-100"
                          />
                        </button>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {r.kode_ml ? (
                        <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                          {r.kode_ml}
                        </code>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                          <AlertTriangle size={11} />
                          Belum diisi
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-2 text-sm font-bold text-emerald-600 transition hover:bg-emerald-50"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(r)}
                          title="Hapus"
                          aria-label={`Hapus ${r.nama_jenis}`}
                          className="rounded-lg border border-rose-200 p-2 text-rose-500 transition hover:bg-rose-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
            Menampilkan {visible.length} dari {rows.length} jenis sampah · Klik harga untuk
            mengubahnya langsung.
          </div>
        )}
      </div>

      {/* ==================================================
          MODAL TAMBAH / EDIT
      ================================================== */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Jenis Sampah' : 'Tambah Jenis Sampah'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <ErrorBox>{formError}</ErrorBox>

          <Field label="Nama Jenis">
            <input
              value={form.nama_jenis}
              onChange={(e) => setForm({ ...form, nama_jenis: e.target.value })}
              placeholder="Contoh: Plastik PET"
              className={inputCls}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Kategori (opsional)">
              <input
                list="kategori-options"
                value={form.kategori}
                onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                placeholder="Contoh: Plastik"
                className={inputCls}
              />
              <datalist id="kategori-options">
                {kategoriList.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>
            </Field>

            <Field
              label="Harga per kg (Rp)"
              hint={editing ? 'Hanya berlaku untuk transaksi baru.' : undefined}
            >
              <input
                type="number"
                min="0"
                step="any"
                value={form.harga_per_kg}
                onChange={(e) => setForm({ ...form, harga_per_kg: e.target.value })}
                placeholder="3000"
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label="Kode ML (opsional)"
            hint="Harus sama persis dengan label dari model ML, contoh: metal_can. Tanpa ini, hasil deteksi mesin masuk ke antrean review."
          >
            <input
              value={form.kode_ml}
              onChange={(e) => setForm({ ...form, kode_ml: e.target.value })}
              placeholder="metal_can"
              className={`${inputCls} font-mono`}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeModal}
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
              {editing ? 'Simpan Perubahan' : 'Tambah'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================================================
          MODAL HAPUS
      ================================================== */}
      <Modal open={!!deleteTarget} onClose={closeDelete} title="Hapus Jenis Sampah">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">{deleteTarget.nama_jenis}</p>
                <p className="text-xs text-slate-500">
                  {deleteTarget.kategori || 'Tanpa kategori'} ·{' '}
                  {rupiah(deleteTarget.harga_per_kg)}/kg
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Jenis sampah yang sudah pernah dipakai di transaksi tidak bisa dihapus agar
              riwayat tetap utuh. Dalam kasus itu, cukup ubah harganya.
            </p>

            <ErrorBox>{deleteError}</ErrorBox>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Batal
              </button>
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
        )}
      </Modal>
    </div>
  )
}
