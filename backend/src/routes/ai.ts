import { Router } from "express";
import { z } from "zod";
import { vertexClient, vertexModel, tunedDiseaseModel } from "../lib/vertexai";
import {
  TUNED_SYSTEM_INSTRUCTION,
  TUNED_SAFETY_SETTINGS,
  TUNED_TOOLS,
} from "../lib/tunedModelConfig";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

type GeminiResult = {
  disease: string; diseaseNameMs: string; diseaseNameEn: string;
  severity: "ringan" | "sedang" | "parah";
  confidencePercent: number;
  descriptionMs: string; descriptionEn: string;
  treatmentMs: string; treatmentEn: string;
  recommendationsMs: string[];
  recommendationsEn: string[];
};

function normalizeSeverity(v: unknown): GeminiResult["severity"] {
  if (v === "parah" || v === "sedang" || v === "ringan") return v;
  return "sedang";
}

router.post("/ai/disease", requireAuth, async (req, res, next) => {
  try {
    const client = vertexClient;
    const model = tunedDiseaseModel || vertexModel;
    const isTuned = !!tunedDiseaseModel;
    logger.info({ model, isTuned }, "Disease detection using model");

    const imageBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64 : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/jpeg";
    if (!imageBase64) return res.status(400).json({ message: "imageBase64 is required." });

    const prompt = `You are PadiCare, a specialized agricultural AI assistant for Malaysian paddy (rice) farmers.
You are an expert in Oryza sativa diseases common in Malaysia and Southeast Asia.

STEP 1 — VALIDATE IMAGE:
First, determine if the image shows a paddy/rice plant (Oryza sativa) or any part of it (leaf, stem, panicle, grain, root).
If it does NOT (e.g. person, animal, object, soil only, other crops, blurry/unclear), return ONLY this JSON:
{
  "disease": "Not a paddy plant",
  "diseaseNameMs": "Bukan tanaman padi",
  "diseaseNameEn": "Not a paddy plant",
  "severity": "ringan",
  "confidencePercent": 0,
  "descriptionMs": "Imej yang dihantar bukan tanaman padi. Sila hantar gambar daun, batang, atau bahagian tanaman padi yang jelas.",
  "descriptionEn": "The uploaded image does not appear to be a paddy plant. Please upload a clear image of a paddy leaf, stem, or plant.",
  "treatmentMs": "Tiada rawatan diperlukan.",
  "treatmentEn": "No treatment needed.",
  "recommendations": ["Sila ambil gambar tanaman padi yang jelas", "Pastikan gambar menunjukkan daun atau batang padi", "Elakkan menghantar gambar yang tidak berkaitan"]
}

STEP 2 — DISEASE IDENTIFICATION:
If it IS a paddy plant, identify the disease by matching ONLY from this official list of known Malaysian paddy diseases.
Do NOT invent disease names outside this list.

KNOWN DISEASES (match visual symptoms carefully):
1. Blast (Padi Blas) — Oryza sativa blast caused by Magnaporthe oryzae
   Symptoms: Diamond/eye-shaped lesions with grey center and brown border on leaves; neck rot at panicle base; white/grey lesions on nodes
   
2. Brown Spot (Bintik Perang) — caused by Cochliobolus miyabeanus
   Symptoms: Oval/circular brown spots with yellow halo on leaves; dark brown spots on grains; scattered lesions across leaf blade

3. Bacterial Leaf Blight (Hawar Daun Bakteria) — caused by Xanthomonas oryzae pv. oryzae
   Symptoms: Water-soaked to yellow-orange lesions starting from leaf tips/margins; wilting of leaves (kresek); lesions spread along leaf edges

4. Sheath Blight (Hawar Seludang) — caused by Rhizoctonia solani
   Symptoms: Oval/irregular greenish-grey lesions with brown border on leaf sheath near waterline; lesions may spread to upper leaves; white mycelium visible

5. Sheath Rot (Reput Seludang) — caused by Sarocladium oryzae
   Symptoms: Irregular brown lesions on uppermost leaf sheath; white powdery fungal growth inside sheath; partially filled or empty grains

6. Tungro (Tungro) — caused by Rice Tungro Bacilliform Virus (RTBV) + Rice Tungro Spherical Virus (RTSV)
   Symptoms: Yellow-orange discoloration of leaves starting from tip; stunted plant growth; reduced tillering; mottled appearance

7. False Smut (Smut Palsu) — caused by Ustilaginoidea virens
   Symptoms: Individual grains replaced by orange/yellow/green velvety balls (chlamydospore masses) on panicle

8. Narrow Brown Leaf Spot (Bintik Daun Perang Sempit) — caused by Cercospora janseana
   Symptoms: Narrow, linear brown streaks/spots along leaf veins; dark brown color; more common in older leaves

9. Bakanae / Foot Rot (Reput Kaki) — caused by Fusarium fujikuroi
   Symptoms: Abnormally tall/elongated seedlings; pale green/yellow color; thin stems; seedling death; white/pink fungal growth at stem base

10. Healthy Paddy (Padi Sihat) — no disease
    Symptoms: Uniform green color; no lesions, spots, or discoloration; normal growth

STEP 3 — CONFIDENCE SCORING:
- Only report confidencePercent above 60 if symptoms clearly match
- If symptoms are ambiguous or partially match, set confidencePercent between 40-60 and note uncertainty in description
- If the plant looks healthy with no visible symptoms, return "Healthy Paddy" with high confidence

Return ONLY valid JSON with these exact fields, no extra text:
{
  "disease": "exact English disease name from the list above",
  "diseaseNameMs": "Bahasa Melayu name from the list above",
  "diseaseNameEn": "English name from the list above",
  "severity": "ringan | sedang | parah",
  "confidencePercent": number 0-100,
  "descriptionMs": "specific description of visible symptoms seen in THIS image in Bahasa Melayu",
  "descriptionEn": "specific description of visible symptoms seen in THIS image in English",
  "treatmentMs": "practical step-by-step treatment in Bahasa Melayu for Malaysian paddy farmers",
  "treatmentEn": "practical step-by-step treatment in English",
  "recommendationsMs": ["3 to 5 specific follow-up action items in Bahasa Melayu"],
  "recommendationsEn": ["3 to 5 specific follow-up action items in English"]
}

LANGUAGE PROTOCOL:
- descriptionMs, treatmentMs, and recommendationsMs MUST be entirely in Bahasa Melayu.
- descriptionEn, treatmentEn, and recommendationsEn MUST be entirely in English.
- Do NOT mix languages within any single field.`;


    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        // controlled generation (responseMimeType) is incompatible with Search tool
        // so only use it for the base model; tuned model returns structured output by training
        ...(isTuned ? {} : { responseMimeType: "application/json" as const }),
        temperature: isTuned ? 1 : 0.1,
        topP: isTuned ? 1 : 0.8,
        maxOutputTokens: isTuned ? 65535 : undefined,
        safetySettings: TUNED_SAFETY_SETTINGS,
        ...(isTuned
          ? {
              systemInstruction: TUNED_SYSTEM_INSTRUCTION,
              tools: TUNED_TOOLS,
              thinkingConfig: { thinkingBudget: -1 },
            }
          : {
              thinkingConfig: { thinkingBudget: 0 },
            }
        ),
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ message: "Could not parse Vertex AI response." });
    const parsed = JSON.parse(match[0]) as Partial<GeminiResult>;

    return res.json({
      disease: parsed.disease || "Unknown",
      diseaseNameMs: parsed.diseaseNameMs || "Tidak diketahui",
      diseaseNameEn: parsed.diseaseNameEn || "Unknown",
      severity: normalizeSeverity(parsed.severity),
      confidencePercent: Math.max(0, Math.min(100, Number(parsed.confidencePercent) || 0)),
      descriptionMs: parsed.descriptionMs || "",
      descriptionEn: parsed.descriptionEn || "",
      treatmentMs: parsed.treatmentMs || "",
      treatmentEn: parsed.treatmentEn || "",
      recommendationsMs: Array.isArray(parsed.recommendationsMs) ? parsed.recommendationsMs.slice(0, 5).map(String) : [],
      recommendationsEn: Array.isArray(parsed.recommendationsEn) ? parsed.recommendationsEn.slice(0, 5).map(String) : [],
      modelUsed: model,
    });
  } catch (error) {
    logger.error({ error }, "Error in /ai/disease route");
    next(error);
  }
});

