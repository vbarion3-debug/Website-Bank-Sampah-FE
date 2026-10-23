import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Cpu,
  Loader2,
  Play,
  RefreshCw,
  Save,
  ScanLine,
  Search,
  Trash2,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { API, getAuthHeaders, getFileUrl, parseResponse } from "../api";
import { parseWaktu } from "../utils/waktu";

const POLL_PERANGKAT_MS = 5000; // daftar alat saat belum ada sesi
const POLL_SESI_MS = 2000; // item masuk saat sesi berjalan
const KAMERA_KEY = "iot_kamera_id"; // kamera terakhir yang dipakai admin
const FREEZE_MS = 3000; // lama foto hasil scan ditahan di layar
const CONFIDENCE_RENDAH = 80;

const rupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

const kg = (v) => `${Number(v || 0).toLocaleString("id-ID")} kg`;

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

function pesanKamera(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Izin kamera ditolak. Izinkan akses kamera untuk situs ini di pengaturan browser.";
    case "NotFoundError":
      return "Kamera tidak ditemukan di perangkat ini.";
    case "NotReadableError":
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
    default:
      return err?.message || "Gagal membuka kamera.";
  }
}

function catatanItem(it) {
  if (it.berat == null) return "Menunggu data timbangan…";
  if (!it.lengkap) return "Menunggu scan. Tekan SCAN atau pilih jenis secara manual.";
  if (it.id_jenis == null)
    return `Label "${it.jenis_terdeteksi}" belum dipetakan. Pilih jenis sampahnya.`;
  if (it.perlu_perhatian)
    return `Kamera kurang yakin (${Number(it.confidence)}%). Cek jenisnya.`;
  return "";
}

