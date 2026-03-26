/**
 * Background Service Worker
 * gemini-parser.js'deki saf fonksiyonlar burada inline tanımlanır.
 * (Service worker, content script globals'larına erişemediğinden inline gereklidir.)
 */

// --- gemini-parser.js'den inline edilmiş yardımcı fonksiyonlar ---

function extractTextFromGeminiResponse(result) {
  try {
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string') return null;
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

function parseTranslatedChunk(rawText) {
  if (rawText == null) return null;
  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function padTranslationChunk(translated, expectedLength) {
  if (expectedLength === 0) return [];
  const base = Array.isArray(translated) ? translated.slice(0, expectedLength) : [];
  while (base.length < expectedLength) base.push('');
  return base;
}

// --- Mesaj Dinleyici ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateFullTranscript') {
    handleTranslation(request.segments, sender.tab.id).then(sendResponse);
    return true; // Asenkron yanıt için
  } else if (request.action === 'speak') {
    chrome.tts.speak(request.text, { lang: 'tr-TR', rate: 1.0, enqueue: false });
  } else if (request.action === 'stopSpeak') {
    chrome.tts.stop();
  }
});

// --- Çeviri İşleyici ---

async function handleTranslation(segments, tabId) {
  try {
    const data = await chrome.storage.sync.get(['apiKey']);
    const apiKey = data.apiKey;

    if (!apiKey) {
      return { success: false, error: 'API Anahtarı eksik. Lütfen eklenti menüsünden girin.' };
    }

    const chunkSize = 40;
    let allTranslated = [];

    for (let i = 0; i < segments.length; i += chunkSize) {
      const chunk = segments.slice(i, i + chunkSize);

      chrome.tabs.sendMessage(tabId, {
        action: 'translationProgress',
        progress: Math.round((i / segments.length) * 100)
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: "You are a professional subtitle translator. Translate the given JSON array of strings from English to Turkish. Return ONLY a valid JSON array of strings with the EXACT SAME length and order. Do not add markdown formatting, do not add ```json." }]
            },
            contents: [{ parts: [{ text: JSON.stringify(chunk) }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: { type: "ARRAY", items: { type: "STRING" } }
            }
          })
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `API Hatası (${response.status})`);
      }

      const result = await response.json();

      const rawText = extractTextFromGeminiResponse(result);
      if (rawText === null) {
        console.warn('[YT-Narrator] Gemini boş/beklenmedik yanıt, chunk atlanıyor.');
        allTranslated = allTranslated.concat(padTranslationChunk(null, chunk.length));
        continue;
      }

      const translatedChunk = parseTranslatedChunk(rawText);
      if (translatedChunk === null) {
        console.warn('[YT-Narrator] Chunk parse edilemedi, boş segmentlerle dolduruluyor.');
        allTranslated = allTranslated.concat(padTranslationChunk(null, chunk.length));
        continue;
      }

      allTranslated = allTranslated.concat(padTranslationChunk(translatedChunk, chunk.length));
    }

    return { success: true, translated: allTranslated };
  } catch (error) {
    console.error('[YT-Narrator] Çeviri hatası:', error);
    return { success: false, error: error.message };
  }
}
