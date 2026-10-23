import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { parseDate } from "../api";

// Backend menyimpan waktu WIB tanpa penanda zona; parseDate menambahkan +07:00.
// Tampilan dipaksa ke WIB supaya judul (tanggal) dan jam selalu dari instan yang sama.
const WIB = "Asia/Jakarta";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
const kg = (v) =>
  `${Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;

function tanggalDanJam(value) {
  const d = parseDate(value);
  if (d.getTime() === 0) return { tanggal: "Tanggal tidak diketahui", jam: "" };
  const tanggal = d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: WIB,
  });
  const jam = d
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: WIB,
    })
    .replace(".", ":");
  return { tanggal, jam: `${jam} WIB` };
}

// Satu setoran dari GET /transaksi/history.
// Tertutup: tanggal (judul) + jam. Diklik: rincian item, total, dan keterangan.
export default function SetoranTerakhir({ setoran }) {
  const [terbuka, setTerbuka] = useState(false);
  if (!setoran) return null;

  const { tanggal, jam } = tanggalDanJam(setoran.tanggal_transaksi);
  const items = setoran.details ?? setoran.detail ?? [];
  const panelId = `setoran-${setoran.id_transaksi}`;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setTerbuka((v) => !v)}
        aria-expanded={terbuka}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{tanggal}</p>
          {jam && <p className="mt-0.5 text-xs text-slate-500">{jam}</p>}
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${
            terbuka ? "rotate-180" : ""
          }`}
        />
      </button>

      {terbuka && (
        <div
          id={panelId}
          className="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Transaksi #{setoran.id_transaksi}</span>
            {setoran.dibuat_manual && <span>Dicatat oleh petugas</span>}
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-400">Rincian item tidak tersedia.</p>
          ) : (
            <ul className="space-y-2.5">
              {items.map((d, i) => (
                <li
                  key={d.id_detail ?? i}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">
                      {d.nama_jenis || "Sampah"}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {kg(d.berat)} &times; {rupiah(d.harga_per_kg)}/kg
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-slate-700">
                    {rupiah(d.subtotal)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1 border-t border-slate-200 pt-3 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Total berat</span>
              <span className="font-semibold text-slate-700">
                {kg(setoran.total_berat)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Saldo bertambah</span>
              <span className="font-bold text-emerald-600">
                + {rupiah(setoran.total_nilai)}
              </span>
            </div>
          </div>

          {setoran.keterangan && (
            <p className="rounded-lg bg-white px-3 py-2 text-[11px] text-slate-500">
              {setoran.keterangan}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
