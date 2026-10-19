import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  ImageOff,
  Loader2,
  RefreshCw,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { API, getAuthHeaders, parseResponse } from "../api";
import { parseWaktu } from "../utils/waktu";

const MAX_FILE_MB = 5; // sama dengan batas di backend
const PAGE_SIZE = 50;

// ---------- helper ----------
const rupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function formatTanggal(value) {
  if (!value) return "-";
  const d = parseWaktu(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lamaMenunggu(value) {
  const d = parseWaktu(value);
  const menit = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (Number.isNaN(menit)) return "";
  if (menit < 60) return `${menit} menit`;
  if (menit < 60 * 24) return `${Math.floor(menit / 60)} jam`;
  return `${Math.floor(menit / (60 * 24))} hari`;
}

const STATUS = {
  menunggu: { label: "Menunggu", cls: "bg-amber-100 text-amber-800" },
  selesai: { label: "Selesai", cls: "bg-emerald-100 text-emerald-800" },
  ditolak: { label: "Ditolak", cls: "bg-red-100 text-red-700" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-600" },
  disetujui: { label: "Disetujui", cls: "bg-sky-100 text-sky-700" },
};

function Badge({ status }) {
  const s = STATUS[status] || { label: status, cls: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

async function fetchList(params) {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`${API.penarikanAdmin}?${qs}`, {
    headers: getAuthHeaders(),
  });
  return parseResponse(response); // { total, data: [...] }
}

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="break-words text-right font-semibold text-slate-800">{children}</span>
    </div>
  );
}

// Bukti transfer butuh header Authorization, jadi tidak bisa lewat <img src> langsung:
// diambil sebagai blob lalu ditampilkan.
function BuktiTransfer({ id }) {
  const [src, setSrc] = useState("");
  const [state, setState] = useState("loading"); // loading | ok | none

  useEffect(() => {
    let url = "";
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(API.penarikanAdminBukti(id), {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("no file");
        const blob = await response.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
        setState("ok");
      } catch {
        if (!cancelled) setState("none");
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (state === "loading")
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" />;
  if (state === "none")
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400">
        <ImageOff size={22} />
        Bukti transfer tidak tersedia
      </div>
    );
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Klik untuk buka ukuran penuh">
      <img
        src={src}
        alt="Bukti transfer"
        className="max-h-80 w-full rounded-xl border border-slate-200 object-contain"
      />
    </a>
  );
}

// ---------- modal proses (konfirmasi / tolak) ----------
function ProsesModal({ item, onClose, onDone }) {
  const [mode, setMode] = useState("selesai"); // selesai | tolak
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [catatan, setCatatan] = useState("");
  const [alasan, setAlasan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(e) {
    const f = e.target.files?.[0];
    setError("");
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("File harus berupa gambar JPG, PNG, atau WEBP.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ukuran file maksimal ${MAX_FILE_MB} MB.`);
      return;
    }
    setFile(f);
  }

  async function submit() {
    setError("");
    try {
      setSaving(true);
      let response;
      if (mode === "selesai") {
        if (!file) {
          setError("Screenshot bukti transfer wajib diunggah.");
          return;
        }
        const form = new FormData();
        form.append("bukti_transfer", file);
        if (catatan.trim()) form.append("catatan", catatan.trim());
        // JANGAN set Content-Type manual: browser mengisi boundary multipart sendiri
        response = await fetch(API.penarikanAdminSelesai(item.id_penarikan), {
          method: "POST",
          headers: getAuthHeaders(),
          body: form,
        });
      } else {
        if (alasan.trim().length < 5) {
          setError("Alasan penolakan minimal 5 karakter.");
          return;
        }
        response = await fetch(API.penarikanAdminTolak(item.id_penarikan), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ alasan: alasan.trim() }),
        });
      }
      await parseResponse(response);
      onDone();
    } catch (err) {
      setError(err.message || "Gagal memproses pengajuan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={saving ? () => {} : onClose} title="Proses Penarikan">
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
        <Row label="Nasabah">{item.nama_nasabah || "-"}</Row>
        <Row label="NIK">{item.nik}</Row>
        <Row label="Jumlah">
          <span className="text-lg text-emerald-700">{rupiah(item.jumlah)}</span>
        </Row>
        <Row label="Bank">{item.nama_bank}</Row>
        <Row label="No. Rekening">{item.no_rekening}</Row>
        <Row label="Atas Nama">{item.nama_pemilik_rekening}</Row>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-bold">
        {[
          ["selesai", "Konfirmasi Transfer"],
          ["tolak", "Tolak"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setError("");
            }}
            className={`rounded-lg py-2 transition ${
              mode === id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {mode === "selesai" ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-500">
            Transfer manual dulu ke rekening di atas, lalu unggah screenshot buktinya.
            Tanpa bukti, pengajuan tidak bisa diselesaikan.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={pickFile}
            className="hidden"
          />
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Pratinjau bukti"
                className="max-h-64 w-full rounded-xl border border-slate-200 object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="absolute right-2 top-2 rounded-full bg-white p-1.5 shadow"
                aria-label="Hapus file"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600"
            >
              <Upload size={22} />
              Pilih screenshot bukti transfer
              <span className="text-xs font-normal">JPG / PNG / WEBP, maks {MAX_FILE_MB} MB</span>
            </button>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Catatan (opsional)
            </label>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Alasan penolakan (dilihat nasabah)
          </label>
          <textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-red-400"
          />
          <p className="mt-1 text-xs text-slate-400">
            Saldo nasabah otomatis dikembalikan saat pengajuan ditolak.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || (mode === "selesai" && !file)}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === "selesai" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {mode === "selesai" ? "Konfirmasi Selesai" : "Tolak Pengajuan"}
        </button>
      </div>
    </Modal>
  );
}

// ---------- modal detail (riwayat) ----------
function DetailModal({ item, onClose }) {
  return (
    <Modal open onClose={onClose} title={`Detail Penarikan #${item.id_penarikan}`}>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
        <Row label="Status">
          <Badge status={item.status} />
        </Row>
        <Row label="Nasabah">{item.nama_nasabah || "-"}</Row>
        <Row label="NIK">{item.nik}</Row>
        <Row label="No. HP">{item.no_hp_nasabah || "-"}</Row>
        <Row label="Jumlah">{rupiah(item.jumlah)}</Row>
        <Row label="Rekening">
          {item.nama_bank} · {item.no_rekening}
        </Row>
        <Row label="Atas Nama">{item.nama_pemilik_rekening}</Row>
        <Row label="Diajukan">{formatTanggal(item.tanggal_pengajuan)}</Row>
        <Row label="Diproses">{formatTanggal(item.tanggal_diproses)}</Row>
        <Row label="Diproses oleh">{item.diproses_oleh || "-"}</Row>
        {item.keterangan && (
          <Row label={item.status === "ditolak" ? "Alasan" : "Catatan"}>{item.keterangan}</Row>
        )}
      </div>

      {item.status === "selesai" && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-slate-700">Bukti Transfer</p>
          <BuktiTransfer id={item.id_penarikan} />
        </div>
      )}
    </Modal>
  );
}

// ---------- halaman ----------
export default function Penarikan() {
  const [tab, setTab] = useState("antrean"); // antrean | riwayat
  const [riwayatStatus, setRiwayatStatus] = useState("selesai");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [proses, setProses] = useState(null);
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState("");

  const status = tab === "antrean" ? "menunggu" : riwayatStatus;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Untuk status "menunggu" backend mengurutkan dari yang PALING LAMA (FIFO)
      const res = await fetchList({ status, limit: PAGE_SIZE, offset: 0 });
      setRows(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err.message || "Gagal memuat data penarikan.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetchList({ status, limit: PAGE_SIZE, offset: rows.length });
      setRows((prev) => [...prev, ...(res?.data || [])]);
    } catch (err) {
      setError(err.message || "Gagal memuat data.");
    } finally {
      setLoadingMore(false);
    }
  }

  function copy(text, key) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  const totalNominal = rows.reduce((s, r) => s + (Number(r.jumlah) || 0), 0);

  return (
    <div>
      <PageHeader
        title="Penarikan Saldo"
        action={
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Muat ulang
          </button>
        }
      />

      {/* Tab */}
      <div className="mb-5 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
        {[
          ["antrean", "Antrean"],
          ["riwayat", "Riwayat"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-6 py-2 transition ${
              tab === id ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "antrean" ? (
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock3 size={19} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Menunggu diproses</p>
              <p className="font-['Poppins'] text-xl font-bold text-slate-800">{total} pengajuan</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet size={19} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Total nominal antrean</p>
              <p className="font-['Poppins'] text-xl font-bold text-slate-800">{rupiah(totalNominal)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-3">
          <label className="text-sm font-bold text-slate-600">Status</label>
          <select
            value={riwayatStatus}
            onChange={(e) => setRiwayatStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
          >
            <option value="selesai">Selesai (sudah ditransfer)</option>
            <option value="ditolak">Ditolak</option>
            <option value="dibatalkan">Dibatalkan nasabah</option>
          </select>
          <span className="text-sm text-slate-400">{total} data</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
            <tr>
              {tab === "antrean" && <th className="px-5 py-4">#</th>}
              <th className="px-5 py-4">Nasabah</th>
              <th className="px-5 py-4">Diajukan</th>
              <th className="px-5 py-4">Jumlah</th>
              <th className="px-5 py-4">Rekening Tujuan</th>
              {tab === "riwayat" && <th className="px-5 py-4">Diproses oleh</th>}
              <th className="px-5 py-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto animate-spin" />
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  {tab === "antrean" ? "Tidak ada pengajuan yang menunggu" : "Belum ada data."}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r, i) => (
                <tr key={r.id_penarikan} className="align-top hover:bg-slate-50/60">
                  {tab === "antrean" && (
                    <td className="px-5 py-4 font-bold text-slate-400">{i + 1}</td>
                  )}
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{r.nama_nasabah || "-"}</p>
                    <p className="text-xs text-slate-400">{r.nik}</p>
                    <p className="text-xs text-slate-400">{r.no_hp_nasabah}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p>{formatTanggal(r.tanggal_pengajuan)}</p>
                    {tab === "antrean" && (
                      <p className="text-xs font-semibold text-amber-600">
                        menunggu {lamaMenunggu(r.tanggal_pengajuan)}
                      </p>
                    )}
                    {tab === "riwayat" && (
                      <p className="mt-1">
                        <Badge status={r.status} />
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 font-bold text-emerald-700">{rupiah(r.jumlah)}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold">{r.nama_bank}</p>
                    <button
                      type="button"
                      onClick={() => copy(r.no_rekening, `${r.id_penarikan}`)}
                      className="mt-0.5 flex items-center gap-1.5 text-slate-600 hover:text-emerald-600"
                      title="Salin nomor rekening"
                    >
                      {r.no_rekening}
                      {copied === `${r.id_penarikan}` ? (
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <p className="text-xs text-slate-400">a.n. {r.nama_pemilik_rekening}</p>
                  </td>
                  {tab === "riwayat" && (
                    <td className="px-5 py-4">
                      <p className="font-semibold">{r.diproses_oleh || "-"}</p>
                      <p className="text-xs text-slate-400">{formatTanggal(r.tanggal_diproses)}</p>
                    </td>
                  )}
                  <td className="px-5 py-4">
                    {tab === "antrean" ? (
                      <button
                        type="button"
                        onClick={() => setProses(r)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Proses
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Detail
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && rows.length < total && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? "Memuat..." : `Muat lebih banyak (${rows.length}/${total})`}
          </button>
        </div>
      )}

      {proses && (
        <ProsesModal
          item={proses}
          onClose={() => setProses(null)}
          onDone={() => {
            setProses(null);
            load();
          }}
        />
      )}
      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
