// frontend_nasabah/src/pages/Profile.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import {
  API,
  getAuthHeaders,
  parseResponse,
  requestJson,
  clearAccessToken,
} from "../api";
import { useNotifikasi } from "../notifikasi";

// Kolom yang boleh diubah nasabah. NIK, saldo, dan status akun tidak ikut dikirim.
const FIELDS = [
  "nama_nasabah",
  "no_hp",
  "no_rekening",
  "nama_bank",
  "nama_pemilik_rekening",
  "alamat",
];
const FIELD_REKENING = ["no_rekening", "nama_bank", "nama_pemilik_rekening"];

const KOSONG = Object.fromEntries(FIELDS.map((f) => [f, ""]));

// Aturan sama dengan NasabahProfileUpdate di backend, supaya error muncul sebelum request dikirim
function validasi(form) {
  const e = {};
  const nama = form.nama_nasabah.trim();
  if (nama.length < 3 || nama.length > 100) e.nama_nasabah = "Nama 3-100 karakter.";
  if (!/^(\+62|0)[0-9]{9,12}$/.test(form.no_hp.trim()))
    e.no_hp = "Format: 081234567890 atau +6281234567890.";
  const rek = form.no_rekening.trim();
  if (rek.length < 10 || rek.length > 30) e.no_rekening = "Nomor rekening 10-30 karakter.";
  const bank = form.nama_bank.trim();
  if (bank.length < 3 || bank.length > 50) e.nama_bank = "Nama bank 3-50 karakter.";
  const pemilik = form.nama_pemilik_rekening.trim();
  if (pemilik.length < 3 || pemilik.length > 100)
    e.nama_pemilik_rekening = "Nama pemilik 3-100 karakter.";
  if (form.alamat.trim().length > 500) e.alamat = "Alamat maksimal 500 karakter.";
  return e;
}

const ambilField = (data) =>
  Object.fromEntries(FIELDS.map((f) => [f, (data?.[f] ?? "").toString()]));

