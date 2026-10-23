import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Recycle,
  ReceiptText,
  ChartNoAxesCombined,
  Megaphone,
  MessageCircle,
  Users,
  Building2,
  ChevronDown,
  LogOut,
  ShieldCheck,
  Wallet,
  HeartHandshake,
} from "lucide-react";
import { API, getAuthHeaders, clearAdminToken, parseResponse } from "../api";

const items = [
  { to: "/", label: "Transaksi Nasabah", icon: ReceiptText },
  { to: "/transaksi-pengepul", label: "Transaksi Pengepul", icon: HeartHandshake },
  { to: "/penarikan", label: "Penarikan Saldo", icon: Wallet },
  { to: "/laporan-pengeluaran", label: "Laporan Pengeluaran", icon: ChartNoAxesCombined },
  { to: "/laporan-pemasukan", label: "Laporan Pemasukan", icon: ChartNoAxesCombined },
  { to: "/pengumuman", label: "Pengumuman", icon: Megaphone },
  { to: "/live-chat", label: "Live Chat", icon: MessageCircle },
];

const databaseItems = [
  {
    to: "/database-nasabah",
    label: "Database Nasabah",
    icon: Users,
  },
  {
    to: "/database-pengepul",
    label: "Database Pengepul",
    icon: Building2,
  },
  {
    to: "/database-sampah",
    label: "Database Sampah",
    icon: Recycle,
  },
];

export default function Sidebar() {
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const navigate = useNavigate();

  // Tombol Database Admin hanya tampil untuk super admin
  const isSuperAdmin = localStorage.getItem("admin_role") === "super_admin";

  const handleLogout = async () => {
    const role = localStorage.getItem("admin_role");
    const url = role === "super_admin" ? API.superAdminLogout : API.adminLogout;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
    } catch {
    }

    clearAdminToken();
    localStorage.removeItem("admin_role");
    navigate("/login", { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-full max-w-[260px] flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-6">
        <Recycle className="h-6 w-6 shrink-0 text-emerald-600" />
        <span className="break-words font-['Poppins'] text-xl font-bold text-emerald-600">
          Bank Sampah
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col space-y-1 px-3 pt-3">
        {/* Menu Utama */}
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 text-base transition ${
                isActive
                  ? "bg-emerald-50 font-bold text-emerald-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span className="break-words">{label}</span>
          </NavLink>
        ))}

        {/* Dropdown Database */}
        <div>
          <button
            onClick={() => setDatabaseOpen(!databaseOpen)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-4 py-2 text-base text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <div className="flex items-center gap-3">
              <Building2 size={18} className="shrink-0" />
              <span>Database</span>
            </div>

            <ChevronDown
              size={18}
              className={`transition-transform duration-200 ${
                databaseOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Isi Dropdown */}
          {databaseOpen && (
            <div className="mt-1 space-y-1 pl-4">
              {databaseItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-10 items-center gap-3 rounded-lg px-4 py-2 text-sm transition ${
                      isActive
                        ? "bg-emerald-50 font-bold text-emerald-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`
                  }
                >
                  <Icon size={17} className="shrink-0" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Bawah: Database Admin (khusus super admin) + Logout */}
        <div className="mt-auto space-y-1">
          {isSuperAdmin && (
            <NavLink
              to="/database-admin"
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-4 py-2 text-base transition ${
                  isActive
                    ? "bg-emerald-50 font-bold text-emerald-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`
              }
            >
              <ShieldCheck size={18} className="shrink-0" />
              <span>Database Admin</span>
            </NavLink>
          )}

          <button
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-4 py-2 text-base text-red-500 transition hover:bg-red-50"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
