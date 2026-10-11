import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, RefreshCw, Search, X } from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import { fetchHargaSampah } from "../api";
import { useData } from "../useData";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function HargaSampah({ onNavigate }) {
  const { data, loading, error, reload } = useData(fetchHargaSampah);
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("");

  const list = data || [];

  // Kategori diurutkan A-Z, "Lainnya" selalu di akhir
  const kategoriList = useMemo(
    () =>
      [...new Set(list.map((i) => i.kategori))].sort((a, b) =>
        a === "Lainnya" ? 1 : b === "Lainnya" ? -1 : a.localeCompare(b, "id")
      ),
    [list]
  );

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    return kategoriList
      .filter((k) => !kategori || k === kategori)
      .map((k) => ({
        kategori: k,
        items: list
          .filter(
            (i) =>
              i.kategori === k &&
              (!term ||
                i.nama.toLowerCase().includes(term) ||
                k.toLowerCase().includes(term))
          )
          .sort((a, b) => a.nama.localeCompare(b.nama, "id")),
      }))
      .filter((g) => g.items.length > 0);
  }, [list, kategoriList, q, kategori]);

  const totalShown = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <PhoneShell bottom={<BottomNav active="dashboard" onNavigate={onNavigate} />}>
      <div className="min-h-[820px] bg-slate-50">
        <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            aria-label="Kembali"
            className="text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-poppins text-base font-bold text-emerald-900">
              Daftar Harga Sampah
            </h1>
            <p className="text-[11px] text-slate-400">
              Harga per kg yang dibayarkan ke nasabah
            </p>
          </div>
        </header>

        <main className="px-6 py-5">
          {/* Cari */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition focus-within:border-emerald-500">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari jenis sampah..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Hapus pencarian"
                className="text-slate-400"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter kategori */}
          {kategoriList.length > 1 && (
            <div className="-mx-6 mt-3 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
              {["", ...kategoriList].map((k) => (
                <button
                  key={k || "semua"}
                  type="button"
                  onClick={() => setKategori(k)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                    kategori === k
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {k || "Semua"}
                </button>
              ))}
            </div>
          )}

          {loading && !data && (
            <div className="mt-5 space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200/70" />
              ))}
            </div>
          )}

          {error && !data && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={reload}
                className="flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
              >
                <RefreshCw size={12} />
                Coba lagi
              </button>
            </div>
          )}

          {data && (
            <p className="mt-4 text-[11px] text-slate-400">
              Menampilkan {totalShown} dari {list.length} jenis sampah
            </p>
          )}

          {data && groups.length === 0 && (
            <p className="mt-6 rounded-xl border border-slate-200 bg-white py-10 text-center text-xs text-slate-400">
              {list.length === 0
                ? "Belum ada data harga sampah."
                : "Jenis sampah tidak ditemukan."}
            </p>
          )}

          {/* Tabel per kategori */}
          <div className="mt-3 space-y-5">
            {groups.map((g) => (
              <section
                key={g.kategori}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between bg-emerald-700 px-4 py-2.5 text-white">
                  <h2 className="font-poppins text-xs font-bold uppercase tracking-wide">
                    {g.kategori}
                  </h2>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold">
                    {g.items.length} jenis
                  </span>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-50 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    <tr>
                      <th className="w-10 px-4 py-2 text-center">No</th>
                      <th className="px-2 py-2">Jenis Sampah</th>
                      <th className="px-4 py-2 text-right">Harga / kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-t border-slate-100 ${
                          idx % 2 === 1 ? "bg-slate-50/70" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5 text-center text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-2.5 font-semibold text-slate-700">
                          {item.nama}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-emerald-700">
                          {rupiah(item.harga)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>

          {data && list.length > 0 && (
            <p className="mt-5 text-center text-[11px] leading-4 text-slate-400">
              Harga dapat berubah sewaktu-waktu mengikuti pasar dan
              <br />
              ditampilkan sesuai data terbaru dari bank sampah.
            </p>
          )}
        </main>
      </div>
    </PhoneShell>
  );
}