export default function Profile({ onNavigate, onLogout }) {
  const { tampilkanToast, refresh } = useNotifikasi();
  const [nik, setNik] = useState("");
  const [baseline, setBaseline] = useState(KOSONG); // data tersimpan di server
  const [form, setForm] = useState(KOSONG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [errors, setErrors] = useState({});
  const [konfirmasiRekening, setKonfirmasiRekening] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(API.profile, { headers: getAuthHeaders() });
      const data = await parseResponse(response);
      const profil = data?.data || data;
      setNik(profil?.nik || "");
      const field = ambilField(profil);
      setBaseline(field);
      setForm(field);
    } catch (err) {
      setLoadError(err.message || "Gagal memuat profil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    muat();
  }, [muat]);

  const berubah = useMemo(
    () => FIELDS.filter((f) => form[f].trim() !== baseline[f].trim()),
    [form, baseline]
  );
  const rekeningBerubah = berubah.some((f) => FIELD_REKENING.includes(f));
  const dirty = berubah.length > 0;
  const terkunci = loading || !!loadError;

  const ubah = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSaveError("");
  };

  const logout = async () => {
    try {
      const response = await fetch(API.logout, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
    } catch {
      // Tetap keluar di sisi aplikasi walau server gagal dihubungi
    }
    clearAccessToken();
    localStorage.removeItem("nasabah_nik");
    onLogout();
  };

  const mintaSimpan = () => {
    const e = validasi(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    // Rekening menentukan ke mana uang dikirim, jadi minta konfirmasi dulu
    if (rekeningBerubah) setKonfirmasiRekening(true);
    else simpan();
  };

  const simpan = async () => {
    setKonfirmasiRekening(false);
    setSaving(true);
    setSaveError("");
    try {
      // Hanya kirim kolom yang benar-benar berubah
      const body = Object.fromEntries(berubah.map((f) => [f, form[f].trim()]));
      const hasil = await requestJson(API.profileUpdate, { method: "PATCH", body });
      const field = ambilField(hasil);
      setBaseline(field);
      setForm(field);
      tampilkanToast({
        tipe: "sukses",
        judul: "Profil diperbarui",
        isi: "Perubahanmu sudah tersimpan.",
      });
      refresh({ silent: true }); // ubah rekening membuat notifikasi keamanan -> sinkronkan badge tanpa toast ganda
    } catch (err) {
      setSaveError(err.message || "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  const nama = baseline.nama_nasabah || "Nasabah";

  return (
    <PhoneShell>
      <div className="min-h-205 bg-slate-50">
        <header className="flex h-12 items-center gap-4 border-b border-slate-300 bg-white px-6">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            aria-label="Kembali ke beranda"
          >
            <ArrowLeft size={18} className="text-slate-500" />
          </button>
          <h1 className="font-poppins text-base font-bold text-emerald-900">
            Edit Profil Nasabah
          </h1>
        </header>

        <main className="px-6 py-5">
          {/* Avatar inisial (belum ada endpoint unggah foto) */}
          <div className="flex flex-col items-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-poppins text-3xl font-bold text-white">
              {nama.charAt(0).toUpperCase()}
            </div>
            <p className="mt-2 text-sm font-bold text-slate-800">{nama}</p>
          </div>

          {loadError && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {loadError}
              </span>
              <button
                type="button"
                onClick={muat}
                className="flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
              >
                <RefreshCw size={12} />
                Coba lagi
              </button>
            </div>
          )}

          {/* Data Akun & Identitas */}
          <section className="mt-8">
            <h2 className="font-poppins text-base font-bold text-emerald-900">
              Data Akun &amp; Identitas
            </h2>
            <p className="mt-1 text-xs text-slate-500">NIK tidak dapat diubah.</p>
            <div className="mt-5 space-y-4">
              <ReadOnly label="NIK" value={loading ? "Memuat..." : nik || "-"} />
              <Input
                label="Nama Nasabah"
                name="nama_nasabah"
                value={form.nama_nasabah}
                error={errors.nama_nasabah}
                disabled={terkunci || saving}
                onChange={ubah}
              />
              <Input
                label="No. HP / WhatsApp"
                name="no_hp"
                type="tel"
                inputMode="tel"
                value={form.no_hp}
                error={errors.no_hp}
                disabled={terkunci || saving}
                onChange={ubah}
              />
            </div>
          </section>

          {/* Rekening */}
          <section className="mt-10">
            <h2 className="font-poppins text-base font-bold text-emerald-900">
              Informasi Rekening Pencairan
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Rekening tujuan transfer saldo. Tidak bisa diubah selama ada
              penarikan yang menunggu diproses.
            </p>
            <div className="mt-5 space-y-4">
              <Input
                label="Nomor Rekening / E-Wallet"
                name="no_rekening"
                inputMode="numeric"
                value={form.no_rekening}
                error={errors.no_rekening}
                disabled={terkunci || saving}
                onChange={ubah}
              />
              <Input
                label="Nama Bank / E-Wallet"
                name="nama_bank"
                value={form.nama_bank}
                error={errors.nama_bank}
                disabled={terkunci || saving}
                onChange={ubah}
              />
              <Input
                label="Nama Pemilik Rekening"
                name="nama_pemilik_rekening"
                value={form.nama_pemilik_rekening}
                error={errors.nama_pemilik_rekening}
                disabled={terkunci || saving}
                onChange={ubah}
              />
            </div>
          </section>

          {/* Alamat */}
          <section className="mt-10">
            <h2 className="font-poppins text-base font-bold text-emerald-900">
              Alamat Domisili
            </h2>
            <label className="mt-5 block">
              <span className="text-xs font-bold text-slate-500">Alamat</span>
              <textarea
                value={form.alamat}
                disabled={terkunci || saving}
                onChange={(e) => ubah("alamat", e.target.value)}
                aria-invalid={!!errors.alamat}
                className="mt-2 h-20 w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-xs outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
              {errors.alamat && (
                <span className="mt-1 block text-[11px] text-red-600">{errors.alamat}</span>
              )}
            </label>
          </section>

          {saveError && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {saveError}
            </div>
          )}

          <button
            type="button"
            onClick={mintaSimpan}
            disabled={!dirty || saving || terkunci}
            className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-600 font-poppins text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving
              ? "Menyimpan..."
              : dirty
              ? `Simpan Perubahan (${berubah.length})`
              : "Tidak ada perubahan"}
          </button>

          <button
            type="button"
            onClick={logout}
            className="mt-3 h-11 w-full rounded-[10px] border border-red-200 bg-white font-poppins text-xs font-semibold text-red-600"
          >
            Logout
          </button>
        </main>
      </div>

      {/* Konfirmasi ubah rekening */}
      {konfirmasiRekening && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rek-title"
        >
          <div className="w-full max-w-[320px] rounded-2xl bg-white px-5 py-6 shadow-2xl">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50">
              <ShieldAlert size={26} className="text-amber-600" />
            </div>
            <h2 id="rek-title" className="text-center font-poppins text-base font-bold text-slate-800">
              Ubah rekening pencairan?
            </h2>
            <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">
              Penarikan berikutnya akan ditransfer ke{" "}
              <strong className="text-slate-700">
                {form.nama_bank.trim()} {form.no_rekening.trim()}
              </strong>{" "}
              a.n. {form.nama_pemilik_rekening.trim()}. Pastikan datanya benar.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setKonfirmasiRekening(false)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-600"
              >
                Periksa lagi
              </button>
              <button
                type="button"
                onClick={simpan}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white"
              >
                Ya, simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}

/* ========================= Read Only Input ========================= */
function ReadOnly({ label, value }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        readOnly
        className="mt-2 h-10 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 text-xs text-slate-400 outline-none"
      />
    </label>
  );
}

/* ========================= Input ========================= */
function Input({ label, name, value, onChange, error, type = "text", inputMode, disabled }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(e) => onChange(name, e.target.value)}
        className={`mt-2 h-10 w-full rounded-lg border bg-white px-3 text-xs outline-none focus:border-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error && <span className="mt-1 block text-[11px] text-red-600">{error}</span>}
    </label>
  );
}