/**
 * YouTube Altyazı Çekici — Güvenilir Yöntemler
 *
 * Sorun: Eski kod YouTube HTML'ini regex ile parse ediyordu,
 * ama regex'in "." karakteri newline eşleştirmez → çok satırlı JSON'da hep fail.
 *
 * Çözüm:
 * 1. Sayfa zaten yüklüyken window.ytInitialPlayerResponse'u script injection ile oku
 * 2. HTTP fallback'te [\s\S] kullan (newline dahil tüm karakterler)
 */

// --- SAF FONKSİYONLAR (test edilebilir) ---

/**
 * captionTracks dizisinden en uygun parçayı seç.
 * İngilizce varsa onu, yoksa ilkini döndür.
 * @param {Array} tracks
 * @returns {Object|null}
 */
function selectBestTrack(tracks) {
  if (!tracks || tracks.length === 0) return null;
  return tracks.find(t => t.languageCode && t.languageCode.startsWith('en')) || tracks[0];
}

/**
 * HTML entity'lerini decode eder ve metni temizler.
 * @param {string} text
 * @returns {string}
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
 * YouTube HTML kaynağından captionTracks dizisini çıkarır.
 * DÜZELTME: [\s\S] kullanarak çok satırlı JSON'ı da yakalar.
 * @param {string} html
 * @returns {Array}
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
 * @param {string} xmlText
 * @returns {Array<{start: number, duration: number, text: string}>}
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
 * Sayfanın JS context'inden captionTracks'i okur.
 * Content script izole dünyada çalıştığından script injection gerekir.
 * Senkron: script injection hemen çalışır.
 * @returns {Array}
 */
function getCaptionTracksFromPageContext() {
  const MARKER_ID = '_yttf_' + Date.now();

  const container = document.createElement('div');
  container.id = MARKER_ID;
  container.style.display = 'none';
  document.body.appendChild(container);

  const script = document.createElement('script');
  script.textContent = `(function(){
    try {
      var r = window.ytInitialPlayerResponse;
      var tracks = r && r.captions && r.captions.playerCaptionsTracklistRenderer
        ? r.captions.playerCaptionsTracklistRenderer.captionTracks || []
        : [];
      document.getElementById('${MARKER_ID}').textContent = JSON.stringify(tracks);
    } catch(e) {
      document.getElementById('${MARKER_ID}').textContent = '[]';
    }
  })();`;
  document.head.appendChild(script);
  script.remove();

  try {
    const tracks = JSON.parse(container.textContent || '[]');
    container.remove();
    return tracks;
  } catch (e) {
    container.remove();
    return [];
  }
}

/**
 * HTTP fallback: Sayfayı yeniden çekip HTML'den parse eder.
 * @param {string} videoId
 * @returns {Promise<Array>}
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
 * @param {string} videoId
 * @returns {Promise<Array<{start: number, duration: number, text: string}>>}
 */
async function fetchTranscript(videoId) {
  // 1. Önce mevcut sayfa context'inden oku (hızlı, güvenilir)
  let tracks = getCaptionTracksFromPageContext();

  // 2. Bulamazsa HTTP ile çek
  if (tracks.length === 0) {
    console.warn('[YT-Narrator] Sayfa context\'inde altyazı bulunamadı, HTTP fallback deneniyor...');
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
