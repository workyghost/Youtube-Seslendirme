/**
 * Popup yardımcı fonksiyonları — saf, test edilebilir
 */

/**
 * Gemini model listesini filtreler ve sıralar.
 * - Sadece generateContent destekleyenleri döner
 * - Sadece gemini modellerini döner
 * - flash önce, pro sonra; exp/preview en sonda
 *
 * @param {Array} models - API'den gelen models dizisi
 * @returns {Array}
 */
function filterGeminiModels(models) {
  if (!models || !Array.isArray(models)) return [];

  const filtered = models.filter(m =>
    m.name &&
    m.name.includes('gemini') &&
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes('generateContent')
  );

  return filtered.sort((a, b) => {
    const score = (name) => {
      if (name.includes('exp') || name.includes('preview')) return 2;
      if (name.includes('pro')) return 1;
      return 0; // flash ve diğerleri
    };
    return score(a.name) - score(b.name);
  });
}

/**
 * Model API adını okunabilir formata çevirir.
 * "models/gemini-3.1-flash-lite" → "gemini-3.1-flash-lite"
 * exp/preview sonekleri köşeli paranteze alınır.
 *
 * @param {string} modelName
 * @returns {string}
 */
function formatModelName(modelName) {
  if (!modelName) return '';

  let name = modelName.replace(/^models\//, '');

  if (name.endsWith('-exp')) {
    name = name.replace(/-exp$/, '') + ' [exp]';
  } else if (name.includes('-preview')) {
    name = name.replace(/-preview.*$/, '') + ' [preview]';
  }

  return name;
}

// CommonJS export — test ortamı için
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filterGeminiModels, formatModelName };
}