const ChatMessageSchema = z.object({
  role: z.enum(["user", "model", "system"]),
  text: z.string().min(1),
});

const ChatRequestSchema = z.object({
  history: z.array(ChatMessageSchema).default([]),
  message: z.string().min(1),
  language: z.enum(["en", "ms"]).default("en"),
  context: z.string().optional(),
});

router.post("/ai/chat", requireAuth, async (req, res, next) => {
  try {
    const client = vertexClient;
    const model = vertexModel;

    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
    }

    const { history, message, language, context } = parseResult.data;

    const langName = language === "ms" ? "Bahasa Melayu" : "English";
    const systemInstruction = `You are PARE, a paddy farming assistant. Reply in ${langName} ONLY.

RULES:
- Max 2-3 sentences for the answer. No fluff, no repeating yourself.
- If listing steps, ALWAYS use bullet points (- step one).
- One short empathetic opener is fine, then get to the point.
- No markdown bold/italic (no ** or *). Plain text and bullet points only.

SUGGESTIONS:
After your answer, add exactly 2 follow-up questions on new lines prefixed with ">".
Example:
> ${language === "ms" ? "Apa baja yang sesuai?" : "What fertilizer should I use?"}
> ${language === "ms" ? "Bila masa terbaik untuk menyembur?" : "When is the best time to spray?"}

${context ? `Context: ${context}` : ""}`;

    const contents = history.map((msg) => ({
      role: msg.role === "system" ? ("user" as const) : (msg.role as "user" | "model"),
      parts: [{ text: msg.text }],
    }));

    contents.push({ role: "user" as const, parts: [{ text: message }] });

    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 400,
      },
    });

    // Combine all parts — Gemini sometimes splits response across multiple parts
    const fullReply =
      response.candidates?.[0]?.content?.parts
        ?.map((p: any) => p.text ?? "")
        .join("")
        .trim()
      || (language === "ms"
        ? "Maaf, saya tidak dapat menjawab soalan tersebut. Sila cuba lagi."
        : "Sorry, I couldn't answer that. Please try again.");

    // Extract follow-up suggestions (lines starting with ">")
    const lines = fullReply.split("\n");
    const suggestions: string[] = [];
    const replyLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(">")) {
        const suggestion = trimmed.slice(1).trim().replace(/^\??\s*/, "");
        if (suggestion) suggestions.push(suggestion);
      } else {
        replyLines.push(line);
      }
    }
    const replyText = replyLines.join("\n").trim();

    // Fallback suggestions if AI didn't generate any
    const finalSuggestions = suggestions.length > 0 ? suggestions : (
      language === "ms"
        ? ["Apa langkah seterusnya?", "Boleh terangkan lebih lanjut?"]
        : ["What should I do next?", "Can you explain more?"]
    );

    return res.json({ reply: replyText, suggestions: finalSuggestions, modelUsed: model });
  } catch (error) {
    logger.error({ error }, "Error in /ai/chat route");
    next(error);
  }
});