export default function TransaksiIoT({ daftarJenis = [], onSaved }) {
  // ---------- alat ----------
  const [perangkat, setPerangkat] = useState([]);
  const [loadingPerangkat, setLoadingPerangkat] = useState(true);
  const [machineId, setMachineId] = useState("");

  // ---------- nasabah ----------
  const [nik, setNik] = useState("");
  const [nasabah, setNasabah] = useState(null);
  const [searching, setSearching] = useState(false);

  // ---------- sesi ----------
  const [sesi, setSesi] = useState(null); // SesiDetailResponse
  const [hasil, setHasil] = useState(null); // { res: SesiResponse, nama, nik }
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [busyItem, setBusyItem] = useState(null);

  // ---------- kamera (kamera browser milik admin) ----------
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const freezeTimer = useRef(null);
  const [kameraAktif, setKameraAktif] = useState(false);
  const [kameraList, setKameraList] = useState([]);
  const [kameraId, setKameraId] = useState("");
  const [kameraError, setKameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [freezeUrl, setFreezeUrl] = useState(""); // foto hasil scan (berkotak), ditahan sebentar
  const [infoScan, setInfoScan] = useState(null); // respons scan terakhir

  const [error, setError] = useState("");
  const [pollError, setPollError] = useState("");

  const sesiId = sesi?.id_sesi ?? null;
  const idle = !sesi && !hasil;

  // =========================================================
  // DAFTAR ALAT
  // =========================================================
  const muatPerangkat = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingPerangkat(true);
      const response = await fetch(API.iotPerangkat, { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      const list = Array.isArray(result) ? result : [];
      setPerangkat(list);
      // alat yang dipilih tapi tiba-tiba offline / dipakai -> batalkan pilihan
      setMachineId((cur) => {
        const p = list.find((x) => x.machine_id === cur);
        return p && p.status === "tersambung" ? cur : "";
      });
    } catch (err) {
      if (!silent) setError(err.message || "Gagal memuat daftar alat.");
    } finally {
      if (!silent) setLoadingPerangkat(false);
    }
  }, []);

  useEffect(() => {
    muatPerangkat();
  }, [muatPerangkat]);

  useEffect(() => {
    if (!idle) return undefined;
    const t = setInterval(() => muatPerangkat(true), POLL_PERANGKAT_MS);
    return () => clearInterval(t);
  }, [idle, muatPerangkat]);

  // =========================================================
  // POLLING SESI (item masuk dari timbangan & kamera)
  // =========================================================
  useEffect(() => {
    if (sesiId == null) return undefined;
    let batal = false;
    let sedang = false;

    async function tick() {
      if (sedang) return;
      sedang = true;
      try {
        const response = await fetch(API.iotSesi(sesiId), { headers: getAuthHeaders() });
        const data = await parseResponse(response);
        if (batal) return;
        setPollError("");
        if (data.status !== "aktif") {
          setSesi(null);
          setError(
            "Sesi sudah berakhir karena tidak ada aktivitas. Item yang sudah lengkap disimpan sebagai 'butuh review'."
          );
          muatPerangkat(true);
          return;
        }
        setSesi(data);
      } catch (err) {
        if (!batal) setPollError("Koneksi ke server terputus, mencoba lagi…");
      } finally {
        sedang = false;
      }
    }

    const t = setInterval(tick, POLL_SESI_MS);
    return () => {
      batal = true;
      clearInterval(t);
    };
  }, [sesiId, muatPerangkat]);

  // =========================================================
  // KAMERA + SCAN (YOLO diproses di backend)
  // =========================================================
  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function matikanKamera() {
    stopStream();
    setKameraAktif(false);
    setFreezeUrl("");
    setInfoScan(null);
  }

  async function bukaKamera(idPilihan = "") {
    setKameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setKameraError("Browser ini tidak bisa mengakses kamera. Buka lewat HTTPS atau localhost.");
      return;
    }
    const pilih = idPilihan || localStorage.getItem(KAMERA_KEY) || "";
    const ukuran = { width: { ideal: 1280 }, height: { ideal: 720 } };
    try {
      stopStream();
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: pilih
            ? { ...ukuran, deviceId: { exact: pilih } }
            : { ...ukuran, facingMode: { ideal: "environment" } },
        });
      } catch (err) {
        // kamera yang tersimpan sudah tidak ada -> pakai kamera bawaan
        if (pilih && err?.name === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({ video: ukuran });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      const aktifId = stream.getVideoTracks()[0]?.getSettings?.().deviceId || "";
      // label kamera baru tersedia setelah izin diberikan, jadi daftar diambil di sini
      const semua = await navigator.mediaDevices.enumerateDevices();
      setKameraList(semua.filter((d) => d.kind === "videoinput"));
      setKameraId(aktifId);
      if (aktifId) localStorage.setItem(KAMERA_KEY, aktifId);
      setKameraAktif(true);
    } catch (err) {
      setKameraAktif(false);
      setKameraError(pesanKamera(err));
    }
  }

  // Ambil 1 frame dari video, kecilkan (sisi terpanjang 640 px = ukuran input YOLO), jadikan JPEG
  function ambilFrame() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const skala = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * skala);
    c.height = Math.round(v.videoHeight * skala);
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  }

  async function scanSampah() {
    setError("");
    const frame = ambilFrame();
    if (!frame) {
      setError("Gambar kamera belum siap. Tunggu sampai preview muncul, lalu coba lagi.");
      return;
    }
    try {
      setScanning(true);
      const response = await fetch(API.iotSesiScan(sesi.id_sesi), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ foto_base64: frame }),
      });
      const data = await parseResponse(response);
      setSesi(data.sesi);
      setInfoScan(data);
      if (data.terdeteksi && data.foto_url) {
        setFreezeUrl(data.foto_url);
        clearTimeout(freezeTimer.current);
        freezeTimer.current = setTimeout(() => setFreezeUrl(""), FREEZE_MS);
      }
    } catch (err) {
      setError(err.message || "Gagal memindai sampah.");
    } finally {
      setScanning(false);
    }
  }

  // Pasang stream ke <video> setiap kali panel sesi tampil / kamera diganti
  useEffect(() => {
    const v = videoRef.current;
    if (kameraAktif && v && streamRef.current && v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => {});
    }
  }, [kameraAktif, sesiId, kameraId]);

  // Kamera mati otomatis saat sesi berakhir; dan dilepas saat komponen ditutup
  useEffect(() => {
    if (sesiId == null) matikanKamera();
  }, [sesiId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      stopStream();
      clearTimeout(freezeTimer.current);
    },
    []
  );

  // =========================================================
  // CARI NASABAH
  // =========================================================
  async function cariNasabah() {
    const value = nik.trim();
    if (value.length !== 16) {
      setError("NIK harus 16 digit.");
      return;
    }
    setSearching(true);
    setError("");
    setNasabah(null);
    try {
      const response = await fetch(API.nasabahDetail(value), { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      const data = result?.data || result;
      if (data && data.is_active === false) {
        setError("Akun nasabah ini nonaktif, tidak bisa dicatat transaksinya.");
        return;
      }
      setNasabah(data);
    } catch (err) {
      setError(err.message || "Nasabah tidak ditemukan.");
    } finally {
      setSearching(false);
    }
  }

  // =========================================================
  // MULAI / LANJUTKAN / BATAL / SIMPAN
  // =========================================================
  async function mulaiSesi() {
    setError("");
    if (!machineId) return setError("Pilih alat yang berstatus Tersambung dulu.");
    if (!nasabah) return setError("Cari nasabah berdasarkan NIK dulu.");
    try {
      setStarting(true);
      const response = await fetch(API.iotSesiMulai, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ machine_id: machineId, nik: nik.trim() }),
      });
      setSesi(await parseResponse(response));
    } catch (err) {
      setError(err.message || "Gagal memulai sesi.");
      muatPerangkat(true);
    } finally {
      setStarting(false);
    }
  }

  // Alat "Sedang dipakai": admin boleh membuka lagi sesinya (mis. setelah refresh halaman)
  async function lanjutkanSesi(p) {
    if (!p.sesi_id) return;
    setError("");
    try {
      const response = await fetch(API.iotSesi(p.sesi_id), { headers: getAuthHeaders() });
      const data = await parseResponse(response);
      if (data.status !== "aktif") {
        muatPerangkat(true);
        return;
      }
      setSesi(data);
    } catch (err) {
      setError(err.message || "Gagal membuka sesi.");
    }
  }

  async function ubahJenis(item, idJenis) {
    if (!idJenis) return;
    setError("");
    try {
      setBusyItem(item.id);
      const response = await fetch(API.iotSesiItem(sesi.id_sesi, item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ id_jenis: Number(idJenis) }),
      });
      setSesi(await parseResponse(response));
    } catch (err) {
      setError(err.message || "Gagal mengubah jenis sampah.");
    } finally {
      setBusyItem(null);
    }
  }

  async function hapusItem(item) {
    setError("");
    try {
      setBusyItem(item.id);
      const response = await fetch(API.iotSesiItem(sesi.id_sesi, item.id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setSesi(await parseResponse(response));
    } catch (err) {
      setError(err.message || "Gagal membuang item.");
    } finally {
      setBusyItem(null);
    }
  }

  function resetSemua() {
    setSesi(null);
    setHasil(null);
    setNik("");
    setNasabah(null);
    setMachineId("");
    setPollError("");
    setError("");
    muatPerangkat(true);
  }

  async function batalkanSesi() {
    if (!window.confirm("Batalkan sesi ini? Item yang sudah lengkap tidak masuk transaksi.")) return;
    try {
      setFinishing(true);
      const response = await fetch(API.iotSesiBatal(sesi.id_sesi), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
      resetSemua();
    } catch (err) {
      setError(err.message || "Gagal membatalkan sesi.");
    } finally {
      setFinishing(false);
    }
  }

  async function simpanTransaksi() {
    setError("");
    try {
      setFinishing(true);
      const response = await fetch(API.iotSesiSelesai(sesi.id_sesi), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const res = await parseResponse(response);
      setHasil({ res, nama: sesi.nama_nasabah, nik: sesi.nik });
      setSesi(null);
      onSaved?.();
    } catch (err) {
      setError(err.message || "Gagal menyimpan transaksi.");
    } finally {
      setFinishing(false);
    }
  }

  // =========================================================
  // TURUNAN
  // =========================================================
  const jumlahTersambung = perangkat.filter((p) => p.status === "tersambung").length;
  const items = sesi?.items ?? [];
  const terbaru = items.length ? items[items.length - 1] : null;
  const bisaMulai = Boolean(machineId && nasabah) && !starting;

  // Badge di atas foto: hasil scan yang barusan (saat foto ditahan), atau item terbaru bila kamera mati
  const atasScan = infoScan?.deteksi?.[0];
  let badge = null;
  if (freezeUrl && atasScan) {
    badge = {
      teks: `${atasScan.nama_jenis || atasScan.label} (${atasScan.confidence}%)`,
      perhatian: !atasScan.nama_jenis || atasScan.confidence < CONFIDENCE_RENDAH,
    };
  } else if (!kameraAktif && terbaru && (terbaru.nama_jenis || terbaru.jenis_terdeteksi)) {
    badge = {
      teks:
        (terbaru.nama_jenis || terbaru.jenis_terdeteksi) +
        (terbaru.diubah_manual
          ? " (manual)"
          : terbaru.confidence != null
          ? ` (${Number(terbaru.confidence)}%)`
          : ""),
      perhatian: terbaru.perlu_perhatian,
    };
  }

  const optionsJenis = daftarJenis.map((j) => (
    <option key={j.id_jenis} value={j.id_jenis}>
      {j.nama_jenis} — {rupiah(j.harga_per_kg)}/kg
    </option>
  ));

  // =========================================================
  // RENDER
  // =========================================================
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-['Poppins'] text-lg font-bold text-emerald-900">
          <Cpu size={19} />
          Input Transaksi Nasabah (IoT)
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            jumlahTersambung > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${jumlahTersambung > 0 ? "bg-emerald-500" : "bg-slate-400"}`} />
          {jumlahTersambung > 0 ? `${jumlahTersambung} timbangan tersambung` : "Belum ada timbangan tersambung"}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button type="button" onClick={() => setError("")} className="shrink-0 text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* =====================================================
          1. BELUM ADA SESI: pilih alat + nasabah
          ===================================================== */}
      {idle && (
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">Pilih alat</p>
              <button
                type="button"
                onClick={() => muatPerangkat()}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-emerald-600"
              >
                <RefreshCw size={12} className={loadingPerangkat ? "animate-spin" : ""} />
                Segarkan
              </button>
            </div>

            {!loadingPerangkat && perangkat.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                Belum ada alat terdaftar. Tambahkan dulu di menu Database IoT.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {perangkat.map((p) => {
                  const bisaDipilih = p.status === "tersambung";
                  const dipilih = machineId === p.machine_id;
                  const bisaDilanjut = p.status === "dipakai" && p.sesi_id;
                  return (
                    <button
                      key={p.machine_id}
                      type="button"
                      disabled={!bisaDipilih && !bisaDilanjut}
                      onClick={() => (bisaDilanjut ? lanjutkanSesi(p) : setMachineId(p.machine_id))}
                      className={`rounded-xl border p-4 text-left transition ${
                        dipilih
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200"
                          : bisaDipilih
                          ? "border-slate-200 hover:border-emerald-400"
                          : bisaDilanjut
                          ? "border-amber-200 bg-amber-50/40 hover:border-amber-400"
                          : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{p.nama}</p>
                          <p className="truncate font-mono text-[11px] text-slate-400">{p.machine_id}</p>
                        </div>
                        {p.status === "offline" ? (
                          <WifiOff size={16} className="shrink-0 text-slate-400" />
                        ) : (
                          <Cpu size={16} className="shrink-0 text-slate-400" />
                        )}
                      </div>
                      {p.lokasi && <p className="mt-1 truncate text-xs text-slate-500">{p.lokasi}</p>}
                      <div className="mt-3">
                        <StatusPill status={p.status} />
                      </div>
                      {bisaDilanjut && (
                        <p className="mt-2 truncate text-xs text-amber-700">
                          {p.nama_pemakai || p.nik_pemakai} · klik untuk membuka sesi
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Nasabah</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                inputMode="numeric"
                maxLength={16}
                value={nik}
                onChange={(e) => {
                  setNik(e.target.value.replace(/\D/g, ""));
                  setNasabah(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && cariNasabah()}
                placeholder="Masukkan NIK nasabah (contoh: 3178902345981765)"
                className="w-full min-w-0 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={cariNasabah}
                disabled={searching}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Cari Nasabah
              </button>
            </div>
            {nasabah && (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <UserRound size={16} />
                {nasabah.nama_nasabah || nasabah.nama}
                <span className="font-mono text-xs font-normal text-slate-400">{nik}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={mulaiSesi}
              disabled={!bisaMulai}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              Mulai Sesi
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          2. SESI BERJALAN (layout mengikuti Figma)
          ===================================================== */}
      {sesi && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <UserRound size={16} />
                {sesi.nama_nasabah || "Nasabah"}
                <span className="font-mono text-xs font-normal text-slate-400">{sesi.nik}</span>
              </p>
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Cpu size={13} />
                {sesi.nama_perangkat || sesi.machine_id}
                {sesi.perangkat_online ? (
                  <span className="font-semibold text-emerald-600">Tersambung</span>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-amber-600">
                    <WifiOff size={12} /> Terputus
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={batalkanSesi}
              disabled={finishing}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-60"
            >
              Batalkan sesi
            </button>
          </div>

          {!sesi.perangkat_online && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
              <AlertTriangle size={15} className="shrink-0" />
              Alat tidak mengirim sinyal. Sesi tetap berjalan; item yang sudah masuk aman.
            </div>
          )}
          {pollError && <p className="text-xs text-slate-400">{pollError}</p>}

          {/* kiri: deteksi AI, kanan: berat IoT */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-600">Deteksi Jenis Sampah (AI)</p>

              {/* Preview kamera live. Setelah SCAN, foto hasil (berkotak) ditahan beberapa detik. */}
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${kameraAktif && !freezeUrl ? "" : "hidden"}`}
                />
                {freezeUrl ? (
                  <img
                    src={getFileUrl(freezeUrl)}
                    alt="Hasil scan"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : !kameraAktif ? (
                  terbaru?.foto_url ? (
                    <img
                      src={getFileUrl(terbaru.foto_url)}
                      alt="Foto sampah terakhir"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Camera size={32} className="mx-auto" />
                      <p className="mt-2 text-xs">Kamera belum aktif</p>
                    </div>
                  )
                ) : null}
                {badge && (
                  <span
                    className={`absolute left-3 top-3 rounded border bg-slate-900/70 px-2 py-0.5 text-[11px] font-bold ${
                      badge.perhatian
                        ? "border-amber-400 text-amber-300"
                        : "border-emerald-400 text-emerald-300"
                    }`}
                  >
                    {badge.teks}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {!kameraAktif ? (
                  <button
                    type="button"
                    onClick={() => bukaKamera()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <Camera size={16} />
                    Buka Kamera
                  </button>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <select
                        value={kameraId}
                        onChange={(e) => bukaKamera(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      >
                        {kameraList.map((k, i) => (
                          <option key={k.deviceId || i} value={k.deviceId}>
                            {k.label || `Kamera ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={matikanKamera}
                        title="Matikan kamera"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-50"
                      >
                        <CameraOff size={16} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={scanSampah}
                      disabled={scanning}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60"
                    >
                      {scanning ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                      {scanning ? "Memindai…" : "SCAN"}
                    </button>
                  </>
                )}
                {kameraError && <p className="text-xs text-red-500">{kameraError}</p>}
                {infoScan && (
                  <p
                    className={`text-xs ${
                      infoScan.terdeteksi && atasScan?.nama_jenis ? "text-slate-500" : "text-amber-700"
                    }`}
                  >
                    {infoScan.pesan}
                  </p>
                )}
              </div>

              <select
                disabled={!terbaru || busyItem === terbaru?.id}
                value={terbaru?.id_jenis ?? ""}
                onChange={(e) => ubahJenis(terbaru, e.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="" disabled>
                  -- Ubah manual (dropdown) --
                </option>
                {optionsJenis}
              </select>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-600">Berat Sampah (IoT)</p>
              <div className="flex flex-1 flex-col items-center justify-center py-6">
                <p className="font-['Poppins'] text-6xl font-bold text-emerald-700">
                  {terbaru?.berat != null ? Number(terbaru.berat).toLocaleString("id-ID", { minimumFractionDigits: 2 }) : "—"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {terbaru?.berat != null ? "Kilogram (KG)" : "Menunggu data timbangan"}
                </p>
              </div>
            </div>
          </div>

          {/* item dalam sesi */}
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Item dalam sesi ({items.length})</p>
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
                Silakan nasabah memasukkan sampah ke alat. Item muncul otomatis di sini.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => {
                  const catatan = catatanItem(it);
                  return (
                    <div
                      key={it.id}
                      className={`rounded-xl border p-3 ${
                        catatan && it.lengkap ? "border-amber-200 bg-amber-50/40" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                          {it.foto_url ? (
                            <img src={getFileUrl(it.foto_url)} alt={`Item ${i + 1}`} className="h-full w-full object-cover" />
                          ) : (
                            <Camera size={16} />
                          )}
                        </div>
                        <select
                          disabled={busyItem === it.id}
                          value={it.id_jenis ?? ""}
                          onChange={(e) => ubahJenis(it, e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        >
                          <option value="" disabled>
                            Pilih jenis sampah
                          </option>
                          {optionsJenis}
                        </select>
                        <div className="w-24 shrink-0 text-right">
                          <p className="text-sm font-bold text-slate-800">{it.berat != null ? kg(it.berat) : "—"}</p>
                          <p className="text-xs font-semibold text-emerald-700">
                            {it.subtotal != null ? rupiah(it.subtotal) : "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyItem === it.id}
                          onClick={() => hapusItem(it)}
                          title="Buang item"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {catatan && (
                        <p className={`mt-2 text-xs ${it.lengkap ? "text-amber-700" : "text-slate-400"}`}>{catatan}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* total + simpan */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                Total ({sesi.jumlah_item_siap} item siap · {kg(sesi.total_berat)})
              </p>
              <p className="font-['Poppins'] text-xl font-bold text-emerald-900">{rupiah(sesi.total_nilai)}</p>
            </div>
            <button
              type="button"
              onClick={simpanTransaksi}
              disabled={finishing || sesi.jumlah_item_siap === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {finishing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Simpan Transaksi
            </button>
          </div>
        </div>
      )}

      {/* =====================================================
          3. STRUK SETELAH DISIMPAN
          ===================================================== */}
      {hasil && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 size={15} className="shrink-0" />
            {hasil.res.pesan}
          </div>

          {hasil.res.transaksi && (
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-dashed border-slate-300 pb-3">
                <div>
                  <p className="font-['Poppins'] text-base font-bold text-emerald-900">Struk Transaksi</p>
                  <p className="text-xs text-slate-400">
                    {parseWaktu(hasil.res.transaksi.tanggal_transaksi).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">ID Transaksi</p>
                  <p className="text-sm font-bold text-slate-700">#{hasil.res.transaksi.id_transaksi}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div>
                  <p className="text-slate-400">NIK Nasabah</p>
                  <p className="font-mono font-semibold text-slate-700">{hasil.nik}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400">Nama Nasabah</p>
                  <p className="font-semibold text-slate-700">{hasil.nama || "-"}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                {hasil.res.transaksi.details.map((d) => (
                  <div key={d.id_detail} className="flex justify-between gap-3">
                    <span className="text-slate-600">
                      {d.nama_jenis} ({kg(d.berat)})
                    </span>
                    <span className="font-semibold text-slate-800">{rupiah(d.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
                <span className="text-sm font-bold text-emerald-800">Total Diterima</span>
                <span className="font-['Poppins'] text-base font-bold text-emerald-800">
                  {rupiah(hasil.res.transaksi.total_nilai)}
                </span>
              </div>
              <p className="mt-2 text-right text-xs text-slate-400">
                Saldo nasabah sekarang {rupiah(hasil.res.transaksi.saldo_nasabah_sekarang)}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetSemua}
              className="flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Transaksi baru
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
