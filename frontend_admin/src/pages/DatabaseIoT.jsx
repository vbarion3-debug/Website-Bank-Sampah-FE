import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { API, getAuthHeaders, parseResponse } from "../api";
import { parseWaktu } from "../utils/waktu";

const REFRESH_MS = 10000;

const STATUS = {
  tersambung: { label: "Tersambung", dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700" },
  dipakai: { label: "Sedang dipakai", dot: "bg-amber-500", pill: "bg-amber-50 text-amber-700" },
  offline: { label: "Offline", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-500" },
  nonaktif: { label: "Nonaktif", dot: "bg-slate-400", pill: "bg-slate-100 text-slate-500" },
};

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function terakhirTerlihat(iso) {
  if (!iso) return "Belum pernah terhubung";
  const detik = Math.max(0, Math.round((Date.now() - parseWaktu(iso).getTime()) / 1000));
  if (detik < 60) return `${detik} detik lalu`;
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  return parseWaktu(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FORM_KOSONG = { machine_id: "", nama: "", lokasi: "", is_active: true };

export default function DatabaseIoT() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // machine_id yang diedit, null = tambah baru
  const [form, setForm] = useState(FORM_KOSONG);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const muat = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(API.iotPerangkat, { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      setList(Array.isArray(result) ? result : []);
      if (!silent) setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Gagal memuat daftar alat.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(() => muat(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [muat]);

  function bukaTambah() {
    setEditing(null);
    setForm(FORM_KOSONG);
    setFormError("");
    setModalOpen(true);
  }

  function bukaEdit(p) {
    setEditing(p.machine_id);
    setForm({ machine_id: p.machine_id, nama: p.nama, lokasi: p.lokasi || "", is_active: p.is_active });
    setFormError("");
    setModalOpen(true);
  }

  async function simpan() {
    setFormError("");
    if (!form.machine_id.trim() || !form.nama.trim()) {
      setFormError("Machine ID dan nama alat wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      const body = editing
        ? { nama: form.nama, lokasi: form.lokasi, is_active: form.is_active }
        : form;
      const response = await fetch(editing ? API.iotPerangkatDetail(editing) : API.iotPerangkat, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      await parseResponse(response);
      setModalOpen(false);
      setSuccess(editing ? "Alat berhasil diperbarui." : "Alat berhasil ditambahkan.");
      await muat(true);
    } catch (err) {
      setFormError(err.message || "Gagal menyimpan alat.");
    } finally {
      setSaving(false);
    }
  }

  async function hapus(p) {
    if (!window.confirm(`Hapus alat "${p.nama}"? Alat ini tidak bisa mengirim data lagi sampai didaftarkan ulang.`)) return;
    try {
      const response = await fetch(API.iotPerangkatDetail(p.machine_id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
      setSuccess("Alat berhasil dihapus.");
      await muat(true);
    } catch (err) {
      setError(err.message || "Gagal menghapus alat.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader
        title="Database IoT"
        action={
          <button
            type="button"
            onClick={bukaTambah}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            <Plus size={16} />
            Tambah Alat
          </button>
        }
      />

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={15} className="shrink-0" />
          {success}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="font-['Poppins'] text-lg font-bold text-slate-800">Daftar Alat</h2>
            <p className="mt-1 text-xs text-slate-500">
              Status diperbarui otomatis. Alat dianggap tersambung bila mengirim sinyal dalam 30 detik terakhir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => muat()}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-600"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Segarkan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-100 text-xs font-bold text-slate-500">
              <tr>
                <th className="px-5 py-4">Alat</th>
                <th className="px-5 py-4">Lokasi</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Terakhir terlihat</th>
                <th className="px-5 py-4">Dipakai oleh</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && list.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              )}
              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                    Belum ada alat. Klik Tambah Alat, lalu masukkan machine_id yang sama dengan yang dikirim tim IoT.
                  </td>
                </tr>
              )}
              {list.map((p) => (
                <tr key={p.machine_id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Cpu size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{p.nama}</p>
                        <p className="truncate font-mono text-[11px] text-slate-400">{p.machine_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{p.lokasi || "-"}</td>
                  <td className="px-5 py-4">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-5 py-4 text-slate-500">{terakhirTerlihat(p.last_seen)}</td>
                  <td className="px-5 py-4 text-slate-600">
                    {p.status === "dipakai" ? p.nama_pemakai || p.nik_pemakai : "-"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => bukaEdit(p)}
                        title="Edit"
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => hapus(p)}
                        title="Hapus"
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Alat" : "Tambah Alat"}
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              <AlertCircle size={15} className="shrink-0" />
              {formError}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Machine ID</span>
            <input
              type="text"
              value={form.machine_id}
              disabled={Boolean(editing)}
              maxLength={50}
              onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
              placeholder="Sama persis dengan machine_id dari alat, mis. BSM-01"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
            {editing && (
              <span className="mt-1 block text-xs text-slate-400">
                Machine ID tidak bisa diubah. Hapus dan daftarkan ulang bila perlu.
              </span>
            )}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Nama alat</span>
            <input
              type="text"
              value={form.nama}
              maxLength={100}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="mis. Timbangan Pos 1"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-700">Lokasi (opsional)</span>
            <input
              type="text"
              value={form.lokasi}
              maxLength={150}
              onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
              placeholder="mis. Bank sampah RW 05"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Alat aktif (bisa dipilih untuk transaksi)
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Simpan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
