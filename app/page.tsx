"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  ImagePlus,
  Languages,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  AnalysisFieldKey,
  AnalysisResult,
  analyzeImageWithVision,
  ANALYSIS_FIELDS,
  createEmptyAnalysisResult,
  formatAnalysisAsJson,
  generateFullPrompt,
  generateNegativePrompt,
} from "../lib/VisionService";

type Language = "en" | "hi";

const translations: Record<
  Language,
  {
    title: string;
    subtitle: string;
    uploadTitle: string;
    uploadHint: string;
    analyzing: string;
    analyze: string;
    analysisTitle: string;
    promptTitle: string;
    fullPrompt: string;
    negativePrompt: string;
    copyJson: string;
    copyPrompt: string;
    sync: string;
    edit: string;
    lock: string;
    uploadAnother: string;
    previewAlt: string;
    statusIdle: string;
    statusDone: string;
    statusError: string;
  }
> = {
  en: {
    title: "AI Prompt Extractor",
    subtitle: "Vision-powered metadata extraction for creative prompting",
    uploadTitle: "Click to Upload",
    uploadHint: "Drag and drop an image here, or browse from your device",
    analyzing: "Analyzing image...",
    analyze: "Analyze Image",
    analysisTitle: "Analysis Grid",
    promptTitle: "Prompt Output",
    fullPrompt: "Full Prompt",
    negativePrompt: "Negative Prompt",
    copyJson: "Copy JSON",
    copyPrompt: "Copy Prompt",
    sync: "Sync",
    edit: "Edit",
    lock: "Lock",
    uploadAnother: "Upload another image",
    previewAlt: "Uploaded preview",
    statusIdle: "Awaiting image upload",
    statusDone: "Analysis ready",
    statusError: "Vision request failed",
  },
  hi: {
    title: "AI Prompt Extractor",
    subtitle: "क्रिएटिव प्रॉम्प्टिंग के लिए विज़न आधारित मेटाडेटा एक्सट्रैक्शन",
    uploadTitle: "अपलोड करने के लिए क्लिक करें",
    uploadHint: "इमेज यहाँ ड्रैग करें या अपनी डिवाइस से चुनें",
    analyzing: "इमेज का विश्लेषण हो रहा है...",
    analyze: "इमेज विश्लेषण करें",
    analysisTitle: "विश्लेषण ग्रिड",
    promptTitle: "प्रॉम्प्ट आउटपुट",
    fullPrompt: "फुल प्रॉम्प्ट",
    negativePrompt: "नेगेटिव प्रॉम्प्ट",
    copyJson: "JSON कॉपी करें",
    copyPrompt: "प्रॉम्प्ट कॉपी करें",
    sync: "सिंक",
    edit: "संपादित करें",
    lock: "लॉक",
    uploadAnother: "दूसरी इमेज अपलोड करें",
    previewAlt: "अपलोड किया गया प्रीव्यू",
    statusIdle: "इमेज अपलोड की प्रतीक्षा",
    statusDone: "विश्लेषण तैयार है",
    statusError: "विज़न अनुरोध विफल हुआ",
  },
};

const fieldLabels: Record<Language, Record<AnalysisFieldKey, string>> = {
  en: {
    subject: "Subject",
    body_type: "Body Type",
    hairstyle: "Hairstyle",
    outfit: "Outfit",
    gaze: "Gaze",
    pose: "Pose",
    background: "Background",
    art_style: "Art Style",
    lighting: "Lighting",
    color_palette: "Color Palette",
    composition: "Composition",
    quality: "Resolution / Quality",
  },
  hi: {
    subject: "विषय",
    body_type: "बॉडी टाइप",
    hairstyle: "हेयरस्टाइल",
    outfit: "आउटफिट",
    gaze: "नज़र",
    pose: "पोज़",
    background: "बैकग्राउंड",
    art_style: "आर्ट स्टाइल",
    lighting: "लाइटिंग",
    color_palette: "रंग पैलेट",
    composition: "कंपोज़िशन",
    quality: "रिज़ॉल्यूशन / क्वालिटी",
  },
};

const modelLabels = ["Turbo-Vision-v1", "Prompt Sync", "Editable JSON"];

function copyToClipboard(value: string) {
  return navigator.clipboard.writeText(value);
}

