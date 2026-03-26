// cleanup-manager.js, sync-engine.js ve transcript-fetcher.js
// manifest sıralamasında bu dosyadan önce yüklenir.

let isTranslating = false;
let transcript = [];
let currentSegmentIndex = -1;
let video = null;
let btn = null;
let subBox = null;

// Tüm listener/element/interval'ları tek noktadan yönet
const cleanup = createCleanupManager();

// Throttle: timeupdate'i 80ms aralıkla sınırla (~12 kontrol/sn)
const handleTimeUpdateThrottled = createThrottle(handleTimeUpdate, 80);

// 1. Altyazı Kutusunu Oluştur
function createSubtitleBox() {
  if (document.querySelector('.yt-translator-subs')) return;
  subBox = document.createElement('div');
  subBox.className = 'yt-translator-subs';

  const videoContainer = document.querySelector('#movie_player') || document.body;
  videoContainer.appendChild(subBox);
  cleanup.registerElement(subBox);
}

// 2. YouTube Oynatma Çubuğuna Butonu Ekle
function injectButton() {
  if (document.querySelector('.yt-translator-btn')) return;

  const leftControls = document.querySelector('.ytp-left-controls');
  video = document.querySelector('video');

  if (leftControls && video) {
    btn = document.createElement('button');
    btn.className = 'ytp-button yt-translator-btn';
    btn.title = 'Türkçe Çeviri & Seslendirme';

    btn.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;padding:0 10px;font-family:'YouTube Noto',Roboto,Arial,sans-serif;font-size:14px;font-weight:500;color:#fff;">
        <span id="yt-trans-badge" style="background:#cc0000;color:#fff;padding:2px 6px;border-radius:4px;margin-right:6px;font-weight:bold;font-size:12px;">TR</span>
        <span id="yt-trans-text">Çevir</span>
      </div>
    `;

    btn.addEventListener('click', () => {
      if (isTranslating) stopTranslation();
      else startTranslation();
    });

    if (leftControls.children.length > 1) {
      leftControls.insertBefore(btn, leftControls.children[1]);
    } else {
      leftControls.appendChild(btn);
    }

    cleanup.registerElement(btn);
    createSubtitleBox();
  }
}

// interval'ı cleanup'a kaydet — sayfa değiştiğinde temizlensin
cleanup.registerInterval(setInterval(injectButton, 1000));

// YouTube SPA navigasyonu: farklı videoya geçilince her şeyi sıfırla
document.addEventListener('yt-navigate-finish', () => {
  stopTranslation();
  cleanup.cleanAll();
  transcript = [];
  currentSegmentIndex = -1;
  btn = null;
  subBox = null;
  // Yeni interval başlat
  cleanup.registerInterval(setInterval(injectButton, 1000));
});

// 3. Çeviri İşlemini Başlat
async function startTranslation() {
  chrome.storage.sync.get(['apiKey'], async (result) => {
    if (!result.apiKey) {
      alert('Lütfen önce sağ üstteki eklenti ikonuna tıklayıp Gemini API Anahtarınızı girin!');
      return;
    }

    isTranslating = true;
    document.getElementById('yt-trans-badge').style.background = '#555';
    document.getElementById('yt-trans-badge').innerText = '🛑';
    document.getElementById('yt-trans-text').innerText = 'Durdur';

    subBox.style.display = 'block';
    subBox.innerText = '1/3: Altyazılar çekiliyor...';

    if (video) video.pause();

    const videoId = new URLSearchParams(window.location.search).get('v');

    try {
      transcript = await fetchTranscript(videoId);
      if (transcript.length === 0) {
        subBox.innerText = 'Hata: Bu video için altyazı bulunamadı veya kapalı.';
        setTimeout(stopTranslation, 4000);
        return;
      }

      subBox.innerText = '2/3: Tüm metin çevriliyor (0%)... Lütfen bekleyin.';
      const segmentsText = transcript.map(t => t.text);

      chrome.runtime.sendMessage(
        { action: 'translateFullTranscript', segments: segmentsText },
        (response) => {
          if (response && response.success) {
            const translatedTexts = response.translated;
            for (let i = 0; i < transcript.length; i++) {
              if (translatedTexts[i]) transcript[i].text = translatedTexts[i];
            }

            subBox.innerText = '3/3: Tercüme tamamlandı! Oynatılıyor...';
            setTimeout(() => { if (subBox) subBox.innerText = ''; }, 2000);

            currentSegmentIndex = -1;
            // Listener'ları cleanup'a kaydet — stopTranslation'da otomatik silinir
            cleanup.registerListener(video, 'timeupdate', handleTimeUpdateThrottled);
            cleanup.registerListener(video, 'pause', handlePause);
            cleanup.registerListener(video, 'seeked', handleSeek);
            video.play();
          } else {
            subBox.innerText = 'Çeviri Hatası: ' + (response ? response.error : 'Bilinmeyen Hata');
            setTimeout(stopTranslation, 6000);
          }
        }
      );
    } catch (err) {
      subBox.innerText = 'Beklenmeyen bir hata oluştu.';
      console.error('[YT-Narrator]', err);
      setTimeout(stopTranslation, 4000);
    }
  });
}

// 4. Çeviriyi Durdur
function stopTranslation() {
  isTranslating = false;

  const badge = document.getElementById('yt-trans-badge');
  const text = document.getElementById('yt-trans-text');
  if (badge && text) {
    badge.style.background = '#cc0000';
    badge.innerText = 'TR';
    text.innerText = 'Çevir';
  }

  if (subBox) {
    subBox.style.display = 'none';
    subBox.innerText = '';
  }

  // Video listener'larını cleanup üzerinden temizle
  cleanup.cleanListeners();

  chrome.runtime.sendMessage({ action: 'stopSpeak' });
  currentSegmentIndex = -1;
}

// 5. Video Olay Dinleyicileri

function handlePause() {
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
}

function handleSeek() {
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
  currentSegmentIndex = -1;
  if (subBox) subBox.innerText = '';
}

function handleTimeUpdate() {
  if (!isTranslating || !subBox) return;

  const segmentIndex = findSegmentAtTime(transcript, video.currentTime);

  if (segmentIndex !== -1 && segmentIndex !== currentSegmentIndex) {
    currentSegmentIndex = segmentIndex;
    const text = transcript[segmentIndex].text;
    subBox.innerText = text;
    chrome.runtime.sendMessage({ action: 'stopSpeak' });
    chrome.runtime.sendMessage({ action: 'speak', text });
  } else if (segmentIndex === -1 && currentSegmentIndex !== -1) {
    currentSegmentIndex = -1;
    subBox.innerText = '';
    chrome.runtime.sendMessage({ action: 'stopSpeak' });
  }
}

// 6. Altyazı Çekme — transcript-fetcher.js tarafından sağlanır

// 7. Arka Plandan Gelen Mesajları Dinle
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translationProgress' && subBox) {
    subBox.innerText = `2/3: Tüm metin çevriliyor (%${request.progress})...`;
  }
});
