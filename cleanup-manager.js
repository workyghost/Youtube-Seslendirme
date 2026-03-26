/**
 * Cleanup Manager — Bellek Sızıntısı Önleyici
 *
 * Sorunlar:
 * 1. setInterval hiç temizlenmiyordu
 * 2. addEventListener'lar stopTranslation'da siliniyordu ama DOM elemanları kalıyordu
 * 3. YouTube SPA navigasyonunda eski elemanlar DOM'da birikiyordu
 * 4. Tekrar Çevir'de listener'lar üst üste ekleniyordu
 *
 * Kullanım:
 *   const cleanup = createCleanupManager();
 *   cleanup.registerListener(video, 'timeupdate', handler);
 *   cleanup.registerElement(btn);
 *   cleanup.registerInterval(setInterval(...));
 *   cleanup.cleanAll(); // hepsini tek seferde temizler
 */

function createCleanupManager() {
  const listeners = [];  // { element, type, handler }
  const elements = [];   // DOM elementleri
  const intervals = [];  // setInterval id'leri

  return {
    /**
     * Bir event listener kaydeder ve addEventListener'ı çağırır.
     */
    registerListener(element, type, handler) {
      element.addEventListener(type, handler);
      listeners.push({ element, type, handler });
    },

    /**
     * Bir DOM elementini takibe alır; cleanAll'da DOM'dan kaldırılır.
     */
    registerElement(element) {
      elements.push(element);
    },

    /**
     * Bir setInterval id'sini takibe alır; cleanAll'da clearInterval yapılır.
     */
    registerInterval(id) {
      intervals.push(id);
    },

    /**
     * Sadece event listener'ları temizler (elementler ve interval'lar kalır).
     * stopTranslation'da video listener'larını temizlemek için kullanılır.
     */
    cleanListeners() {
      for (const { element, type, handler } of listeners) {
        try { element.removeEventListener(type, handler); } catch (_) {}
      }
      listeners.length = 0;
    },

    /**
     * Tüm listener'ları, elementleri ve interval'ları temizler.
     * Birden fazla kez güvenle çağrılabilir.
     */
    cleanAll() {
      for (const { element, type, handler } of listeners) {
        try { element.removeEventListener(type, handler); } catch (_) {}
      }
      listeners.length = 0;

      for (const el of elements) {
        try {
          if (el.parentNode) el.parentNode.removeChild(el);
        } catch (_) {}
      }
      elements.length = 0;

      for (const id of intervals) {
        clearInterval(id);
      }
      intervals.length = 0;
    },

    get listenerCount() { return listeners.length; },
    get elementCount() { return elements.length; },
    get intervalCount() { return intervals.length; },
  };
}

// CommonJS export — sadece test ortamı için
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCleanupManager };
}
