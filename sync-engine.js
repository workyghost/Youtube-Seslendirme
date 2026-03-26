/**
 * TTS + Altyazı Zamanlama Motoru
 *
 * Sorunlar:
 * 1. timeupdate saniyede ~60 kez tetikleniyor → throttle şart
 * 2. enqueue:true TTS kuyruğu → sesler üst üste biniyordu
 * 3. Segment geçişleri doğru tespit edilmiyordu
 *
 * Bu dosya saf (pure) fonksiyonlar içerir — test edilebilir, Chrome API bağımlılığı yok.
 */

/**
 * Verilen zamanda hangi segment oynatılacağını bulur.
 * Aralık: [start, start + duration) — bitiş anı dahil DEĞİL.
 *
 * @param {Array<{start: number, duration: number, text: string}>} segments
 * @param {number} currentTime - saniye cinsinden video zamanı
 * @returns {number} - segment indeksi, bulunamazsa -1
 */
function findSegmentAtTime(segments, currentTime) {
  if (!segments || segments.length === 0) return -1;

  for (let i = 0; i < segments.length; i++) {
    const { start, duration } = segments[i];
    if (currentTime >= start && currentTime < start + duration) {
      return i;
    }
  }
  return -1;
}

/**
 * Bir fonksiyonu belirli aralıklarla sınırlayan throttle.
 * timeupdate gibi sık tetiklenen olaylar için kullanılır.
 *
 * @param {Function} fn - sarılacak fonksiyon
 * @param {number} intervalMs - minimum çağrı aralığı (ms)
 * @returns {Function} - throttle uygulanmış fonksiyon
 */
function createThrottle(fn, intervalMs) {
  let lastCall = -Infinity;

  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

// CommonJS export — sadece test ortamı için
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { findSegmentAtTime, createThrottle };
}
