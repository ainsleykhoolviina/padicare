import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Square } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface VoiceInputProps {
  onResult: (text: string) => void;
  lang?: "ms-MY" | "en-MY" | "ms" | "en";
}

export default function VoiceInput({ onResult, lang: voiceLang }: VoiceInputProps) {
  const { t, lang } = useLanguage();
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SR = (typeof window !== "undefined") &&
    ((window as Window & typeof globalThis & { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ||
     (window as Window & typeof globalThis & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);

  if (!SR) return null;

  const startRecording = () => {
    const recognition = new (SR as typeof SpeechRecognition)();
    recognition.lang = voiceLang || (lang === "ms" ? "ms-MY" : "en-MY");
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      onClick={isRecording ? stopRecording : startRecording}
      title={isRecording ? t("stopRecording") : t("recordVoice")}
      data-testid="button-voice-input"
      className={isRecording ? "animate-pulse" : ""}
    >
      {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  );
}
