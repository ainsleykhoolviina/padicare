import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Mic, MicOff, Globe, Volume2, VolumeX, MessageSquare, Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFarms, useTaskPlans } from "@/services/firestoreService";
import { apiFetch } from "@/lib/api";

type ChatMessage = { role: "user" | "ai"; text: string; id: string };
type HistoryEntry = { role: "user" | "model"; text: string };
type ChatLang = "ms" | "en";
type Mode = "chat" | "live";

let msgCounter = 0;
function nextId() { return `msg-${++msgCounter}`; }

// ─── Markdown → clean JSX ─────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) { elements.push(<div key={i} className="h-1.5" />); return; }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      elements.push(<div key={i} className="flex items-start gap-1.5 my-0.5"><span className="text-primary mt-0.5 shrink-0">•</span><span>{fmt(trimmed.slice(2))}</span></div>);
      return;
    }
    const num = trimmed.match(/^(\d+)\.\s(.+)/);
    if (num) { elements.push(<div key={i} className="flex items-start gap-1.5 my-0.5"><span className="text-primary font-medium shrink-0">{num[1]}.</span><span>{fmt(num[2])}</span></div>); return; }
    if (trimmed.startsWith("### ")) { elements.push(<p key={i} className="font-semibold text-sm mt-2">{trimmed.slice(4)}</p>); return; }
    if (trimmed.startsWith("## ")) { elements.push(<p key={i} className="font-bold text-sm mt-2">{trimmed.slice(3)}</p>); return; }
    elements.push(<p key={i} className="my-0.5">{fmt(trimmed)}</p>);
  });
  return <div className="space-y-0.5">{elements}</div>;
}

