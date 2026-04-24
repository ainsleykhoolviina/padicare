import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Leaf, ScanLine, BarChart3, CloudSun, Bell, ChevronRight, ChevronLeft, CheckCircle, BookOpen } from "lucide-react";

type TutorialStep = {
  icon: React.ElementType;
  titleMs: string;
  titleEn: string;
  contentMs: string[];
  contentEn: string[];
  link?: string;
  linkLabelMs?: string;
  linkLabelEn?: string;
};

const steps: TutorialStep[] = [
  {
    icon: Leaf,
    titleMs: "Tambah Ladang Anda",
    titleEn: "Add Your Farm",
    contentMs: [
      "Klik 'Ladang Saya' di bar navigasi.",
      "Klik butang 'Tambah Ladang' berwarna hijau.",
      "Isi maklumat ladang: nama, lokasi, jenis padi, saiz, dan umur padi.",
      "Pilih fasa pertumbuhan semasa: Tapak Semaian, Pertumbuhan, Pembiakan, Pemasakan, atau Dituai.",
      "Tandakan masalah lepas jika ada (banjir, tikus, penyakit).",
      "Klik 'Simpan' untuk menyimpan rekod ladang.",
    ],
    contentEn: [
      "Click 'My Farm' in the navigation bar.",
      "Click the green 'Add Farm' button.",
      "Fill in farm details: name, location, paddy type, size, and paddy age.",
      "Select the current growth phase: Nursery, Vegetative, Reproductive, Ripening, or Harvested.",
      "Check any previous issues if applicable (flood, rats, disease).",
      "Click 'Save' to save the farm record.",
    ],
    link: "/farms/new",
    linkLabelMs: "Cuba Sekarang",
    linkLabelEn: "Try Now",
  },
  {
    icon: ScanLine,
    titleMs: "Kesan Penyakit Padi",
    titleEn: "Detect Paddy Disease",
    contentMs: [
      "Klik 'Pengesanan Penyakit' di bar navigasi.",
      "Untuk muat naik gambar: Klik kotak upload dan pilih gambar daun padi.",
      "Untuk gunakan kamera: Klik tab 'Kamera' dan tekan 'Ambil Gambar'.",
      "Klik butang 'Kesan Penyakit' berwarna hijau.",
      "Tunggu AI menganalisis gambar (2-3 saat).",
      "Baca keputusan: nama penyakit, tahap keterukan (Ringan/Sedang/Parah), dan peratusan keyakinan.",
      "Klik butang 'Dengar Suara' untuk mendengar diagnosis secara lisan.",
      "Ikuti cadangan rawatan yang diberikan.",
    ],
    contentEn: [
      "Click 'Disease Detection' in the navigation bar.",
      "To upload an image: Click the upload box and select a paddy leaf image.",
      "To use camera: Click the 'Camera' tab and press 'Capture Photo'.",
      "Click the green 'Detect Disease' button.",
      "Wait for AI to analyze the image (2-3 seconds).",
      "Read the result: disease name, severity level (Mild/Moderate/Severe), and confidence percentage.",
      "Click 'Listen' button to hear the diagnosis read aloud.",
      "Follow the treatment recommendations provided.",
    ],
    link: "/disease",
    linkLabelMs: "Cuba Kesan Penyakit",
    linkLabelEn: "Try Disease Detection",
  },
  {
    icon: BarChart3,
    titleMs: "Rancang Sumber Ladang",
    titleEn: "Plan Farm Resources",
    contentMs: [
      "Klik 'Perancangan Sumber' di bar navigasi.",
      "Jika anda sudah ada ladang, pilih dari senarai 'Isi dari ladang sedia ada'.",
      "Atau isi maklumat secara manual: lokasi, jenis padi, saiz, fasa pertumbuhan.",
      "Klik butang 'Dapatkan Rancangan'.",
      "Sistem akan memberikan cadangan: jenis baja, racun perosak, pengurusan air.",
      "Lihat juga anggaran kos (Ringgit Malaysia) dan tenaga kerja yang diperlukan.",
      "Semak senarai aktiviti pertanian yang perlu dilakukan seterusnya.",
    ],
    contentEn: [
      "Click 'Resource Planning' in the navigation bar.",
      "If you have existing farms, select from 'Fill from existing farm' list.",
      "Or fill in details manually: location, paddy type, size, growth phase.",
      "Click the 'Get Plan' button.",
      "The system will provide suggestions: fertilizer types, pesticides, water management.",
      "Also view estimated cost (Malaysian Ringgit) and labor requirements.",
      "Check the list of upcoming farming activities to be done.",
    ],
    link: "/resources",
    linkLabelMs: "Cuba Rancang Sumber",
    linkLabelEn: "Try Resource Planning",
  },
  {
    icon: CloudSun,
    titleMs: "Semak Cuaca & Amaran Awal",
    titleEn: "Check Weather & Early Warnings",
    contentMs: [
      "Klik 'Cuaca' di bar navigasi.",
      "Lihat suhu, kelembapan, hujan, dan kelajuan angin semasa.",
      "Perhatikan amaran cuaca yang muncul (banjir, kemarau, ribut).",
      "Amaran merah bermakna bahaya tinggi — ambil tindakan segera.",
      "Semak ramalan 7 hari ke hadapan untuk merancang kerja ladang.",
      "Ladang dengan masalah air perlu berhati-hati semasa hujan lebat.",
    ],
    contentEn: [
      "Click 'Weather' in the navigation bar.",
      "View current temperature, humidity, rainfall, and wind speed.",
      "Note any weather warnings displayed (flood, drought, storm).",
      "Red warnings mean high danger — take immediate action.",
      "Check the 7-day forecast to plan farm work ahead.",
      "Farms with water issues should be extra careful during heavy rain.",
    ],
    link: "/weather",
    linkLabelMs: "Semak Cuaca",
    linkLabelEn: "Check Weather",
  },
  {
    icon: Bell,
    titleMs: "Pemberitahuan & Peringatan",
    titleEn: "Notifications & Reminders",
    contentMs: [
      "Ikon loceng di bar atas menunjukkan bilangan pemberitahuan belum dibaca.",
      "Klik ikon loceng untuk melihat semua pemberitahuan.",
      "Pemberitahuan merangkumi: amaran cuaca, peringatan tugas, amaran penyakit.",
      "Klik ikon centang (✓) untuk menandakan pemberitahuan sebagai dibaca.",
      "Pemberitahuan dikemas kini setiap 60 saat secara automatik.",
      "Tugas juga boleh diuruskan di bahagian 'Tugas' dengan penapis mengikut ladang.",
    ],
    contentEn: [
      "The bell icon at the top shows the number of unread notifications.",
      "Click the bell icon to view all notifications.",
      "Notifications include: weather warnings, task reminders, disease alerts.",
      "Click the check mark (✓) to mark a notification as read.",
      "Notifications are automatically updated every 60 seconds.",
      "Tasks can also be managed in the 'Tasks' section with filters by farm.",
    ],
    link: "/notifications",
    linkLabelMs: "Lihat Pemberitahuan",
    linkLabelEn: "View Notifications",
  },
];

