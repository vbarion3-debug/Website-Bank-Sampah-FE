import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search,
  Send,
  MessageCircle,
  Lock,
  Unlock,
  UserCheck,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import {
  API,
  getAuthHeaders,
  getAdminToken,
  getAdminUsername,
  chatHistory,
  chatWsUrl,
} from "../api";
import { parseWaktu } from "../utils/waktu"

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

  const selected = conversations.find((c) => c.nik_nasabah === selectedNik) || null;
  const handledBy = selected?.handled_by || null;
  const isMine = handledBy && handledBy === myUsername;
  const isTakenByOther = handledBy && handledBy !== myUsername;

  // =========================================================
  // POLLING DAFTAR PERCAKAPAN (nasabah yang sudah pernah chat)
  // =========================================================
  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(API.chatConversations, {
        headers: getAuthHeaders(),
      });
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

  // =========================================================
  // BUKA CHAT: fetch riwayat (REST) + connect WebSocket
  // =========================================================
  useEffect(() => {
    if (!selectedNik) return;
    let cancelled = false;

    async function openChat() {
      setLoadingMessages(true);
      setMessages([]);
      setError("");

      try {
        const response = await fetch(chatHistory(selectedNik), {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Gagal mengambil riwayat chat.");
        const history = await response.json();
        if (!cancelled) setMessages(Array.isArray(history) ? history : []);
        loadConversations(); // refresh biar unread count ke-update
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

      ws.onopen = () => {
        if (!cancelled) setWsStatus("open");
      };
      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data);
          setMessages((prev) => [...prev, payload]);
        } catch (err) {
          console.error("Gagal parse pesan WebSocket:", err);
        }
      };
      ws.onerror = () => {
        if (!cancelled) setWsStatus("error");
      };
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

  // =========================================================
  // AMBIL ALIH / LEPAS CHAT
  // =========================================================
  async function claimChat() {
    if (!selectedNik) return;
    if (isTakenByOther) {
      const yakin = window.confirm(
        `Chat ini sedang ditangani oleh "${handledBy}". Ambil alih chat ini?`
      );
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
      if (!response.ok) throw new Error("Gagal melepas chat.");
      await loadConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  // =========================================================
  // FILTER LIST (client-side)
  // =========================================================
  const filteredList = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.nama_nasabah?.toLowerCase().includes(q) ||
      c.nik_nasabah?.toLowerCase().includes(q)
    );
  });

  function selectNasabah(c) {
    setSelectedNik(c.nik_nasabah);
  }

  // =========================================================
  // KIRIM PESAN
  // =========================================================
  function sendMessage(e) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || wsStatus !== "open" || !wsRef.current || !isMine) return;
    wsRef.current.send(JSON.stringify({ isi_pesan: text }));
    setMessageText("");
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader title="Live Chat" />

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[650px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* =========================
              DAFTAR CHAT MASUK
          ========================== */}
          <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-5">
              <h2 className="mb-4 font-['Poppins'] font-bold text-slate-800">
                Chat Masuk
              </h2>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <Search size={17} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama atau NIK..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            <div className="max-h-[500px] overflow-y-auto lg:max-h-none">
              {loadingList && (
                <div className="p-6 text-center text-sm text-slate-400">
                  Memuat daftar chat...
                </div>
              )}

              {!loadingList &&
                filteredList.map((c) => (
                  <button
                    key={c.nik_nasabah}
                    type="button"
                    onClick={() => selectNasabah(c)}
                    className={`w-full border-b border-slate-100 p-4 text-left transition ${
                      selectedNik === c.nik_nasabah
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600">
                        {(c.nama_nasabah || c.nik_nasabah)
                          ?.charAt(0)
                          ?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">
                            {c.nama_nasabah || c.nik_nasabah}
                          </p>
                          {c.unread_count > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[11px] font-bold text-white">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {c.last_sender_type === "admin" ? "Anda: " : ""}
                          {c.last_message || "Belum ada pesan"}
                        </p>
                        <div className="mt-1.5">
                          {c.handled_by ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                c.handled_by === myUsername
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              <Lock size={10} />
                              {c.handled_by === myUsername
                                ? "Kamu tangani"
                                : c.handled_by}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                              <Unlock size={10} />
                              Belum ditangani
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

              {!loadingList && filteredList.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-400">
                  Belum ada nasabah yang chat.
                </div>
              )}
            </div>
          </aside>

          {/* =========================
              DETAIL CHAT
          ========================== */}
          {selectedNik ? (
            <section className="flex min-w-0 flex-col bg-slate-50">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-600">
                    {(selected?.nama_nasabah || selectedNik)
                      ?.charAt(0)
                      ?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-800">
                      {selected?.nama_nasabah || selectedNik}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      NIK: {selectedNik} ·{" "}
                      {wsStatus === "open" && (
                        <span className="text-emerald-600">Terhubung</span>
                      )}
                      {wsStatus === "connecting" && "Menghubungkan..."}
                      {wsStatus === "closed" && "Terputus"}
                      {wsStatus === "error" && (
                        <span className="text-red-500">Gagal terhubung</span>
                      )}
                    </p>
                  </div>
                </div>

                {isMine ? (
                  <button
                    onClick={releaseChat}
                    disabled={claiming}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <Unlock size={14} />
                    Lepas Chat
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
                  className={`px-5 py-2.5 text-center text-xs font-medium sm:px-7 ${
                    isTakenByOther
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isTakenByOther
                    ? `Chat ini sedang ditangani oleh admin "${handledBy}". Klik "Ambil Alih" untuk membalas.`
                    : 'Belum ada admin yang menangani chat ini. Klik "Ambil Alih Chat" untuk membalas.'}
                </div>
              )}

              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
                {loadingMessages && (
                  <div className="text-center text-sm text-slate-400">
                    Memuat pesan...
                  </div>
                )}
                {!loadingMessages &&
                  messages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${
                        msg.sender_type === "admin" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-md ${
                          msg.sender_type === "admin"
                            ? "rounded-br-sm bg-emerald-600 text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <p className="break-words text-sm leading-5">{msg.isi_pesan}</p>
                        <p
                          className={`mt-2 text-right text-xs ${
                            msg.sender_type === "admin"
                              ? "text-emerald-100"
                              : "text-slate-400"
                          }`}
                        >
                          {msg.sender_type === "admin" && msg.sender_id
                            ? `${msg.sender_id} · `
                            : ""}
                          {msg.created_at
                            ? parseWaktu(msg.created_at).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </p>
                      </div>
                    </div>
                  ))}
                {!loadingMessages && messages.length === 0 && (
                  <div className="py-10 text-center text-sm text-slate-400">
                    Belum ada pesan.
                  </div>
                )}
              </div>

              <form
                onSubmit={sendMessage}
                className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-white p-4 sm:px-7 sm:py-5"
              >
                <MessageCircle
                  size={20}
                  className="hidden shrink-0 text-slate-400 sm:block"
                />
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={
                    isMine ? "Ketik balasan pesan di sini..." : "Ambil alih chat untuk membalas"
                  }
                  disabled={wsStatus !== "open" || !isMine}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={wsStatus !== "open" || !messageText.trim() || !isMine}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Send size={18} />
                </button>
              </form>
            </section>
          ) : (
            <section className="flex min-w-0 items-center justify-center bg-slate-50 p-10">
              <div className="text-center">
                <MessageCircle size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-400">
                  Pilih nasabah untuk mulai membalas chat.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
