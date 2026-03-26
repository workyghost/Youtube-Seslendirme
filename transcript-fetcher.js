/**
 * YouTube Altyazı Çekici — Güvenilir Yöntemler
 *
 * Çözüm:
 * 1. Sayfadaki mevcut <script> tag'lerini METIN olarak okur (CSP ihlali yok)
 * 2. HTTP fallback'te [\s\S] ile çok satırlı JSON'ı da yakalar
 */

// --- SAF FONKSİYONLAR (test edilebilir) ---

/**
 * captionTracks dizisinden en uygun parçayı seç.
 * İngilizce varsa onu, yoksa ilkini döndür.
 */
function selectBestTrack(tracks) {
  if (!tracks || tracks.length === 0) return null;
  return tracks.find(t => t.languageCode && t.languageCode.startsWith('en')) || tracks[0];
}

/**
 * HTML entity'lerini decode eder ve metni temizler.
 */
function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Herhangi bir metin bloğundan captionTracks dizisini çıkarır.
 * [\s\S] ile çok satırlı JSON'ı da yakalar.
 */
function extractCaptionTracksFromHtml(html) {
  const patterns = [
    /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/,
    /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"defaultAudioTrackIndex"/,
    /"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"translationLanguages"/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try { return JSON.parse(match[1]); } catch (e) { /* sonrakini dene */ }
    }
  }
  return [];
}

/**
 * YouTube'un XML altyazı formatını segment dizisine parse eder.
 */
function parseXmlTranscript(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const nodes = Array.from(doc.getElementsByTagName('text'));
  const segments = [];

  for (const node of nodes) {
    const text = decodeHtmlEntities(node.textContent || '');
    if (text) {
      segments.push({
        start: parseFloat(node.getAttribute('start') || '0'),
        duration: parseFloat(node.getAttribute('dur') || '0'),
        text,
      });
    }
  }
  return segments;
}

// --- DOM/AĞDAN OKUMA FONKSİYONLARI ---

/**
 * Sayfadaki mevcut <script> tag'lerinin textContent'ini okuyarak
 * captionTracks'i çıkarır.
 *
 * DÜZELTME: Eski yöntem inline script injection kullanıyordu →
 * YouTube CSP tarafından bloklanıyordu (unsafe-inline yasak).
 * Yeni yöntem: script tag'lerini sadece METIN olarak okur, çalıştırmaz
 * → CSP ihlali yok.
 */
function getCaptionTracksFromPageContext() {
  const scripts = document.querySelectorAll('script');
  for (const script of scripts) {
    const text = script.textContent;
    if (!text || !text.includes('captionTracks')) continue;
    const tracks = extractCaptionTracksFromHtml(text);
    if (tracks.length > 0) return tracks;
  }
  return [];
}

/**
 * HTTP fallback: Sayfayı yeniden çekip HTML'den parse eder.
 */
async function getCaptionTracksFromHttp(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await res.text();
    return extractCaptionTracksFromHtml(html);
  } catch (e) {
    console.error('[YT-Narrator] HTTP fallback hatası:', e);
    return [];
  }
}

/**
 * Ana giriş noktası: video ID'si için altyazı segment dizisi döndürür.
 */
async function fetchTranscript(videoId) {
  // 1. Sayfadaki script tag'lerini oku (hızlı, CSP uyumlu)
  let tracks = getCaptionTracksFromPageContext();

  // 2. Bulamazsa HTTP ile çek
  if (tracks.length === 0) {
    console.warn('[YT-Narrator] Script tag\'lerinde altyazı bulunamadı, HTTP fallback deneniyor...');
    tracks = await getCaptionTracksFromHttp(videoId);
  }

  const track = selectBestTrack(tracks);
  if (!track) {
    console.warn('[YT-Narrator] Hiçbir altyazı track\'i bulunamadı.');
    return [];
  }

  try {
    const res = await fetch(track.baseUrl);
    const xmlText = await res.text();
    return parseXmlTranscript(xmlText);
  } catch (e) {
    console.error('[YT-Narrator] XML çekme hatası:', e);
    return [];
  }
}

// CommonJS export — sadece test ortamı için (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { selectBestTrack, decodeHtmlEntities, extractCaptionTracksFromHtml, parseXmlTranscript };
}