export default function TutorialPage() {
  const { t, lang } = useLanguage();
  const [current, setCurrent] = useState(0);

  const step = steps[current];
  const Icon = step.icon;
  const progress = ((current + 1) / steps.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("tutorial")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "ms" ? "Pelajari cara menggunakan PadiCare langkah demi langkah" : "Learn how to use PadiCare step by step"}
        </p>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("step")} {current + 1} / {steps.length}</span>
          <span className="font-medium text-primary">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= current ? "bg-primary" : "bg-muted"}`}
              data-testid={`tutorial-step-dot-${i}`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            <Badge variant="outline" className="mb-2 text-xs">{t("step")} {current + 1}</Badge>
            <h2 className="text-xl font-bold text-foreground">
              {lang === "ms" ? step.titleMs : step.titleEn}
            </h2>
          </div>

          <ol className="space-y-3 text-left">
            {(lang === "ms" ? step.contentMs : step.contentEn).map((line, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground leading-relaxed">{line}</span>
              </li>
            ))}
          </ol>

          {step.link && (
            <Link href={step.link}>
              <Button className="w-full mt-6 gap-2" variant="outline" data-testid={`button-tutorial-try-${current}`}>
                {lang === "ms" ? step.linkLabelMs : step.linkLabelEn}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="gap-2"
          data-testid="button-tutorial-prev"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("previous")}
        </Button>

        {current < steps.length - 1 ? (
          <Button
            onClick={() => setCurrent((c) => Math.min(steps.length - 1, c + 1))}
            className="flex-1 gap-2"
            data-testid="button-tutorial-next"
          >
            {t("next")}
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Link href="/" className="flex-1">
            <Button className="w-full gap-2" data-testid="button-tutorial-finish">
              <CheckCircle className="w-4 h-4" />
              {t("finish")}
            </Button>
          </Link>
        )}
      </div>

      {/* All Steps Overview */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium text-foreground mb-3">{lang === "ms" ? "Semua Langkah" : "All Steps"}</p>
          <div className="space-y-2">
            {steps.map((s, i) => {
              const SIcon = s.icon;
              return (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${i === current ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  data-testid={`button-tutorial-goto-${i}`}
                >
                  <SIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{lang === "ms" ? s.titleMs : s.titleEn}</span>
                  {i < current && <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