function fmt(text: string): React.ReactNode {
  const cleaned = text
    .replace(/\*\*([^*]+)\*\*/g, "\x01$1\x02")
    .replace(/\*([^*]+)\*/g, "\x03$1\x04")
    .replace(/\*/g, "")
    .replace(/\x01([^\x02]+)\x02/g, "**$1**")
    .replace(/\x03([^\x04]+)\x04/g, "*$1*");
  return cleaned.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

function speakText(text: string, lang: ChatLang, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  window.speechSynthesis.cancel();
  // Strip markdown for clean speech
  const clean = text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^#+\s/gm, "").replace(/^[-•]\s/gm, "");
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang === "ms" ? "ms-MY" : "en-MY";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  if (onEnd) utterance.onend = onEnd;
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return utterance;
}

function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [chatLang, setChatLang] = useState<ChatLang>("ms");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("chat");
  const [liveStatus, setLiveStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveRecRef = useRef<any>(null);

  const { user } = useAuth();
  const { lang } = useLanguage();
  const { data: farms } = useFarms(user?.id);
  const { data: plans } = useTaskPlans(user?.id);

  useEffect(() => { setChatLang(lang as ChatLang); }, [lang]);

  const greeting = useCallback((l: ChatLang) =>
    l === "ms"
      ? `Hai ${user?.name || "Petani"}! Saya PARE, pembantu pertanian pintar anda. Apa yang boleh saya bantu hari ini?`
      : `Hello ${user?.name || "Farmer"}! I'm PARE, your smart farming assistant. How can I help you today?`
  , [user]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: "ai", text: greeting(chatLang), id: nextId() }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Cleanup on unmount
  useEffect(() => () => { stopSpeaking(); recognitionRef.current?.stop(); liveRecRef.current?.stop(); }, []);

  const handleLangSwitch = (l: ChatLang) => {
    setChatLang(l);
    stopSpeaking();
    setSpeakingId(null);
    setMessages([{ role: "ai", text: greeting(l), id: nextId() }]);
    setHistory([]);
  };

  const buildContext = (): string => {
    if (farms.length === 0) return "No farms registered yet.";
    const pending = plans.flatMap((p) => p.tasks).filter((t) => !t.completed).length;
    const summaries = farms.slice(0, 3).map(
      (f) => `${f.name} (${f.paddyType}, ${f.paddyAgeRange}d, ${f.growthPhase})`
    ).join("; ");
    return `${farms.length} farm(s): ${summaries}. Pending tasks: ${pending}.`;
  };

  // ─── Send message (used by both chat and live mode) ─────────────────────────

  const sendMessage = useCallback(async (text: string, speakReply = false): Promise<string | null> => {
    const userMessage = text.trim();
    if (!userMessage) return null;

    const userMsg: ChatMessage = { role: "user", text: userMessage, id: nextId() };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setSuggestions([]);

    try {
      const res = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [...history].slice(-10),
          message: userMessage,
          language: chatLang,
          context: buildContext(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data.reply || (chatLang === "ms" ? "Maaf, saya tidak dapat menjawab." : "Sorry, I could not answer that.");

      // Capture follow-up suggestions from AI
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : []);

      const aiMsg: ChatMessage = { role: "ai", text: reply, id: nextId() };
      setMessages((prev) => [...prev, aiMsg]);
      setHistory((prev) => [...prev, { role: "user", text: userMessage }, { role: "model", text: reply }]);

      if (speakReply) {
        setSpeakingId(aiMsg.id);
        speakText(reply, chatLang, () => setSpeakingId(null));
      }

      return reply;
    } catch {
      const errText = chatLang === "ms" ? "Maaf, ralat berlaku. Sila cuba lagi." : "Sorry, something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "ai", text: errText, id: nextId() }]);
      setSuggestions([]);
      return null;
    } finally {
      setIsTyping(false);
    }
  }, [history, chatLang, farms, plans]);

  // ─── Chat mode: text send ──────────────────────────────────────────────────

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    setInput("");
    sendMessage(text);
  };

  // ─── Chat mode: voice input (fills text box) ──────────────────────────────

  const toggleVoiceInput = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    rec.lang = chatLang === "ms" ? "ms-MY" : "en-MY";
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); inputRef.current?.focus(); };
    recognitionRef.current = rec;
    rec.start();
  }, [isListening, chatLang]);

  // ─── Per-message TTS ──────────────────────────────────────────────────────

  const toggleSpeak = (msg: ChatMessage) => {
    if (speakingId === msg.id) { stopSpeaking(); setSpeakingId(null); return; }
    stopSpeaking();
    setSpeakingId(msg.id);
    speakText(msg.text, chatLang, () => setSpeakingId(null));
  };

  // ─── Live conversation mode ───────────────────────────────────────────────

  const startLiveConversation = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setMode("live");
    setLiveStatus("listening");

    const rec = new SR();
    rec.lang = chatLang === "ms" ? "ms-MY" : "en-MY";
    rec.interimResults = false;
    rec.continuous = false;

    rec.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript;
      setLiveStatus("thinking");
      const reply = await sendMessage(transcript, false);
      if (reply) {
        setLiveStatus("speaking");
        speakText(reply, chatLang, () => {
          // After PARE finishes speaking, listen again
          if (liveRecRef.current) {
            setLiveStatus("listening");
            try { liveRecRef.current.start(); } catch { setLiveStatus("idle"); setMode("chat"); }
          }
        });
      } else {
        setLiveStatus("listening");
        try { rec.start(); } catch { setLiveStatus("idle"); setMode("chat"); }
      }
    };

    rec.onerror = () => { setLiveStatus("idle"); setMode("chat"); };
    rec.onend = () => {
      // Only restart if still in live mode and not speaking/thinking
      // (onend fires after each utterance in non-continuous mode)
    };

    liveRecRef.current = rec;
    rec.start();
  }, [chatLang, sendMessage]);

  const stopLiveConversation = () => {
    liveRecRef.current?.stop();
    liveRecRef.current = null;
    stopSpeaking();
    setLiveStatus("idle");
    setMode("chat");
  };

  const voiceSupported = typeof window !== "undefined" && (
    !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
  );

  // ─── Live mode status display ─────────────────────────────────────────────

  const liveStatusText = {
    idle: "",
    listening: chatLang === "ms" ? "PARE sedang mendengar..." : "PARE is listening...",
    thinking: chatLang === "ms" ? "PARE sedang berfikir..." : "PARE is thinking...",
    speaking: chatLang === "ms" ? "PARE sedang bercakap..." : "PARE is speaking...",
  };

  const liveStatusColor = {
    idle: "",
    listening: "text-red-500",
    thinking: "text-primary",
    speaking: "text-green-500",
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open PARE"
            className="fixed bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center z-50"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[560px] bg-card/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary/10 border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-sm">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">PARE</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {chatLang === "ms" ? "Pembantu Pertanian Pintar" : "Smart Farming Assistant"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => handleLangSwitch(chatLang === "ms" ? "en" : "ms")}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold hover:bg-muted transition-colors text-muted-foreground"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {chatLang === "ms" ? "MS" : "EN"}
                </button>
                <Button variant="ghost" size="icon" onClick={() => { setIsOpen(false); stopSpeaking(); }} className="h-8 w-8 rounded-full">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                        : "bg-muted text-foreground border border-border/40 rounded-bl-sm"
                    }`}>
                      {msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
                    </div>
                    {/* Speaker button for AI messages */}
                    {msg.role === "ai" && (
                      <button
                        onClick={() => toggleSpeak(msg)}
                        className={`self-start flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                          speakingId === msg.id
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {speakingId === msg.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        {speakingId === msg.id
                          ? (chatLang === "ms" ? "Berhenti" : "Stop")
                          : (chatLang === "ms" ? "Dengar" : "Listen")}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-muted border border-border/40 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Suggestion bubbles */}
              {!isTyping && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-1.5 pt-1"
                >
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(""); sendMessage(s); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live conversation status bar */}
            {mode === "live" && (
              <div className="px-4 py-3 border-t border-border bg-background/80 shrink-0">
                <div className="flex flex-col items-center gap-3">
                  {/* Animated ring */}
                  <div className="relative">
                    <motion.div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${
                        liveStatus === "listening" ? "bg-red-500/10" :
                        liveStatus === "thinking" ? "bg-primary/10" :
                        liveStatus === "speaking" ? "bg-green-500/10" : "bg-muted"
                      }`}
                      animate={liveStatus === "listening" ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      {liveStatus === "listening" && <Mic className="w-6 h-6 text-red-500" />}
                      {liveStatus === "thinking" && (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Sparkles className="w-6 h-6 text-primary" />
                        </motion.div>
                      )}
                      {liveStatus === "speaking" && <Volume2 className="w-6 h-6 text-green-500" />}
                    </motion.div>
                    {liveStatus === "listening" && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-red-400"
                        animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <p className={`text-xs font-medium ${liveStatusColor[liveStatus]}`}>
                    {liveStatusText[liveStatus]}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2 rounded-full px-5"
                    onClick={stopLiveConversation}
                  >
                    <PhoneOff className="w-4 h-4" />
                    {chatLang === "ms" ? "Tamat Perbualan" : "End Conversation"}
                  </Button>
                </div>
              </div>
            )}

            {/* Chat input (hidden during live mode) */}
            {mode === "chat" && (
              <div className="px-3 pb-3 pt-2 border-t border-border bg-background/80 shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-full pl-4 pr-1.5 py-1.5 focus-within:ring-1 focus-within:ring-primary transition-shadow"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={chatLang === "ms" ? "Tanya PARE..." : "Ask PARE..."}
                    className="flex-1 bg-transparent border-none text-sm focus:outline-none min-w-0"
                    disabled={isTyping}
                  />
                  {/* Voice input */}
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                        isListening ? "bg-red-500 text-white animate-pulse" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {/* Send */}
                  <Button type="submit" size="icon" disabled={!input.trim() || isTyping}
                    className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-white shrink-0">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>

                {isListening && (
                  <p className="text-xs text-center text-red-500 mt-1.5 animate-pulse">
                    {chatLang === "ms" ? "Sedang mendengar..." : "Listening..."}
                  </p>
                )}

                {/* Live conversation button */}
                {voiceSupported && (
                  <button
                    onClick={startLiveConversation}
                    disabled={isTyping}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors disabled:opacity-50"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {chatLang === "ms" ? "Perbualan Langsung dengan PARE" : "Live Conversation with PARE"}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