export default function Page() {
  const [language, setLanguage] = useState<Language>("en");
  const [analysis, setAnalysis] = useState<AnalysisResult>(createEmptyAnalysisResult());
  const [fullPrompt, setFullPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState(generateNegativePrompt());
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPromptEditable, setIsPromptEditable] = useState(true);
  const [copiedState, setCopiedState] = useState<"json" | "prompt" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const t = translations[language];

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const jsonPreview = useMemo(() => formatAnalysisAsJson(analysis), [analysis]);

  function syncPromptFromGrid() {
    setFullPrompt(generateFullPrompt(analysis));
    setNegativePrompt(generateNegativePrompt(analysis));
  }

  async function fileToBase64(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary);
  }

  async function handleSelectedFile(file: File) {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);

    setImagePreviewUrl(previewUrl);
    setImageBase64(base64);
    setImageMimeType(file.type || "image/png");
    setErrorMessage(null);
  }

  async function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    await handleSelectedFile(selectedFile);
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) {
      return;
    }

    await handleSelectedFile(droppedFile);
  }

  async function analyzeImage() {
    if (!imageBase64 || !imageMimeType) {
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await analyzeImageWithVision({
        base64Image: imageBase64,
        mimeType: imageMimeType,
      });

      setAnalysis(result);
      setFullPrompt(generateFullPrompt(result));
      setNegativePrompt(generateNegativePrompt(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to analyze the image.";
      setErrorMessage(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function updateField(key: AnalysisFieldKey, value: string) {
    setAnalysis((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleCopy(kind: "json" | "prompt") {
    const value = kind === "json" ? jsonPreview : fullPrompt;
    await copyToClipboard(value);
    setCopiedState(kind);

    window.setTimeout(() => {
      setCopiedState((current) => (current === kind ? null : current));
    }, 1600);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#f8fafc_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_-24px_rgba(79,70,229,0.35)] backdrop-blur xl:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {modelLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700"
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  {t.title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                  {t.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLanguage((current) => (current === "en" ? "hi" : "en"))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              <Languages className="h-4 w-4" />
              {language === "en" ? "HI" : "EN"}
            </button>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.05fr_1.4fr]">
          <div className="space-y-8">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-300 bg-white/80 hover:border-indigo-400 hover:bg-indigo-50/70"
              }`}
            >
              <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
              <div className="rounded-2xl bg-indigo-100 p-4 text-indigo-700 transition group-hover:scale-105">
                <ImagePlus className="h-8 w-8" />
              </div>
              <p className="mt-5 text-lg font-semibold text-slate-900">{t.uploadTitle}</p>
              <p className="mt-2 max-w-sm text-sm text-slate-500">{t.uploadHint}</p>
            </label>

            <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.uploadAnother}</p>
                  <p className="text-xs text-slate-500">
                    {errorMessage
                      ? `${t.statusError}: ${errorMessage}`
                      : imagePreviewUrl
                        ? t.statusDone
                        : t.statusIdle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={analyzeImage}
                  disabled={!imageBase64 || isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  <Sparkles className="h-4 w-4" />
                  {isAnalyzing ? t.analyzing : t.analyze}
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl bg-slate-100">
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt={t.previewAlt}
                    className="h-full max-h-[360px] w-full object-cover"
                  />
                ) : (
                  <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
                    {t.uploadHint}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <motion.section
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm sm:p-6"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-950">{t.analysisTitle}</h2>
                <button
                  type="button"
                  onClick={() => handleCopy("json")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                >
                  <Copy className="h-4 w-4" />
                  {copiedState === "json" ? "Copied" : t.copyJson}
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {ANALYSIS_FIELDS.map((field) => (
                  <motion.div
                    key={field.key}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {fieldLabels[language][field.key]}
                      </h3>
                      <Wand2 className="h-4 w-4 text-indigo-500" />
                    </div>
                    <textarea
                      value={analysis[field.key]}
                      onChange={(event) => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.section
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm sm:p-6"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-950">{t.promptTitle}</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy("prompt")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedState === "prompt" ? "Copied" : t.copyPrompt}
                  </button>
                  <button
                    type="button"
                    onClick={syncPromptFromGrid}
                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {t.sync}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPromptEditable((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
                  >
                    <Wand2 className="h-4 w-4" />
                    {isPromptEditable ? t.lock : t.edit}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-800">{t.fullPrompt}</p>
                  <textarea
                    value={fullPrompt}
                    onChange={(event) => setFullPrompt(event.target.value)}
                    readOnly={!isPromptEditable}
                    rows={6}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-800">{t.negativePrompt}</p>
                  <textarea
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                    readOnly={!isPromptEditable}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 read-only:bg-slate-50"
                  />
                </div>
              </div>
            </motion.section>
          </div>
        </section>
      </div>
    </main>
  );
}
