import { AlertCircle, ArrowLeft, Megaphone, RefreshCw } from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import RichText from "../components/RichText";
import { fetchActiveAnnouncements, formatTanggal } from "../api";
import { useData } from "../useData";

export default function Pengumuman({ onNavigate }) {
  const { data, loading, error, reload } = useData(fetchActiveAnnouncements);
  const list = data || [];

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
              Pengumuman
            </h1>
            <p className="text-[11px] text-slate-400">
              {list.length > 0
                ? `${list.length} pengumuman aktif`
                : "Informasi dari admin bank sampah"}
            </p>
          </div>
        </header>

        <main className="space-y-4 px-6 py-5">
          {loading && !data && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          )}

          {error && !data && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
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

          {data && list.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
                <Megaphone size={26} className="text-emerald-600" />
              </div>
              <p className="mt-4 font-poppins text-sm font-bold text-slate-700">
                Belum ada pengumuman
              </p>
              <p className="mt-1 max-w-[240px] text-xs text-slate-400">
                Pengumuman terbaru dari admin akan muncul di sini.
              </p>
            </div>
          )}

          {list.map((item, index) => {
            const isNewest = index === 0;
            return (
              <article
                key={item.id_pengumuman ?? index}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  isNewest ? "border-amber-300" : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      isNewest ? "bg-amber-100" : "bg-emerald-50"
                    }`}
                  >
                    <Megaphone
                      size={16}
                      className={isNewest ? "text-amber-600" : "text-emerald-600"}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words font-poppins text-sm font-bold text-emerald-900">
                        {item.judul}
                      </h2>
                      {isNewest && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Terbaru
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatTanggal(item.tanggal_publikasi)}
                    </p>
                  </div>
                </div>

                <RichText
                  text={item.isi}
                  className="mt-3 break-words border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600"
                />
              </article>
            );
          })}
        </main>
      </div>
    </PhoneShell>
  );
}
