import { useState, useRef, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { saveDiseaseDetection, saveTaskPlan, startOfWeek, useDiseaseDetections, useFarms } from "@/services/firestoreService";
import { analyzeDiseaseWithGemini, generateFollowUpTasks } from "@/lib/ml";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Camera, ScanLine, Volume2, VolumeX, RefreshCw, ClipboardCheck, X } from "lucide-react";
import type { DiseasePrediction, WeeklyTask } from "@/lib/models";

const severityColors: Record<string, string> = { ringan: "bg-green-100 text-green-800 border-green-300", sedang: "bg-amber-100 text-amber-800 border-amber-300", parah: "bg-red-100 text-red-800 border-red-300" };

export default function DiseaseDetectionPage() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { data: farms } = useFarms(user?.id);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const [result, setResult] = useState<DiseasePrediction | null>(null);
  const [followUpTasks, setFollowUpTasks] = useState<WeeklyTask[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { data: history, isLoading: historyLoading } = useDiseaseDetections(user?.id);

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setResult(null);
    setFollowUpTasks([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTabChange = () => {
    clearImage();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError(t("imageTooLarge")); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { const dataUrl = ev.target?.result as string; setImagePreview(dataUrl); setImageBase64(dataUrl.split(",")[1]); setImageMimeType(file.type || "image/jpeg"); setResult(null); setFollowUpTasks([]); setError(null); };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileChange({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
  }, []);

  const handleDetect = async () => {
    if (!imageBase64 || !user) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const prediction = await analyzeDiseaseWithGemini(imageBase64, imageMimeType);

      // Reject non-paddy images
      if (prediction.disease === "Not a paddy plant") {
        setError(lang === "ms" ? prediction.descriptionMs : prediction.descriptionEn);
        setResult(null);
        setFollowUpTasks([]);
        return;
      }

      const farmIdToSave = selectedFarmId && selectedFarmId !== "none" ? selectedFarmId : null;
      const detectionId = await saveDiseaseDetection(user.id, prediction, farmIdToSave);
      const selectedFarm = farms.find((f) => f.id === selectedFarmId);
      const savedResult = { ...prediction, id: detectionId, farmId: farmIdToSave, detectedAt: new Date().toISOString() } as DiseasePrediction;
      const tasks = generateFollowUpTasks(savedResult, lang);
      await saveTaskPlan(user.id, {
        farmId: farmIdToSave,
        farmName: selectedFarm?.name ?? (lang === "ms" ? "Susulan Penyakit" : "Disease Follow-up"),
        weekStart: startOfWeek().toISOString(),
        source: "disease_follow_up",
        tasks,
      });
      setResult(savedResult);
      setFollowUpTasks(tasks);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(message || (lang === "ms" ? "Gagal menganalisis imej. Sila cuba lagi." : "Could not analyze the image. Please try again."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startCamera = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } setCameraActive(true); } catch { setError(t("cameraPermission")); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setImagePreview(dataUrl);
    setImageBase64(dataUrl.split(",")[1]);
    setImageMimeType("image/jpeg");
    setResult(null);
    setFollowUpTasks([]);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraActive(false);
  };

  const speakResult = () => {
    if (!result) return;
    if (isSpeaking) { window.speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const recommendations = (lang === "ms" ? result.recommendationsMs : result.recommendationsEn) || [];
    const text = lang === "ms" ? `Penyakit dikesan: ${result.diseaseNameMs}. Tahap keterukan: ${t(result.severity)}. Keyakinan: ${result.confidencePercent.toFixed(1)} peratus. Cadangan: ${recommendations.join(", ")}` : `Disease detected: ${result.diseaseNameEn}. Severity: ${t(result.severity)}. Confidence: ${result.confidencePercent.toFixed(1)} percent. Recommendations: ${recommendations.join(", ")}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "ms" ? "ms-MY" : "en-MY";
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("detectDisease")}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {lang === "ms" ? "Muat naik gambar daun padi untuk analisis AI" : "Upload a paddy leaf image for AI analysis"}
        </p>
      </div>

      {/* Optional farm selector */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <Label className="text-sm">{lang === "ms" ? "Dari sawah mana? (pilihan)" : "From which farm? (optional)"}</Label>
          <Select value={selectedFarmId} onValueChange={setSelectedFarmId}>
            <SelectTrigger data-testid="select-detection-farm">
              <SelectValue placeholder={lang === "ms" ? "Tiada — pengesanan umum" : "None — general detection"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{lang === "ms" ? "Tiada — pengesanan umum" : "None — general detection"}</SelectItem>
              {farms.map((farm) => (
                <SelectItem key={farm.id} value={farm.id}>{farm.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {lang === "ms"
              ? "Pilih sawah untuk mengaitkan pengesanan penyakit dengan pelan sumber ladang tersebut."
              : "Select a farm to link this detection to that farm's resource plan."}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="upload" onValueChange={handleTabChange}>
        <TabsList className="w-full">
          <TabsTrigger value="upload" className="flex-1 gap-2" data-testid="tab-upload">
            <Upload className="w-4 h-4" />{t("uploadImage")}
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex-1 gap-2" data-testid="tab-camera">
            <Camera className="w-4 h-4" />{t("cameraMode")}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-2" data-testid="tab-history">
            <ScanLine className="w-4 h-4" />{t("history")}
          </TabsTrigger>
        </TabsList>

        {/* ── Upload Tab ── */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => !imagePreview && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                data-testid="zone-upload"
              >
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                    <button
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:opacity-90"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                      <Upload className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("uploadPrompt")}</p>
                    <p className="text-xs text-muted-foreground">{t("supportedFormats")}</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} data-testid="input-file" />
              {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
              <Button className="w-full mt-4 gap-2" disabled={!imageBase64 || isAnalyzing} onClick={handleDetect} data-testid="button-detect">
                <ScanLine className="w-4 h-4" />
                {isAnalyzing ? t("analyzing") : t("detectBtn")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Camera Tab ── */}
        <TabsContent value="camera" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              {/* Camera / Captured image area */}
              <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: 240 }}>
                {/* Single video element — shown when camera active, hidden otherwise */}
                <video
                  ref={videoRef}
                  className={`w-full max-h-64 object-contain ${cameraActive ? "" : "hidden"}`}
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Captured image preview */}
                {imagePreview && !cameraActive && (
                  <div className="relative">
                    <img src={imagePreview} alt="Captured" className="w-full max-h-64 object-contain" />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:opacity-90"
                      aria-label="Remove image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Placeholder when no camera and no image */}
                {!cameraActive && !imagePreview && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Camera className="w-12 h-12 mx-auto opacity-60 mb-2" />
                      <p className="text-sm opacity-60">{lang === "ms" ? "Kamera belum aktif" : "Camera not active"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera controls */}
              {!imagePreview && !cameraActive && (
                <Button className="w-full gap-2" onClick={startCamera} data-testid="button-start-camera">
                  <Camera className="w-4 h-4" />
                  {lang === "ms" ? "Buka Kamera" : "Open Camera"}
                </Button>
              )}
              {cameraActive && (
                <Button className="w-full gap-2" onClick={capturePhoto} variant="secondary" data-testid="button-capture">
                  <Camera className="w-4 h-4" />
                  {t("photoCaptured")}
                </Button>
              )}
              {imagePreview && !cameraActive && (
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" variant="outline" onClick={() => { clearImage(); startCamera(); }}>
                    <Camera className="w-4 h-4" />
                    {lang === "ms" ? "Ambil Semula" : "Retake"}
                  </Button>
                  <Button className="flex-1 gap-2" disabled={!imageBase64 || isAnalyzing} onClick={handleDetect} data-testid="button-detect-camera">
                    <ScanLine className="w-4 h-4" />
                    {isAnalyzing ? t("analyzing") : t("detectBtn")}
                  </Button>
                </div>
              )}

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-4">
          {historyLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : history.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">{t("noHistory")}</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {history.map((record) => {
                const linkedFarm = record.farmId ? farms.find((f) => f.id === record.farmId) : null;
                return (
                <Card key={record.id} data-testid={`history-item-${record.id}`}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{lang === "ms" ? record.diseaseNameMs : record.diseaseNameEn}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(record.detectedAt).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}
                          {linkedFarm ? ` · ${linkedFarm.name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge className={`text-xs border ${severityColors[record.severity] || ""}`}>{t(record.severity)}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{record.confidencePercent.toFixed(1)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Analyzing spinner ── */}
      {isAnalyzing && (
        <Card className="border-primary/30">
          <CardContent className="py-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-primary">{t("analyzing")}</p>
              <p className="text-xs text-muted-foreground">PadiCare AI</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Result card ── */}
      {result && !isAnalyzing && (
        <Card className="border-primary/20" data-testid="disease-result">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("diseaseResult")}</CardTitle>
              <Button variant="outline" size="sm" onClick={speakResult} className="gap-1.5" data-testid="button-speak-result">
                {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                {isSpeaking ? t("stopVoice") : t("listenVoice")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-foreground">{lang === "ms" ? result.diseaseNameMs : result.diseaseNameEn}</p>
                <p className="text-xs text-muted-foreground italic mt-0.5">{result.disease}</p>
              </div>
              <Badge className={`text-sm px-3 py-1 border ${severityColors[result.severity] || ""}`} data-testid="badge-severity">{t(result.severity)}</Badge>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t("confidence")}</span>
                <span className="font-bold text-primary">{result.confidencePercent.toFixed(1)}%</span>
              </div>
              <Progress value={result.confidencePercent} className="h-2" data-testid="progress-confidence" />
            </div>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm">{lang === "ms" ? result.descriptionMs : result.descriptionEn}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">{lang === "ms" ? "Cadangan" : "Recommendations"}</h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-900">{lang === "ms" ? result.treatmentMs : result.treatmentEn}</p>
                <ul className="space-y-1 mt-2">
                  {((lang === "ms" ? result.recommendationsMs : result.recommendationsEn) || []).map((item) => (
                    <li key={item} className="text-sm text-green-900">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {followUpTasks.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  {lang === "ms" ? "Senarai Tugas Susulan" : "Follow-up Checklist"}
                </h4>
                <div className="space-y-2">
                  {followUpTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2 rounded-lg border p-2">
                      <Checkbox checked={false} />
                      <div>
                        <p className="text-sm font-medium">{(lang === "ms" ? task.titleMs : task.titleEn) || task.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(task.dueDate).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { setResult(null); setImagePreview(null); setImageBase64(null); setFollowUpTasks([]); }}
              data-testid="button-scan-again"
            >
              <RefreshCw className="w-4 h-4" />
              {lang === "ms" ? "Imbas Semula" : "Scan Again"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
