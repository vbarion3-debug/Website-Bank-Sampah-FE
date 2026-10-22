import {
  Home,
  History,
  MessageCircle,
  UserRound,
  Wallet,
} from "lucide-react";
import { useNotifikasi } from "../notifikasi";
// Navbar bawah dipakai bersama oleh Dashboard, HargaSampah, Pengumuman,
// dan LiveChat (lewat PhoneShell). Tampilannya disamakan dengan navbar
// di halaman Penarikan.
export default function BottomNav({ active, onNavigate }) {
  const { chatBelumDibaca } = useNotifikasi();
  const items = [
    { id: "dashboard", label: "Beranda", icon: Home },
    { id: "history", label: "Transaksi", icon: History },
    { id: "withdraw", label: "Penarikan", icon: Wallet },
    { id: "chat", label: "Live Chat", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: UserRound },
  ];
  return (
    <nav className="absolute bottom-0 left-0 right-0 z-20 grid grid-cols-5 border-t border-slate-100 bg-white px-1 pb-2 pt-2">
      {items.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        // Badge balasan admin yang belum dibaca (disembunyikan saat sedang di Live Chat)
        const badge = id === "chat" && !isActive ? chatBelumDibaca : 0;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-1 text-[8px] transition ${
              isActive
                ? "font-bold text-emerald-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <span className="relative">
              <Icon
                size={17}
                fill={isActive ? "currentColor" : "none"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {badge > 0 && (
                <span
                  aria-label={`${badge} pesan belum dibaca`}
                  className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold leading-none text-white"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}