// ─── /ai/plan ────────────────────────────────────────────────────────────────

const IncompleteTaskSchema = z.object({
  title: z.string(),
  category: z.string(),
  priority: z.string(),
});

const RecentDiseaseSchema = z.object({
  diseaseNameEn: z.string(),
  severity: z.string(),
  detectedAt: z.string(),
});

const PlanRequestSchema = z.object({
  locationName: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  environment: z.string().optional(),
  // Weather fields
  humidity: z.number().optional(),
  temperature: z.number().optional(),
  rainfall: z.number().optional(),
  windSpeed: z.number().optional(),
  // Farm details
  paddyType: z.string().optional(),
  paddyAgeRange: z.string().optional(),
  growthPhase: z.string().optional(),
  farmSizeCategory: z.string().optional(),
  notes: z.string().nullable().optional(),
  // Context for adaptive planning
  incompleteTasks: z.array(IncompleteTaskSchema).default([]),
  recentDiseases: z.array(RecentDiseaseSchema).default([]),
});

router.post("/ai/plan", requireAuth, async (req, res, next) => {
  try {
    const client = vertexClient;
    const model = vertexModel;

    const parseResult = PlanRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
    }

    const {
      locationName, latitude, longitude, environment,
      humidity, temperature, rainfall, windSpeed,
      paddyType, paddyAgeRange, growthPhase, farmSizeCategory,
      notes, incompleteTasks, recentDiseases,
    } = parseResult.data;

    const locString = locationName
      ? `${locationName} (Lat ${latitude ?? "N/A"}, Lng ${longitude ?? "N/A"})`
      : `Lat ${latitude ?? "N/A"}, Lng ${longitude ?? "N/A"}`;

    // Build context sections only when data is present
    const weatherSection = [
      temperature != null ? `Temperature: ${temperature}°C` : null,
      humidity != null ? `Humidity: ${humidity}%` : null,
      rainfall != null ? `Rainfall: ${rainfall} mm` : null,
      windSpeed != null ? `Wind Speed: ${windSpeed} km/h` : null,
    ].filter(Boolean).join("\n");

    const incompleteSection = incompleteTasks.length > 0
      ? `Carry-over tasks from last week (not yet completed):\n${incompleteTasks.map((t) => `  - [${t.priority}] ${t.title} (${t.category})`).join("\n")}`
      : "No carry-over tasks from last week.";

    const diseaseSection = recentDiseases.length > 0
      ? `Recent disease detections on this farm:\n${recentDiseases.map((d) => `  - ${d.diseaseNameEn} (${d.severity}) detected on ${d.detectedAt}`).join("\n")}`
      : "No recent disease detections.";

    const notesSection = notes ? `Farmer notes: ${notes}` : "";

    const prompt = `Generate a weekly paddy farm task plan as a JSON array.

Farm: ${locString}, ${farmSizeCategory ?? "small"} farm
Environment: ${environment || "Tropical lowland paddy field"}
Paddy: ${paddyType ?? "MR219"}, ${paddyAgeRange ?? "unknown"} days, ${growthPhase ?? "vegetative"} phase
Weather: ${weatherSection || "N/A"}
${notesSection}
${incompleteSection}
${diseaseSection}

Rules:
- Return exactly 5 tasks as a JSON array.
- Each task: {"titleMs":"max 6 words in Malay","titleEn":"max 6 words in English","descriptionMs":"one sentence in Malay","descriptionEn":"one sentence in English","category":"fertilizer|pesticide|irrigation|monitoring|disease_follow_up","priority":"low|medium|high","dayOffset":1-6}
- Include disease_follow_up task if diseases detected.
- Keep descriptions SHORT (one sentence only).
- IMPORTANT: Tailor recommendations to the farm's environment and geography:
  * For coastal/saline areas: prioritise salt-tolerant practices, drainage management, and soil salinity monitoring.
  * For highland/cool areas: adjust fertilizer timing for slower growth, watch for cold-stress diseases.
  * For river delta/alluvial areas: focus on water level management and flood preparedness.
  * For monsoon regions: plan around heavy rainfall periods, ensure proper drainage.
  * Match fertilizer types and pesticide choices to the specific soil and climate conditions described.

Output ONLY the JSON array. Start with [ end with ]. No markdown, no extra text.`;

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.info("Vertex AI /ai/plan raw response length:", rawText.length);

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    const stripped = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      // Try to extract a JSON array from anywhere in the text
      const arrMatch = stripped.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ }
      }
      // Try to extract a JSON object that wraps the array (e.g. {"tasks": [...]})
      if (!parsed) {
        const objMatch = stripped.match(/\{[\s\S]*\}/);
        if (objMatch) {
          try {
            const obj = JSON.parse(objMatch[0]) as Record<string, unknown>;
            // Accept any key that holds an array
            const arrayVal = Object.values(obj).find((v) => Array.isArray(v));
            if (arrayVal) parsed = arrayVal;
          } catch { /* fall through */ }
        }
      }
      if (!parsed) {
        console.error("Vertex AI /ai/plan could not parse. Raw length:", rawText.length, "First 1000:", rawText.slice(0, 1000));
        return res.status(500).json({ message: "Could not parse Vertex AI response.", rawText: rawText.slice(0, 1000) });
      }
    }

    // Unwrap object wrapper if needed (e.g. {"tasks": [...]})
    if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
      const arrayVal = Object.values(parsed as Record<string, unknown>).find((v) => Array.isArray(v));
      if (arrayVal) parsed = arrayVal;
    }

    if (!Array.isArray(parsed)) {
      console.error("Vertex AI /ai/plan non-array after unwrap:", JSON.stringify(parsed).slice(0, 200));
      return res.status(500).json({ message: "Vertex AI returned non-array response." });
    }

    return res.json({ tasks: parsed, modelUsed: model });
  } catch (error) {
    logger.error({ error }, "Error in /ai/plan route");
    next(error);
  }
});

