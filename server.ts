import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '5mb' }));

// Helper to get initialized Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Health & Config status endpoint
app.get('/api/status', (_req: Request, res: Response) => {
  const ai = getGeminiClient();
  res.json({
    status: 'ok',
    hasApiKey: Boolean(ai),
    provider: 'Google Gemini',
    model: 'gemini-3.1-flash-lite / gemini-3.8-flash',
    ttsModel: 'gemini-3.8-flash-lite-tts',
  });
});

// Helper to parse JSON output cleanly
function extractJsonFromText(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // If wrapped in ```json ... ``` code fence
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // continue
      }
    }
    // If braces exist
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // continue
      }
    }
    return null;
  }
}

// 2. Real Translation endpoint
app.post('/api/translate', async (req: Request, res: Response) => {
  try {
    const { text, sourceLang, targetLang, tone } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({ error: 'Text to translate is required.' });
      return;
    }

    if (!targetLang || typeof targetLang !== 'string') {
      res.status(400).json({ error: 'Target language is required.' });
      return;
    }

    if (text.length > 10000) {
      res.status(400).json({ error: 'Text exceeds maximum limit of 10,000 characters.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY in the environment or Settings > Secrets.',
        code: 'MISSING_API_KEY',
      });
      return;
    }

    const isAutoDetect =
      !sourceLang ||
      sourceLang.toLowerCase().includes('auto') ||
      sourceLang.toLowerCase().includes('detect');

    const toneInstruction =
      tone && tone !== 'natural' && tone !== 'default'
        ? `Adopt a ${tone} tone.`
        : 'Maintain natural, culturally accurate, and native-sounding phrasing.';

    const prompt = `You are a high-precision, natural language translator.
Translate the following input into "${targetLang}".
${isAutoDetect ? 'Detect the source language automatically.' : `The expected source language is "${sourceLang}".`}
Tone instruction: ${toneInstruction}

IMPORTANT: You must respond ONLY with a valid JSON object matching this structure:
{
  "translatedText": "the accurate translated text in ${targetLang}",
  "detectedLanguage": "name of source language in English (e.g. English, Spanish, Japanese, French)",
  "detectedLanguageCode": "ISO two-letter language code if known (e.g. en, es, ja, fr)",
  "phoneticTranscription": "Romanized or phonetic reading if the target language uses non-Latin script (e.g. Pinyin for Chinese, Romaji for Japanese, IPA/transcription for Arabic/Russian/Hindi), otherwise empty string",
  "alternativeTranslations": ["1 to 2 alternate natural phrasing options or synonyms, if appropriate"],
  "linguisticNotes": "Brief 1-sentence note about grammar, formality, or cultural nuance if helpful, otherwise empty string"
}

Input text to translate:
"""
${text}
"""`;

    // Try models: gemini-3.1-flash-lite is lightning fast and reliable; if 503 or error, try gemini-3.8-flash
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;
    let responseText: string | null = null;

    for (const model of modelsToTry) {
      try {
        const result = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.15,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          },
        });

        if (result.text && result.text.trim()) {
          responseText = result.text.trim();
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} attempt failed:`, err?.message || err);
      }
    }

    if (!responseText) {
      throw lastError || new Error('No translation response returned by Gemini API.');
    }

    const parsed = extractJsonFromText(responseText);

    if (parsed && parsed.translatedText) {
      res.json({
        translatedText: parsed.translatedText,
        detectedLanguage: parsed.detectedLanguage || sourceLang || 'Auto',
        detectedLanguageCode: parsed.detectedLanguageCode || '',
        phoneticTranscription: parsed.phoneticTranscription || '',
        alternativeTranslations: Array.isArray(parsed.alternativeTranslations)
          ? parsed.alternativeTranslations.filter((t: any) => typeof t === 'string' && t.trim())
          : [],
        linguisticNotes: parsed.linguisticNotes || '',
        sourceText: text,
        targetLanguage: targetLang,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Fallback if raw text wasn't strict JSON
    res.json({
      translatedText: responseText.replace(/```json/g, '').replace(/```/g, '').trim(),
      detectedLanguage: sourceLang || 'Detected',
      detectedLanguageCode: '',
      phoneticTranscription: '',
      alternativeTranslations: [],
      linguisticNotes: '',
      sourceText: text,
      targetLanguage: targetLang,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to complete translation with the API.',
      details: error?.statusText || error?.name || 'Unknown API error',
    });
  }
});

// 3. Text-to-Speech endpoint (Gemini Flash Lite TTS)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      res.status(400).json({ error: 'Text to speak is required.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured for TTS.',
        fallbackToBrowser: true,
      });
      return;
    }

    const safeVoice = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceName)
      ? voiceName
      : 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: text.slice(0, 800) }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: safeVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      res.status(500).json({
        error: 'No audio stream returned by the TTS engine.',
        fallbackToBrowser: true,
      });
      return;
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.warn('TTS error (falling back to browser speech synthesis):', error);
    res.status(500).json({
      error: error?.message || 'TTS generation failed.',
      fallbackToBrowser: true,
    });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
