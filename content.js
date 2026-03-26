let isTranslating = false;
let transcript = [];
let currentSegmentIndex = -1;
const video = document.querySelector('video');

// Buton
const btn = document.createElement('button');
btn.className = 'yt-translator-btn';
btn.innerHTML = '<div class="play-icon"></div> Tercüme Et';

// Altyazı Kutusu
const subBox = document.createElement('div');
subBox.className = 'yt-translator-subs';

const videoContainer = document.querySelector('#movie_player');
if (videoContainer) {
  videoContainer.appendChild(btn);
  videoContainer.appendChild(subBox);
}

async function startTranslation() {
  isTranslating = true;
  btn.classList.add('active');
  btn.innerHTML = '<div class="play-icon"></div> Durdur';
  subBox.style.display = 'block';
  subBox.innerText = "Altyazılar analiz ediliyor...";
  
  if (video) video.volume = 0.2;

  const videoId = new URLSearchParams(window.location.search).get('v');
  
  try {
    transcript = await fetchTranscript(videoId);
    if (transcript.length === 0) {
      subBox.innerText = "Bu video için altyazı bulunamadı.";
      setTimeout(stopTranslation, 4000);
      return;
    }
    subBox.innerText = "Tercüme başlıyor...";
    video.addEventListener('timeupdate', handleTimeUpdate);
  } catch (err) {
    subBox.innerText = "Altyazı çekilirken hata oluştu.";
    console.error(err);
    setTimeout(stopTranslation, 4000);
  }
}

function stopTranslation() {
  isTranslating = false;
  btn.classList.remove('active');
  btn.innerHTML = '<div class="play-icon"></div> Tercüme Et';
  subBox.style.display = 'none';
  subBox.innerText = "";
  
  if (video) video.volume = 1.0;
  video.removeEventListener('timeupdate', handleTimeUpdate);
  chrome.runtime.sendMessage({ action: 'stopSpeak' });
  currentSegmentIndex = -1;
}

async function handleTimeUpdate() {
  if (!isTranslating) return;
  const currentTime = video.currentTime;
  
  const segment = transcript.find(s => currentTime >= s.start && currentTime < s.start + s.duration);
  
  if (segment && transcript.indexOf(segment) !== currentSegmentIndex) {
    currentSegmentIndex = transcript.indexOf(segment);
    subBox.innerText = "..."; // Çeviri bekleniyor
    chrome.runtime.sendMessage({ action: 'translateAndSpeak', text: segment.text });
  } else if (!segment) {
    subBox.innerText = ""; // Boşluklarda altyazıyı temizle
  }
}

async function fetchTranscript(videoId) {
  try {
    // 1. Videonun sayfa kaynağını çek
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
    const html = await response.text();
    
    // 2. captionTracks verisini bul (Otomatik veya manuel altyazılar)
    const captionsRegex = /"captionTracks":(\[.*?\])/;
    const match = captionsRegex.exec(html);
    
    if (!match) return [];
    
    const captionTracks = JSON.parse(match[1]);
    
    // 3. İngilizce veya ilk bulunan altyazıyı seç
    let track = captionTracks.find(t => t.languageCode === 'en' || t.languageCode === 'en-US');
    if (!track) track = captionTracks[0]; 
    
    if (!track) return [];

    // 4. Altyazı XML'ini çek
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
        text: texts[i].textContent.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      });
    }
    return segments;
  } catch (error) {
    console.error("Transcript fetch error:", error);
    return [];
  }
}

btn.addEventListener('click', () => {
  if (isTranslating) stopTranslation();
  else startTranslation();
});

// Background'dan gelen çevrilmiş metni dinle ve ekrana yaz
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'showTranslation') {
    subBox.innerText = request.text;
  } else if (request.action === 'translationError') {
    subBox.innerText = "Hata: Lütfen eklenti menüsünden API Anahtarınızı girin.";
  }
});
