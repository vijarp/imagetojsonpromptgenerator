export const ANALYSIS_SYSTEM_INSTRUCTION =
  "Analyze this image and return a JSON object with these keys: subject, body_type, hairstyle, outfit, gaze, pose, background, art_style, lighting, color_palette, composition, quality.";

export const ANALYSIS_FIELDS = [
  { key: "subject", placeholder: "1girl, solo" },
  { key: "body_type", placeholder: "slender, petite" },
  { key: "hairstyle", placeholder: "long blue hair, twin tails" },
  { key: "outfit", placeholder: "school uniform, white shirt" },
  { key: "gaze", placeholder: "looking at viewer" },
  { key: "pose", placeholder: "sitting" },
  { key: "background", placeholder: "classroom interior, window light" },
  { key: "art_style", placeholder: "anime style, digital painting" },
  { key: "lighting", placeholder: "cinematic lighting" },
  { key: "color_palette", placeholder: "pastel colors" },
  { key: "composition", placeholder: "center framing, medium shot" },
  { key: "quality", placeholder: "high detail, 4k" },
] as const;

export type AnalysisFieldKey = (typeof ANALYSIS_FIELDS)[number]["key"];

export type AnalysisResult = Record<AnalysisFieldKey, string>;

type VisionRequest = {
  base64Image: string;
  mimeType: string;
};

type RawVisionResponse = {
  subject?: string;
  body_type?: string;
  hairstyle?: string;
  outfit?: string;
  gaze?: string;
  pose?: string;
  background?: string;
  art_style?: string;
  lighting?: string;
  color_palette?: string;
  composition?: string;
  quality?: string;
};

export function createEmptyAnalysisResult(): AnalysisResult {
  return {
    subject: "",
    body_type: "",
    hairstyle: "",
    outfit: "",
    gaze: "",
    pose: "",
    background: "",
    art_style: "",
    lighting: "",
    color_palette: "",
    composition: "",
    quality: "",
  };
}

function normalizeVisionResponse(payload: RawVisionResponse): AnalysisResult {
  return {
    subject: payload.subject?.trim() ?? "",
    body_type: payload.body_type?.trim() ?? "",
    hairstyle: payload.hairstyle?.trim() ?? "",
    outfit: payload.outfit?.trim() ?? "",
    gaze: payload.gaze?.trim() ?? "",
    pose: payload.pose?.trim() ?? "",
    background: payload.background?.trim() ?? "",
    art_style: payload.art_style?.trim() ?? "",
    lighting: payload.lighting?.trim() ?? "",
    color_palette: payload.color_palette?.trim() ?? "",
    composition: payload.composition?.trim() ?? "",
    quality: payload.quality?.trim() ?? "",
  };
}

function extractJsonObject(content: string) {
  const match = content.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("Vision API returned a non-JSON response.");
  }

  return JSON.parse(match[0]) as RawVisionResponse;
}

export async function analyzeImageWithVision({
  base64Image,
  mimeType,
}: VisionRequest): Promise<AnalysisResult> {
  const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  const model = process.env.NEXT_PUBLIC_VISION_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_OPENAI_API_KEY. Add it to your environment before analyzing images.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: ANALYSIS_SYSTEM_INSTRUCTION,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Return only JSON using the requested keys.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const normalizedContent =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((item) => (typeof item?.text === "string" ? item.text : ""))
            .join("")
        : null;

  if (!normalizedContent) {
    throw new Error("Vision API did not return analyzable content.");
  }

  return normalizeVisionResponse(extractJsonObject(normalizedContent));
}

export function generateFullPrompt(analysis: AnalysisResult) {
  return ANALYSIS_FIELDS.map((field) => analysis[field.key].trim())
    .filter(Boolean)
    .join(", ");
}

export function generateNegativePrompt(analysis?: AnalysisResult) {
  const baseTerms = [
    "low quality",
    "blurry",
    "bad anatomy",
    "deformed hands",
    "extra fingers",
    "cropped",
    "watermark",
    "text",
    "oversaturated",
  ];

  if (!analysis?.background) {
    baseTerms.push("busy background");
  }

  return baseTerms.join(", ");
}

export function formatAnalysisAsJson(analysis: AnalysisResult) {
  return JSON.stringify(analysis, null, 2);
}
