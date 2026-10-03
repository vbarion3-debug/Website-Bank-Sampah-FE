import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API, parseResponse, setAdminToken } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("admin"); // "admin" | "super_admin"
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ======================================================
  // STEP 1: LOGIN (username/password atau email/password)
  // ======================================================
  const submitCredentials = async (e) => {
    e.preventDefault();
    setError("");

    if (role === "admin" && (!username.trim() || !password)) {
      setError("Username dan password harus diisi.");
      return;
    }
    if (role === "super_admin" && (!email.trim() || !password)) {
      setError("Email dan password harus diisi.");
      return;
    }

    setLoading(true);
    try {
      const url = role === "admin" ? API.adminLogin : API.superAdminLogin;
      const body =
        role === "admin"
          ? { username: username.trim(), password }
          : { email: email.trim(), password };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await parseResponse(response);

      // Login step sukses -> backend kirim OTP (cek terminal saat development)
      setStep("otp");
    } catch (err) {
      setError(err.message || "Login gagal. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // STEP 2: VERIFY OTP
  // ======================================================
  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(otp)) {
      setError("Kode OTP harus 6 digit.");
      return;
    }

    setLoading(true);
    try {
      const url = role === "admin" ? API.adminVerifyOtp : API.superAdminVerifyOtp;
      const body =
        role === "admin"
          ? { username: username.trim(), kode_otp: otp }
          : { email: email.trim(), kode_otp: otp };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await parseResponse(response);

      // Backend balikin session_token (bukan access_token)
      const token = result?.session_token;
      if (token) {
        setAdminToken(token);
        localStorage.setItem("admin_role", result?.role || role);
        localStorage.setItem("admin_username", result?.username || username);
        localStorage.setItem("admin_nama", result?.nama_admin || "");
      }
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Verifikasi OTP gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold text-slate-800">
          Login {role === "admin" ? "Admin" : "Super Admin"}
        </h1>

        {/* ROLE TOGGLE */}
        <div className="mt-5 flex rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => { setRole("admin"); setStep("credentials"); setError(""); }}
            className={`flex-1 rounded-md py-2 ${role === "admin" ? "bg-white shadow text-emerald-700" : "text-slate-500"}`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => { setRole("super_admin"); setStep("credentials"); setError(""); }}
            className={`flex-1 rounded-md py-2 ${role === "super_admin" ? "bg-white shadow text-emerald-700" : "text-slate-500"}`}
          >
            Super Admin
          </button>
        </div>

        {/* STEP 1: CREDENTIALS */}
        {step === "credentials" && (
          <form onSubmit={submitCredentials} className="mt-6 space-y-4">
            {role === "admin" ? (
              <label className="block">
                <span className="text-xs font-bold text-slate-500">Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            ) : (
              <label className="block">
                <span className="text-xs font-bold text-slate-500">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-bold text-slate-500">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-emerald-500"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {loading ? "Memproses..." : "Lanjut"}
            </button>
          </form>
        )}

        {/* STEP 2: OTP */}
        {step === "otp" && (
          <form onSubmit={submitOtp} className="mt-6 space-y-4">
            <p className="text-center text-xs text-slate-500">
              Kode OTP dikirim, cek terminal backend (development mode).
            </p>

            <label className="block">
              <span className="text-xs font-bold text-slate-500">Kode OTP</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6 digit kode OTP"
                className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 text-center text-lg tracking-widest outline-none focus:border-emerald-500"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {loading ? "Memverifikasi..." : "Verifikasi & Masuk"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
              className="w-full text-center text-xs font-semibold text-slate-500"
            >
              Kembali
            </button>
          </form>
        )}
      </div>
    </main>
  );
}