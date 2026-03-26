let isTranslating = false;
let transcript = [];
let currentSegmentIndex = -1;
let video = null;
let btn = null;
let subBox = null;

// 1. Altyazı Kutusunu Oluştur
function createSubtitleBox() {
  if (document.querySelector('.yt-translator-subs')) return;
  subBox = document.createElement('div');
  subBox.className = 'yt-translator-subs';
  
  const videoContainer = document.querySelector('#movie_player') || document.body;
  videoContainer.appendChild(subBox);
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
    
    // Butonun YouTube'a tam uyumlu görünümü
    btn.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 10px; font-family: 'YouTube Noto', Roboto, Arial, sans-serif; font-size: 14px; font-weight: 500; color: #fff;">
        <span id="yt-trans-badge" style="background: #cc0000; color: #fff; padding: 2px 6px; border-radius: 4px; margin-right: 6px; font-weight: bold; font-size: 12px;">TR</span>
        <span id="yt-trans-text">Çevir</span>
      </div>
    `;
    
    btn.addEventListener('click', () => {
      if (isTranslating) stopTranslation();
      else startTranslation();
    });
    
    // Ses butonundan hemen sonra ekle
    if (leftControls.children.length > 1) {
      leftControls.insertBefore(btn, leftControls.children[1]);
    } else {
      leftControls.appendChild(btn);
    }
    
    createSubtitleBox();
  }
}

// YouTube sayfaları dinamik değiştiği için butonu sürekli kontrol et
setInterval(injectButton, 1000);

// 3. Çeviri İşlemini Başlat
async function startTranslation() {
  chrome.storage.sync.get(['apiKey'], async (result) => {
    if (!result.apiKey) {
      alert("Lütfen önce sağ üstteki eklenti ikonuna tıklayıp Gemini API Anahtarınızı girin!");
      return;
    }

    isTranslating = true;
    document.getElementById('yt-trans-badge').style.background = '#555';
    document.getElementById('yt-trans-badge').innerText = '🛑';
    document.getElementById('yt-trans-text').innerText = 'Durdur';
    
    subBox.style.display = 'block';
    subBox.innerText = "1/3: Altyazılar çekiliyor...";
    
    if (video) video.pause();

    const videoId = new URLSearchParams(window.location.search).get('v');
    
    try {
      transcript = await fetchTranscript(videoId);
      if (transcript.length === 0) {
        subBox.innerText = "Hata: Bu video için altyazı bulunamadı veya kapalı.";
        setTimeout(stopTranslation, 4000);
        return;
      }

      subBox.innerText = "2/3: Tüm metin çevriliyor (0%)... Lütfen bekleyin.";
      const segmentsText = transcript.map(t => t.text);
      
      chrome.runtime.sendMessage(
        { action: 'translateFullTranscript', segments: segmentsText },
        (response) => {
          if (response && response.success) {
            const translatedTexts = response.translated;
            for (let i = 0; i < transcript.length; i++) {
              if (translatedTexts[i]) {
                transcript[i].text = translatedTexts[i];
              }
            }
            
            subBox.innerText = "3/3: Tercüme tamamlandı! Oynatılıyor...";
            setTimeout(() => { subBox.innerText = ""; }, 2000);
            
            currentSegmentIndex = -1;
            video.addEventListener('timeupdate', handleTimeUpdate);
            video.addEventListener('pause', handlePause);
            video.addEventListener('seeked', handleSeek);
            video.play();
          } else {
            subBox.innerText = "Çeviri Hatası: " + (response ? response.error : "Bilinmeyen Hata");
            setTimeout(stopTranslation, 6000);
          }
        }
      );
    } catch (err) {
      subBox.innerText = "Beklenmeyen bir hata oluştu.";
      console.error(err);
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
    subBox.innerText = "";
  }
  
  if (video) {
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('seeked', handleSeek);
  }
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
  if (subBox) subBox.innerText = "";
}

function handleTimeUpdate() {
  if (!isTranslating || !subBox) return;
  const currentTime = video.currentTime;
  
  const segmentIndex = transcript.findIndex(s => currentTime >= s.start && currentTime < s.start + s.duration);
  
  if (segmentIndex !== -1 && segmentIndex !== currentSegmentIndex) {
    currentSegmentIndex = segmentIndex;
    const text = transcript[segmentIndex].text;
    subBox.innerText = text;
    chrome.runtime.sendMessage({ action: 'speak', text: text });
  } else if (segmentIndex === -1) {
    subBox.innerText = "";
  }
}

// 6. Altyazı Çekme (Scraper) - En Sağlam Yöntem
async function fetchTranscript(videoId) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    let captionTracks = [];
    
    // Yöntem 1: ytInitialPlayerResponse
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
    if (playerResponseMatch) {
      try {
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        if (playerResponse.captions && playerResponse.captions.playerCaptionsTracklistRenderer) {
          captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks || [];
        }
      } catch (e) { console.error("JSON parse error for ytInitialPlayerResponse", e); }
    }
    
    // Yöntem 2: Fallback regex
    if (captionTracks.length === 0) {
      const captionsRegex = /"captionTracks":\s*(\[.*?\])/;
      const match = captionsRegex.exec(html);
      if (match && match[1]) {
        try {
          captionTracks = JSON.parse(match[1]);
        } catch (e) { console.error("JSON parse error for captionTracks", e); }
      }
    }
    
    if (captionTracks.length === 0) return [];
    
    // İngilizceyi tercih et, yoksa ilkini al
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
      const textContent = texts[i].textContent
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n/g, ' ')
        .trim();
        
      if (textContent) {
        segments.push({
          start: parseFloat(texts[i].getAttribute("start")),
          duration: parseFloat(texts[i].getAttribute("dur")),
          text: textContent
        });
      }
    }
    return segments;
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return [];
  }
}

// 7. Arka Plandan Gelen Mesajları Dinle
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'translationProgress' && subBox) {
    subBox.innerText = `2/3: Tüm metin çevriliyor (%${request.progress})...`;
  }
});