// ─── /ai/resource-insights ───────────────────────────────────────────────────

const InsightsRequestSchema = z.object({
  locationName: z.string().optional(),
  environment: z.string().optional(),
  paddyType: z.string().optional(),
  paddyAgeRange: z.string().optional(),
  growthPhase: z.string().optional(),
  farmSizeCategory: z.string().optional(),
  humidity: z.number().optional(),
  temperature: z.number().optional(),
  rainfall: z.number().optional(),
  pendingTaskCount: z.number().default(0),
  recentDiseases: z.array(RecentDiseaseSchema).default([]),
  language: z.enum(["en", "ms"]).default("ms"),
});

router.post("/ai/resource-insights", requireAuth, async (req, res, next) => {
  try {
    const client = vertexClient;
    const model = vertexModel;

    const parseResult = InsightsRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
    }

    const {
      locationName, environment, paddyType, paddyAgeRange, growthPhase, farmSizeCategory,
      humidity, temperature, rainfall, pendingTaskCount, recentDiseases, language,
    } = parseResult.data;

    const diseaseNote = recentDiseases.length > 0
      ? `Recent diseases: ${recentDiseases.map((d) => `${d.diseaseNameEn} (${d.severity})`).join(", ")}.`
      : "No recent disease detections.";

    const prompt = `You are PadiCare AI, an expert paddy farming assistant for Malaysian farmers.
Write a concise farm health insight (3–4 sentences) in ${language === "ms" ? "Bahasa Melayu" : "English"} for the following farm:

Farm: ${locationName ?? "Unknown location"}, ${farmSizeCategory ?? "small"} farm
Environment: ${environment || "Tropical lowland paddy field"}
Paddy: ${paddyType ?? "MR219"}, age ${paddyAgeRange ?? "unknown"} days, phase: ${growthPhase ?? "vegetative"}
Weather: Temp ${temperature ?? "N/A"}°C, Humidity ${humidity ?? "N/A"}%, Rainfall ${rainfall ?? "N/A"} mm
Pending tasks: ${pendingTaskCount}
${diseaseNote}

The insight should:
1. Summarise the current farm status in one sentence, referencing the specific environment conditions (soil type, climate zone, terrain).
2. Highlight the most critical action needed this week, tailored to the geographical environment (e.g. salinity management for coastal areas, drainage for delta regions, cold-stress prevention for highlands).
3. Mention any weather or disease risk to watch, considering the local climate pattern.
4. End with a brief motivational note for the farmer.

Return ONLY the plain text insight, no JSON, no bullet points, no markdown.`;

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.3,
        topP: 0.85,
        maxOutputTokens: 256,
      },
    });

    const insight =
      response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      (language === "ms"
        ? "Ladang anda dalam keadaan baik. Teruskan pemantauan mingguan."
        : "Your farm is in good condition. Continue with weekly monitoring.");

    return res.json({ insight, modelUsed: model });
  } catch (error) {
    logger.error({ error }, "Error in /ai/resource-insights route");
    next(error);
  }
});

export default router;
