/**
 * Gemini API Yanıt Ayrıştırıcı
 *
 * background.mjs'teki kırılgan zincir erişimlerini ve JSON.parse crash'lerini
 * güvenli saf fonksiyonlarla çözer.
 */

/**
 * Gemini API yanıtından çevrilmiş metni güvenli şekilde çıkarır.
 * Markdown bloklarını temizler, boşlukları keser.
 *
 * @param {Object} result - fetch().json() sonucu
 * @returns {string|null} - temizlenmiş metin, hata durumunda null
 */
function extractTextFromGeminiResponse(result) {
  try {
    const text = result
      ?.candidates?.[0]
      ?.content
      ?.parts?.[0]
      ?.text;

    if (!text || typeof text !== 'string') return null;

    const cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

/**
 * Gemini'nin döndürdüğü JSON metnini dizi olarak parse eder.
 * Bozuk JSON veya dizi olmayan yanıt için null döner — crash yok.
 *
 * @param {string|null} rawText
 * @returns {Array|null}
 */
function parseTranslatedChunk(rawText) {
  if (rawText == null) return null;
  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Çeviri dizisini beklenen uzunluğa getirir.
 * Kısa gelirse boş string ile doldurur, fazla gelirse kırpar.
 * Gemini'nin segment sayısını atlama/çoğaltma sorununu önler.
 *
 * @param {Array|null} translated - çevrilmiş segmentler
 * @param {number} expectedLength - orijinal chunk uzunluğu
 * @returns {Array<string>}
 */
function padTranslationChunk(translated, expectedLength) {
  if (expectedLength === 0) return [];

  const base = Array.isArray(translated) ? translated.slice(0, expectedLength) : [];

  while (base.length < expectedLength) {
    base.push('');
  }

  return base;
}

// CommonJS export — sadece test ortamı için (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractTextFromGeminiResponse, parseTranslatedChunk, padTranslationChunk };
}
