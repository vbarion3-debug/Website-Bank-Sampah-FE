import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  Receipt,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import {
  API,
  getAuthHeaders,
  parseResponse,
  formatTanggal,
  fetchBuktiTransfer,
} from "../api";
import { useData } from "../useData";
// Harus sama dengan MIN_PENARIKAN di backend (app/api/penarikan.py)
const MINIMUM_WITHDRAWAL = 10000;
const rupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const STATUS = {
  menunggu: { label: "Menunggu", cls: "bg-amber-50 text-amber-600" },
  disetujui: { label: "Disetujui", cls: "bg-sky-50 text-sky-600" },
  selesai: { label: "Selesai", cls: "bg-emerald-50 text-emerald-600" },
  ditolak: { label: "Ditolak", cls: "bg-red-50 text-red-600" },
  dibatalkan: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-500" },
};
// Dibuat di luar komponen supaya referensinya stabil untuk useData
async function fetchProfile() {
  const response = await fetch(API.profile, { headers: getAuthHeaders() });
  const result = await parseResponse(response);
  return result?.data ?? result ?? {};
}
async function fetchRiwayat() {
  const response = await fetch(API.penarikanHistory, { headers: getAuthHeaders() });
  const result = await parseResponse(response);
  return Array.isArray(result) ? result : result?.data ?? [];
}
export default function Placeholder({ onNavigate }) {
  const profile = useData(fetchProfile);
  const riwayat = useData(fetchRiwayat);
  const saldo = Number(profile.data?.saldo) || 0;
  const rekening = profile.data;
  const list = riwayat.data || [];
  const sedangMenunggu = list.some((p) => p.status === "menunggu");
  const [nominal, setNominal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelingId, setCancelingId] = useState(null);
  const [error, setError] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState(null);
  // Bukti transfer: { id, jumlah, loading, url, error }
  const [bukti, setBukti] = useState(null);
  const jumlahPreview = Number(nominal);
  const showPreview =
    Number.isFinite(jumlahPreview) &&
    jumlahPreview >= MINIMUM_WITHDRAWAL &&
    jumlahPreview <= saldo;
  function reloadAll() {
    profile.reload();
    riwayat.reload();
  }
  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const jumlah = Number(nominal);
    if (!Number.isFinite(jumlah) || jumlah < MINIMUM_WITHDRAWAL) {
      setError(`Minimal penarikan adalah ${rupiah(MINIMUM_WITHDRAWAL)}.`);
      return;
    }
    if (jumlah > saldo) {
      setError("Saldo kamu tidak mencukupi.");
      return;
    }
    try {
      setSubmitting(true);
      // Backend hanya butuh nominal; rekening tujuan diambil dari data nasabah di server.
      const response = await fetch(API.penarikan, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ jumlah }),
      });
      await parseResponse(response);
      setSubmittedAmount(jumlah);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleCancel(id) {
    setError("");
    try {
      setCancelingId(id);
      const response = await fetch(`${API.penarikanBase}/${id}/batal`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
      reloadAll(); // saldo dikembalikan oleh backend
    } catch (err) {
      setError(err.message || "Gagal membatalkan pengajuan.");
    } finally {
      setCancelingId(null);
    }
  }
  async function bukaBukti(p) {
    setBukti({ id: p.id_penarikan, jumlah: p.jumlah, loading: true, url: "", error: "" });
    try {
      const { url } = await fetchBuktiTransfer(p.id_penarikan);
      setBukti((prev) => (prev?.id === p.id_penarikan ? { ...prev, loading: false, url } : prev));
    } catch (err) {
      setBukti((prev) =>
        prev?.id === p.id_penarikan
          ? { ...prev, loading: false, error: err.message || "Gagal memuat bukti transfer." }
          : prev
      );
    }
  }
  function tutupBukti() {
    if (bukti?.url) URL.revokeObjectURL(bukti.url); // lepaskan memori blob
    setBukti(null);
  }
  // Bersihkan blob kalau halaman ditinggalkan saat bukti masih terbuka
  useEffect(() => () => { if (bukti?.url) URL.revokeObjectURL(bukti.url); }, [bukti?.url]);

  function handleSuccessOk() {
    setSubmittedAmount(null);
    setNominal("");
    setError("");
    reloadAll(); // saldo sudah dipotong (ditahan) oleh backend
  }
  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-700";
  return (
    <PhoneShell bottom={<BottomNav active="withdraw" onNavigate={onNavigate} />}>
      <div className="min-h-205 bg-slate-50 pb-24">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="font-poppins text-base font-bold text-emerald-900">
              Penarikan Saldo
            </h1>
            <p className="text-[11px] text-slate-400">
              Cairkan tabungan sampahmu ke rekening terdaftar
            </p>
          </div>
          <Wallet size={20} className="text-emerald-600" />
        </header>
        <main className="space-y-4 px-6 py-5">
          {/* Saldo */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">Saldo Tersedia</p>
            <p className="font-poppins text-xl font-bold text-emerald-600">
              {profile.loading && !profile.data ? "Memuat..." : rupiah(saldo)}
            </p>
            {profile.error && !profile.data && (
              <button
                type="button"
                onClick={profile.reload}
                className="mt-3 flex items-center gap-1 text-xs font-bold text-red-600 underline underline-offset-2"
              >
                <RefreshCw size={12} />
                {profile.error} Coba lagi
              </button>
            )}
          </section>
          {/* Rekening tujuan (dari data nasabah, tidak bisa diubah di sini) */}
          {rekening?.no_rekening && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">Rekening Tujuan</p>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {rekening.nama_bank} · {rekening.no_rekening}
              </p>
              <p className="text-xs text-slate-500">a.n. {rekening.nama_pemilik_rekening}</p>
              <button
                type="button"
                onClick={() => onNavigate("profile")}
                className="mt-2 text-[11px] font-bold text-emerald-600 underline underline-offset-2"
              >
                Ubah rekening di Profil
              </button>
            </section>
          )}
          <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-relaxed text-amber-800">
              Saldo langsung ditahan saat pengajuan dan akan dikembalikan jika
              pengajuan ditolak admin atau kamu batalkan. Hanya boleh ada 1
              pengajuan yang menunggu dalam satu waktu.
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600"
            >
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nominal" className={labelClass}>
                Nominal Penarikan (Rp)
              </label>
              <input
                id="nominal"
                type="number"
                min={MINIMUM_WITHDRAWAL}
                step="1000"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                placeholder={`Minimal ${rupiah(MINIMUM_WITHDRAWAL)}`}
                className={inputClass}
              />
            </div>
            {showPreview && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                Nominal pengajuan: <strong>{rupiah(jumlahPreview)}</strong>
                <br />
                Sisa saldo setelah ditahan: <strong>{rupiah(saldo - jumlahPreview)}</strong>
              </div>
            )}
            <button
              type="submit"
              disabled={profile.loading || submitting || sedangMenunggu}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-100 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <LoaderCircle size={16} className="animate-spin" />}
              {submitting
                ? "Mengajukan..."
                : sedangMenunggu
                ? "Masih ada pengajuan menunggu"
                : "Ajukan Penarikan Saldo"}
            </button>
          </form>
          {/* Riwayat */}
          <section>
            <h2 className="mb-2 font-poppins text-sm font-semibold text-slate-800">
              Riwayat Penarikan
            </h2>
            {riwayat.loading && !riwayat.data ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
            ) : riwayat.error && !riwayat.data ? (
              <button
                type="button"
                onClick={riwayat.reload}
                className="flex items-center gap-1 text-xs font-bold text-red-600 underline underline-offset-2"
              >
                <RefreshCw size={12} />
                {riwayat.error} Coba lagi
              </button>
            ) : list.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
                Belum ada pengajuan penarikan.
              </p>
            ) : (
              <div className="space-y-2">
                {list.map((p) => {
                  const st = STATUS[p.status] || { label: p.status, cls: "bg-slate-100 text-slate-500" };
                  return (
                    <div
                      key={p.id_penarikan}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-800">{rupiah(p.jumlah)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Diajukan {formatTanggal(p.tanggal_pengajuan)}
                      </p>
                      {p.tanggal_diproses && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Diproses {formatTanggal(p.tanggal_diproses)}
                        </p>
                      )}
                      {p.keterangan && (
                        <p
                          className={`mt-1 rounded-lg px-2 py-1.5 text-[11px] ${
                            p.status === "ditolak"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-50 text-slate-500"
                          }`}
                        >
                          {p.status === "ditolak" ? "Alasan ditolak: " : "Catatan: "}
                          {p.keterangan}
                        </p>
                      )}
                      {p.status === "ditolak" && (
                        <p className="mt-1 text-[11px] text-slate-400">Saldo sudah dikembalikan.</p>
                      )}
                      {p.ada_bukti && (
                        <button
                          type="button"
                          onClick={() => bukaBukti(p)}
                          className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700"
                        >
                          <Receipt size={13} />
                          Lihat bukti transfer
                        </button>
                      )}
                      {p.status === "menunggu" && (
                        <button
                          type="button"
                          onClick={() => handleCancel(p.id_penarikan)}
                          disabled={cancelingId === p.id_penarikan}
                          className="mt-2 flex items-center gap-1 text-[11px] font-bold text-red-600 disabled:opacity-60"
                        >
                          {cancelingId === p.id_penarikan ? "Membatalkan..." : "Batalkan pengajuan"}
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
      {bukti && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bukti-title"
          onClick={tutupBukti}
        >
          <div
            className="w-full max-w-[340px] rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="bukti-title" className="font-poppins text-sm font-bold text-slate-800">
                  Bukti Transfer
                </h2>
                <p className="text-[11px] text-slate-400">Penarikan {rupiah(bukti.jumlah)}</p>
              </div>
              <button
                type="button"
                onClick={tutupBukti}
                aria-label="Tutup bukti transfer"
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            {bukti.loading && (
              <div className="flex h-48 items-center justify-center">
                <LoaderCircle size={22} className="animate-spin text-emerald-600" />
              </div>
            )}
            {bukti.error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-600">
                {bukti.error}
              </p>
            )}
            {bukti.url && (
              <img
                src={bukti.url}
                alt={`Bukti transfer penarikan ${rupiah(bukti.jumlah)}`}
                className="max-h-[60vh] w-full rounded-xl border border-slate-200 object-contain"
              />
            )}
          </div>
        </div>
      )}
      {submittedAmount != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-title"
        >
          <div className="w-full max-w-75 rounded-2xl bg-white px-5 py-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 size={34} className="text-emerald-600" />
            </div>
            <h2 id="success-title" className="font-poppins text-base font-bold text-slate-800">
              Pengajuan Berhasil!
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Saldo ditahan dan pengajuan kamu menunggu diproses admin.
            </p>
            <p className="mt-2 text-sm font-bold text-emerald-700">{rupiah(submittedAmount)}</p>
            <button
              type="button"
              onClick={handleSuccessOk}
              className="mt-5 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}