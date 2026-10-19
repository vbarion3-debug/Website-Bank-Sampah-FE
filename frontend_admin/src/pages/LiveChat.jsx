import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCheck,
  CircleCheck,
  MessageCircle,
  MessageSquareWarning,
  Search,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import {
  API,
  getAuthHeaders,
  getAdminToken,
  getAdminUsername,
  chatHistory,
  chatWsUrl,
} from "../api";
import { parseWaktu } from "../utils/waktu";

const TZ = "Asia/Jakarta";

// ---------- helper waktu (selalu WIB, apa pun zona browser) ----------
const jam = (value) => {
  const d = parseWaktu(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
};

const dayKey = (value) => {
  const d = parseWaktu(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
};

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(key) {
  if (!key) return "";
  if (key === todayKey()) return "Hari ini";
  const kemarin = new Date(Date.now() - 24 * 3600 * 1000).toLocaleDateString("en-CA", {
    timeZone: TZ,
  });
  if (key === kemarin) return "Kemarin";
  return new Date(`${key}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

// Waktu di daftar percakapan: jam kalau hari ini, selain itu "Kemarin" / tanggal
function listTime(value) {
  const key = dayKey(value);
  if (!key) return "";
  return key === todayKey() ? jam(value) : dayLabel(key);
}

const initial = (c) => (c.nama_nasabah || c.nik_nasabah || "?").charAt(0).toUpperCase();

function StatCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    blue: "bg-sky-50 text-sky-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
  };
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 flex items-baseline gap-2 font-['Poppins'] text-2xl font-bold text-slate-800">
          {value}
          {hint && (
            <span className={`text-xs font-bold ${tone === "red" ? "text-red-500" : "text-emerald-600"}`}>
              {hint}
            </span>
          )}
        </p>
      </div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export default function LiveChat() {
  const myUsername = getAdminUsername();
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [selectedNik, setSelectedNik] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [wsStatus, setWsStatus] = useState("idle");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  const selected = conversations.find((c) => c.nik_nasabah === selectedNik) || null;
  const handledBy = selected?.handled_by || null;
  const isMine = handledBy && handledBy === myUsername;
  const isTakenByOther = handledBy && handledBy !== myUsername;

  // ---------- daftar percakapan (polling 5 dtk) ----------
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(API.chatConversations, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Gagal mengambil daftar chat.");
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // ---------- buka chat: riwayat (REST) + WebSocket ----------
  useEffect(() => {
    if (!selectedNik) return;
    let cancelled = false;

    async function openChat() {
      setLoadingMessages(true);
      setMessages([]);
      setError("");
      try {
        const response = await fetch(chatHistory(selectedNik), { headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Gagal mengambil riwayat chat.");
        const history = await response.json();
        if (!cancelled) setMessages(Array.isArray(history) ? history : []);
        loadConversations(); // refresh unread count
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }

      const token = getAdminToken();
      if (!token) {
        setError("Sesi admin tidak ditemukan, silakan login ulang.");
        return;
      }

      setWsStatus("connecting");
      const ws = new WebSocket(chatWsUrl(selectedNik, token));
      wsRef.current = ws;
      ws.onopen = () => !cancelled && setWsStatus("open");
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          setMessages((prev) => [...prev, JSON.parse(event.data)]);
        } catch (err) {
          console.error("Gagal parse pesan WebSocket:", err);
        }
      };
      ws.onerror = () => !cancelled && setWsStatus("error");
      ws.onclose = (event) => {
        if (cancelled) return;
        setWsStatus("closed");
        if (event.code === 4401) {
          setError("Sesi admin tidak valid untuk chat ini. Silakan login ulang.");
        }
      };
    }

    openChat();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      setWsStatus("idle");
    };
  }, [selectedNik, loadConversations]);

  // Selalu gulir ke pesan terbaru
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loadingMessages, selectedNik]);

  // ---------- ambil alih / selesaikan ----------
  async function claimChat() {
    if (!selectedNik) return;
    if (isTakenByOther) {
      const yakin = window.confirm(`Chat ini sedang ditangani oleh "${handledBy}". Ambil alih chat ini?`);
      if (!yakin) return;
    }
    try {
      setClaiming(true);
      const response = await fetch(API.chatClaim(selectedNik), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Gagal mengambil alih chat.");
      await loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  async function releaseChat() {
    if (!selectedNik) return;
    try {
      setClaiming(true);
      const response = await fetch(API.chatRelease(selectedNik), {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Gagal menyelesaikan chat.");
      await loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  function sendMessage(e) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || wsStatus !== "open" || !wsRef.current || !isMine) return;
    wsRef.current.send(JSON.stringify({ isi_pesan: text }));
    setMessageText("");
  }

  // ---------- turunan ----------
  const filteredList = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.nama_nasabah?.toLowerCase().includes(q) || c.nik_nasabah?.toLowerCase().includes(q)
    );
  });

  // Statistik dihitung dari data nyata daftar percakapan
  const stats = useMemo(() => {
    const total = conversations.length;
    const perluDibalas = conversations.filter((c) => c.last_sender_type === "nasabah").length;
    const dibalas = total - perluDibalas;
    const belumDibaca = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
    return {
      total,
      perluDibalas,
      dibalas,
      belumDibaca,
      persen: total ? Math.round((dibalas / total) * 100) : 0,
    };
  }, [conversations]);

  // Pesan dikelompokkan per hari (WIB) dengan pemisah "Hari ini" / "Kemarin" / tanggal
  const grouped = useMemo(() => {
    const out = [];
    let lastKey = null;
    messages.forEach((m, i) => {
      const key = dayKey(m.created_at);
      if (key !== lastKey) {
        out.push({ type: "day", key: `d-${key}-${i}`, label: dayLabel(key) });
        lastKey = key;
      }
      out.push({ type: "msg", key: m.id ?? `m-${i}`, msg: m });
    });
    return out;
  }, [messages]);

  const statusText =
    wsStatus === "open"
      ? { text: "Terhubung", cls: "text-emerald-600", dot: "bg-emerald-500" }
      : wsStatus === "connecting"
      ? { text: "Menghubungkan...", cls: "text-slate-400", dot: "bg-slate-300" }
      : wsStatus === "error"
      ? { text: "Gagal terhubung", cls: "text-red-500", dot: "bg-red-500" }
      : { text: "Terputus", cls: "text-slate-400", dot: "bg-slate-300" };

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] min-h-[560px] w-full max-w-[1180px] flex-col gap-5">
      {/* ===== Ringkasan ===== */}
      <div className="grid shrink-0 gap-4 md:grid-cols-3">
        <StatCard icon={Users} tone="blue" label="Percakapan" value={stats.total} />
        <StatCard
          icon={CircleCheck}
          tone="green"
          label="Sudah dibalas"
          value={stats.dibalas}
          hint={stats.total ? `${stats.persen}%` : ""}
        />
        <StatCard
          icon={MessageSquareWarning}
          tone="red"
          label="Perlu dibalas"
          value={stats.perluDibalas}
          hint={stats.belumDibaca ? `${stats.belumDibaca} belum dibaca` : ""}
        />
      </div>

      {error && (
        <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ===== Panel utama ===== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* --- daftar chat --- */}
        <aside className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="shrink-0 p-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari percakapan..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && (
              <div className="p-6 text-center text-sm text-slate-400">Memuat daftar chat...</div>
            )}

            {!loadingList &&
              filteredList.map((c) => {
                const active = selectedNik === c.nik_nasabah;
                const mine = c.handled_by && c.handled_by === myUsername;
                const dot = mine ? "bg-emerald-500" : c.handled_by ? "bg-amber-400" : "";
                return (
                  <button
                    key={c.nik_nasabah}
                    type="button"
                    onClick={() => setSelectedNik(c.nik_nasabah)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3.5 text-left transition ${
                      active ? "bg-emerald-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
                        {initial(c)}
                      </div>
                      {dot && (
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${dot}`}
                          title={mine ? "Kamu tangani" : `Ditangani ${c.handled_by}`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {c.nama_nasabah || c.nik_nasabah}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {listTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-xs ${
                            c.unread_count > 0 ? "font-semibold text-slate-700" : "text-slate-500"
                          }`}
                        >
                          {c.last_sender_type === "admin" ? "Anda: " : ""}
                          {c.last_message || "Belum ada pesan"}
                        </p>
                        {c.unread_count > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      {c.handled_by && !mine && (
                        <p className="mt-1 text-[10px] font-semibold text-amber-600">
                          Ditangani {c.handled_by}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}

            {!loadingList && filteredList.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">
                {search ? "Percakapan tidak ditemukan." : "Belum ada nasabah yang chat."}
              </div>
            )}
          </div>
        </aside>

        {/* --- detail chat --- */}
        {selectedNik ? (
          <section className="flex min-h-0 min-w-0 flex-col bg-slate-50">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-600">
                  {selected ? initial(selected) : "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {selected?.nama_nasabah || selectedNik}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusText.dot}`} />
                    <span className={statusText.cls}>{statusText.text}</span>
                    <span className="text-slate-400">(NIK: {selectedNik})</span>
                  </p>
                </div>
              </div>

              {isMine ? (
                <button
                  onClick={releaseChat}
                  disabled={claiming}
                  title="Lepas chat ini supaya admin lain bisa menanganinya"
                  className="flex items-center gap-2 rounded-lg border border-emerald-600 px-3.5 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                >
                  <CheckCheck size={14} />
                  Selesaikan Chat
                </button>
              ) : (
                <button
                  onClick={claimChat}
                  disabled={claiming}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <UserCheck size={14} />
                  {isTakenByOther ? `Ambil Alih dari ${handledBy}` : "Ambil Alih Chat"}
                </button>
              )}
            </div>

            {!isMine && (
              <div
                className={`shrink-0 px-5 py-2 text-center text-xs font-medium sm:px-6 ${
                  isTakenByOther ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {isTakenByOther
                  ? `Chat ini sedang ditangani oleh admin "${handledBy}". Klik "Ambil Alih" untuk membalas.`
                  : 'Belum ada admin yang menangani chat ini. Klik "Ambil Alih Chat" untuk membalas.'}
              </div>
            )}

            {/* pesan */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
              {loadingMessages && (
                <div className="text-center text-sm text-slate-400">Memuat pesan...</div>
              )}

              {!loadingMessages &&
                grouped.map((row) =>
                  row.type === "day" ? (
                    <div key={row.key} className="flex justify-center py-1">
                      <span className="rounded-full bg-slate-200/70 px-3 py-0.5 text-[11px] font-semibold text-slate-500">
                        {row.label}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={row.key}
                      className={`flex ${row.msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-md ${
                          row.msg.sender_type === "admin"
                            ? "rounded-br-sm bg-emerald-600 text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-5">
                          {row.msg.isi_pesan}
                        </p>
                        <p
                          className={`mt-1 text-right text-[10px] ${
                            row.msg.sender_type === "admin" ? "text-emerald-100" : "text-slate-400"
                          }`}
                        >
                          {row.msg.sender_type === "admin" && row.msg.sender_id
                            ? `${row.msg.sender_id} · `
                            : ""}
                          {jam(row.msg.created_at) || "-"}
                        </p>
                      </div>
                    </div>
                  )
                )}

              {!loadingMessages && messages.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-400">Belum ada pesan.</div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* input */}
            <form
              onSubmit={sendMessage}
              className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6"
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={isMine ? "Ketik balasan pesan di sini..." : "Ambil alih chat untuk membalas"}
                disabled={wsStatus !== "open" || !isMine}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={wsStatus !== "open" || !messageText.trim() || !isMine}
                aria-label="Kirim"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Send size={18} />
              </button>
            </form>
          </section>
        ) : (
          <section className="flex min-w-0 items-center justify-center bg-slate-50 p-10">
            <div className="text-center">
              <MessageCircle size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">Pilih nasabah untuk mulai membalas chat.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
