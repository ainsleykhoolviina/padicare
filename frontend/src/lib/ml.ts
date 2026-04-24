import type { DiseasePrediction, Severity, WeeklyTask } from "@/lib/models";
import { apiFetch } from "@/lib/api";

const predictions = [
  {
    disease: "Rice Blast",
    diseaseNameMs: "Barah Padi (Blast)",
    diseaseNameEn: "Rice Blast",
    severity: "sedang" as Severity,
    confidencePercent: 84,
    descriptionMs: "Tompok berbentuk berlian pada daun menunjukkan kemungkinan penyakit blast.",
    descriptionEn: "Diamond-shaped spots on leaves indicate possible rice blast.",
    treatmentMs: "Sembur racun kulat yang sesuai pada waktu pagi dan kurangkan nitrogen berlebihan.",
    treatmentEn: "Apply a suitable fungicide in the morning and reduce excess nitrogen.",
    recommendationsMs: ["Pantau daun baharu dalam 3 hari", "Elakkan baja nitrogen berlebihan", "Pastikan aliran udara baik"],
    recommendationsEn: ["Monitor new leaves in 3 days", "Avoid excessive nitrogen fertilizer", "Ensure good airflow"],
  },
  {
    disease: "Bacterial Blight",
    diseaseNameMs: "Hawar Daun Bakteria",
    diseaseNameEn: "Bacterial Blight",
    severity: "parah" as Severity,
    confidencePercent: 77,
    descriptionMs: "Daun kekuningan dari hujung daun menunjukkan risiko hawar daun bakteria.",
    descriptionEn: "Yellowing from leaf tips indicates bacterial blight risk.",
    treatmentMs: "Asingkan kawasan terjejas, kawal air, dan gunakan varieti rintang pada musim seterusnya.",
    treatmentEn: "Isolate affected areas, manage water, and use resistant varieties next season.",
    recommendationsMs: ["Buang daun terjejas", "Kurangkan pergerakan air antara petak", "Pantau selepas hujan"],
    recommendationsEn: ["Remove affected leaves", "Reduce water movement between plots", "Monitor after rain"],
  },
  {
    disease: "Healthy Paddy",
    diseaseNameMs: "Padi Sihat",
    diseaseNameEn: "Healthy Paddy",
    severity: "ringan" as Severity,
    confidencePercent: 93,
    descriptionMs: "Tiada tanda penyakit utama dikesan pada imej.",
    descriptionEn: "No major disease signs were detected in the image.",
    treatmentMs: "Teruskan pemantauan mingguan dan amalan penjagaan biasa.",
    treatmentEn: "Continue weekly monitoring and normal crop care.",
    recommendationsMs: ["Ambil gambar rujukan setiap minggu", "Pantau kelembapan", "Periksa rumpai dan serangga"],
    recommendationsEn: ["Take reference photos weekly", "Monitor humidity", "Check for weeds and insects"],
  },
];

export async function simulateDiseasePrediction(imageBase64: string): Promise<Omit<DiseasePrediction, "id" | "detectedAt">> {
  if (!imageBase64) {
    throw new Error("Image data is required for prediction.");
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const index = imageBase64.length % predictions.length;
  return {
    ...predictions[index],
    confidencePercent: Math.min(98, predictions[index].confidencePercent + (imageBase64.length % 7)),
    modelUsed: "PadiCare Vision",
  };
}

export async function analyzeDiseaseWithGemini(imageBase64: string, mimeType = "image/jpeg"): Promise<Omit<DiseasePrediction, "id" | "detectedAt">> {
  if (!imageBase64) {
    throw new Error("Image data is required for prediction.");
  }

  let lastError: any;
  for (let i = 0; i < 2; i++) { // Try up to 2 times
    try {
      const response = await apiFetch("/api/ai/disease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Disease analysis failed.");
      }
      return payload as Omit<DiseasePrediction, "id" | "detectedAt">;
    } catch (error) {
      lastError = error;
      if (i === 0) await new Promise(r => setTimeout(r, 2000)); // Wait before retry
    }
  }
  throw lastError;
}

export function generateFollowUpTasks(prediction: Pick<DiseasePrediction, "disease" | "severity" | "recommendationsMs" | "recommendationsEn">, lang: "ms" | "en" = "ms"): WeeklyTask[] {
  const baseDate = Date.now();
  const priority = prediction.severity === "parah" ? "high" : prediction.severity === "sedang" ? "medium" : "low";
  // Create task for each recommendation using the provided recommendations length (assuming Ms and En are same length)
  const maxRecs = Math.max((prediction.recommendationsMs || []).length, (prediction.recommendationsEn || []).length);
  const tasks: WeeklyTask[] = [];
  
  for (let index = 0; index < maxRecs; index++) {
    const titleMs = prediction.recommendationsMs?.[index] || prediction.recommendationsEn?.[index] || "Tugas Susulan";
    const titleEn = prediction.recommendationsEn?.[index] || prediction.recommendationsMs?.[index] || "Follow-up Task";
    const title = lang === "ms" ? titleMs : titleEn;
    
    tasks.push({
      id: crypto.randomUUID(),
      title,
      titleMs,
      titleEn,
      description: `Follow-up for ${prediction.disease}`,
      descriptionMs: `Tugas susulan untuk ${prediction.disease}`,
      descriptionEn: `Follow-up for ${prediction.disease}`,
      category: "disease_follow_up",
      priority,
      dueDate: new Date(baseDate + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      completed: false,
    });
  }
  return tasks;
}
