let isTranslating = false;
let transcript = [];
let currentSegmentIndex = -1;
let video = null;
let btn = null;

// Altyazı Kutusu
const subBox = document.createElement('div');
subBox.className = 'yt-translator-subs';

function injectButton() {
  if (document.querySelector('.yt-translator-btn')) return;
  
  const leftControls = document.querySelector('.ytp-left-controls');
  video = document.querySelector('video');
  const videoContainer = document.querySelector('#movie_player');
  
  if (leftControls && videoContainer) {
    btn = document.createElement('button');
    btn.className = 'ytp-button yt-translator-btn';
    btn.style.width = 'auto';
    btn.style.padding = '0 10px';
    btn.style.fontSize = '13px';
    btn.style.fontWeight = 'bold';
    btn.style.color = '#fff';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.verticalAlign = 'top';
    btn.innerHTML = '🇹🇷 Çevir';
    btn.title = 'Türkçe Sesli Çeviri';
    
    btn.addEventListener('click', () => {
      if (isTranslating) stopTranslation();
      else startTranslation();
    });
    
    leftControls.appendChild(btn);
    
    if (!document.querySelector('.yt-translator-subs')) {
      videoContainer.appendChild(subBox);
    }
  }
}

// YouTube SPA olduğu için butonu sürekli kontrol et
setInterval(injectButton, 1000);

async function startTranslation() {
  isTranslating = true;
  btn.style.color = '#ff4444';
  btn.innerHTML = '🛑 Durdur';
  subBox.style.display = 'block';
  subBox.innerText = "1/3: Altyazılar çekiliyor...";
  
  if (video) video.pause(); // Çeviri bitene kadar videoyu duraklat

  const videoId = new URLSearchParams(window.location.search).get('v');
  
  try {
    // 1. Tüm Altyazıyı Çek
    transcript = await fetchTranscript(videoId);
    if (transcript.length === 0) {
      subBox.innerText = "Hata: Bu video için altyazı bulunamadı.";
      setTimeout(stopTranslation, 4000);
      return;
    }

    // 2. Tüm Metni Arka Planda Çevir
    subBox.innerText = "2/3: Tüm metin çevriliyor (0%)...";
    const segmentsText = transcript.map(t => t.text);
    
    chrome.runtime.sendMessage(
      { action: 'translateFullTranscript', segments: segmentsText },
      (response) => {
        if (response && response.success) {
          // 3. Çeviriyi Orijinal Zamanlamalarla Eşleştir
          const translatedTexts = response.translated;
          for (let i = 0; i < transcript.length; i++) {
            if (translatedTexts[i]) {
              transcript[i].text = translatedTexts[i];
            }
          }
          
          subBox.innerText = "3/3: Tercüme tamamlandı! Oynatılıyor...";
          setTimeout(() => { subBox.innerText = ""; }, 2000);
          
          // Oynatmayı Başlat ve Dinleyicileri Ekle
          currentSegmentIndex = -1;
          video.addEventListener('timeupdate', handleTimeUpdate);
          video.addEventListener('pause', handlePause);
          video.addEventListener('seeked', handleSeek);
          video.play();
        } else {
          subBox.innerText = "Çeviri Hatası: " + (response ? response.error : "Bilinmeyen Hata");
          setTimeout(stopTranslation, 4000);
        }
      }
    );
  } catch (err) {
    subBox.innerText = "Beklenmeyen bir hata oluştu.";
    console.error(err);
    setTimeout(stopTranslation, 4000);
  }
}

function stopTranslation() {
  isTranslating = false;
  if (btn) {
    btn.style.color = '#fff';
    btn.innerHTML = '🇹🇷 Çevir';
  }
  subBox.style.display = 'none';
  subBox.innerText = "";
  
  if (video) {
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('seeked', handleSeek);
  }
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
  currentSegmentIndex = -1;
}

function handlePause() {
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
}

function handleSeek() {
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
  currentSegmentIndex = -1;
  subBox.innerText = "";
}

function handleTimeUpdate() {
  if (!isTranslating) return;
  const currentTime = video.currentTime;
  
  const segmentIndex = transcript.findIndex(s => currentTime >= s.start && currentTime < s.start + s.duration);
  
  if (segmentIndex !== -1 && segmentIndex !== currentSegmentIndex) {
    currentSegmentIndex = segmentIndex;
    const text = transcript[segmentIndex].text;
    subBox.innerText = text; // Ekranda göster
    chrome.runtime.sendMessage({ action: 'speak', text: text }); // Seslendir
  } else if (segmentIndex === -1) {
    subBox.innerText = "";
  }
}

async function fetchTranscript(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    const match = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!match) return [];
    
    const captionTracks = JSON.parse(match[1]);
    
    let track = captionTracks.find(t => t.languageCode.startsWith('en'));
    if (!track) track = captionTracks[0]; 
    
    if (!track) return [];

    const transcriptResponse = await fetch(track.baseUrl);
    const xmlText = await transcriptResponse.text();
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const texts = xmlDoc.getElementsByTagName("text");
    
    const segments = [];
    for (let i = 0; i < texts.length; i++) {
      segments.push({
        start: parseFloat(texts[i].getAttribute("start")),
        duration: parseFloat(texts[i].getAttribute("dur")),
        text: texts[i].textContent.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      });
    }
    return segments;
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return [];
  }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translationProgress') {
    subBox.innerText = `2/3: Tüm metin çevriliyor (%${request.progress})...`;
  } else if (request.action === 'triggerTranslate') {
    if (isTranslating) stopTranslation();
    else startTranslation();
  }
});
