import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import { API, getAccessToken, getAuthHeaders, chatWsUrl } from "../api";
import { parseWaktu } from "../utils/waktu"

export default function LiveChat({ onNavigate }) {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [wsStatus, setWsStatus] = useState("idle");
  const [error, setError] = useState("");

  const wsRef = useRef(null);
  const bottomRef = useRef(null);

  const nav = (id) => {
    if (id === "dashboard") onNavigate("dashboard");
    else if (id === "withdraw") onNavigate("withdraw");
    else if (id === "profile") onNavigate("profile");
  };

  // =========================================================
  // LOAD RIWAYAT + CONNECT WEBSOCKET
  // =========================================================
  useEffect(() => {
    let cancelled = false;

    async function openChat() {
      setLoadingMessages(true);
      setError("");
      try {
        const response = await fetch(API.chatHistory, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Gagal mengambil riwayat chat.");
        const history = await response.json();
        if (!cancelled) setMessages(Array.isArray(history) ? history : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }

      const token = getAccessToken();
      if (!token) {
        setError("Sesi tidak ditemukan, silakan login ulang.");
        return;
      }

      setWsStatus("connecting");
      const ws = new WebSocket(chatWsUrl(token));
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
          setError("Sesi tidak valid, silakan login ulang.");
        }
      };
    }

    openChat();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || wsStatus !== "open" || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ isi_pesan: text }));
    setMessageText("");
  }

  return (
    <PhoneShell bottom={<BottomNav active="chat" onNavigate={nav} />}>
      <div className="flex h-full min-h-[780px] flex-col bg-slate-50">
        {/* HEADER */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <p className="font-['Poppins'] text-base font-bold text-slate-800">
              Live Chat
            </p>
            <p className="text-xs text-slate-400">
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
        </header>

        {error && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ISI CHAT */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loadingMessages && (
            <div className="text-center text-sm text-slate-400">
              Memuat pesan...
            </div>
          )}
          {!loadingMessages && messages.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-400">
              Belum ada pesan. Mulai chat dengan admin di bawah ini.
            </div>
          )}
          {!loadingMessages &&
            messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex ${
                  msg.sender_type === "nasabah" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.sender_type === "nasabah"
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="break-words text-sm leading-5">{msg.isi_pesan}</p>
                  <p
                    className={`mt-2 text-right text-xs ${
                      msg.sender_type === "nasabah"
                        ? "text-emerald-100"
                        : "text-slate-400"
                    }`}
                  >
                    {msg.sender_type === "admin" ? "Admin · " : ""}
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
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <form
          onSubmit={sendMessage}
          className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white p-4"
        >
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Ketik pesan..."
            disabled={wsStatus !== "open"}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={wsStatus !== "open" || !messageText.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </PhoneShell>
  );
}
