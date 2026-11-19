import { GoogleGenAI } from '@google/genai';
import type { CaptionItem, ColorGrade } from '../types/editor';
import { generateId } from './timelineEngine';

const STORAGE_API_KEY = 'z_editz_gemini_api_key';

export function getGeminiApiKey(): string {
  try {
    const custom = localStorage.getItem(STORAGE_API_KEY);
    if (custom && custom.trim().length > 0) return custom.trim();
  } catch {
    // ignore
  }
  return typeof process !== 'undefined' && process.env?.GEMINI_API_KEY
    ? process.env.GEMINI_API_KEY.trim()
    : '';
}

export function setGeminiApiKey(key: string) {
  try {
    localStorage.setItem(STORAGE_API_KEY, key.trim());
  } catch {
    // ignore
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key is missing. Please set your key in the AI prompt or add GEMINI_API_KEY in your environment.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sends audio to Gemini to generate timestamped subtitles / SRT captions.
 */
export async function generateSubtitlesWithGemini(
  audioBlob: Blob
): Promise<CaptionItem[]> {
  const ai = getAiClient();
  const base64Data = await blobToBase64(audioBlob);

  const prompt = `
You are an expert video subtitler and audio transcriber.
Analyze the provided speech/voiceover audio track.
Transcribe spoken words into subtitle segments with start and end timestamps in seconds.
Return ONLY valid JSON matching this schema:
[
  {
    "startTime": number,
    "endTime": number,
    "text": string
  }
]
Rules:
- Keep segments between 1.5 to 5.0 seconds.
- Provide clean, accurate punctuation and capitalization.
- Output ONLY the JSON array without markdown formatting.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        inlineData: {
          mimeType: audioBlob.type || 'audio/webm',
          data: base64Data,
        },
      },
      {
        text: prompt,
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text?.trim() || '[]';
  const rawList = JSON.parse(text) as Array<{ startTime: number; endTime: number; text: string }>;

  return rawList.map((item) => ({
    id: generateId('cap_ai'),
    startTime: Number(Number(item.startTime).toFixed(2)),
    endTime: Number(Number(item.endTime).toFixed(2)),
    text: String(item.text).trim(),
  }));
}

/**
 * Translates a natural language color grading prompt (e.g., "vintage 90s kodak film")
 * into numerical ColorGrade parameters.
 */
export async function generateColorGradeWithGemini(
  promptText: string
): Promise<Partial<ColorGrade>> {
  const ai = getAiClient();

  const systemInstruction = `
You are a Hollywood colorist and director of photography.
Translate the user's artistic color grading vision into numerical color adjustments.
Available parameters:
- exposure: number from -2.0 to 2.0 (0 is neutral)
- contrast: number from -100 to 100 (0 is neutral)
- saturation: number from -100 to 100 (0 is neutral, -100 is pure monochrome)
- temperature: number from -100 (cool blue) to 100 (warm orange)
- tint: number from -100 (green) to 100 (magenta)
- gamma: number from 0.5 to 2.0 (1.0 is neutral)
- highlights: number from -100 to 100
- shadows: number from -100 to 100
- vignette: number from 0 to 100
- blur: number from 0 to 10
- sharpen: number from 0 to 100
- wheels: {
    lift: { r: -1 to 1, g: -1 to 1, b: -1 to 1, luma: -1 to 1 },
    gamma: { r: -1 to 1, g: -1 to 1, b: -1 to 1, luma: -1 to 1 },
    gain: { r: -1 to 1, g: -1 to 1, b: -1 to 1, luma: -1 to 1 }
  }

Return ONLY valid JSON matching a Partial<ColorGrade> object.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        text: `User color grading description: "${promptText}". Output the color grade JSON.`,
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text?.trim() || '{}';
  return JSON.parse(text) as Partial<ColorGrade>;
}
