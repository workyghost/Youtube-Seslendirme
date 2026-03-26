chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateAndSpeak') {
    handleTranslateAndSpeak(request.text, sender.tab.id).catch(err => console.error(err));
  } else if (request.action === 'stopSpeak') {
    chrome.tts.stop();
  }
});

async function handleTranslateAndSpeak(text, tabId) {
  const result = await chrome.storage.sync.get(['apiKey']);
  const apiKey = result.apiKey;
  
  if (!apiKey) {
    chrome.tabs.sendMessage(tabId, { action: 'translationError' });
    return;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Aşağıdaki metni Türkçe'ye çevir ve sadece çeviriyi döndür. Ekstra açıklama yapma: ${text}` }] }]
      })
    });

    if (!response.ok) {
      chrome.tabs.sendMessage(tabId, { action: 'translationError' });
      return;
    }
    
    const data = await response.json();
    const turkishText = data.candidates[0].content.parts[0].text.trim();

    // 1. Çeviriyi ekranda göstermek için content.js'e geri gönder
    chrome.tabs.sendMessage(tabId, { action: 'showTranslation', text: turkishText });

    // 2. Chrome TTS ile Türkçe seslendir
    chrome.tts.speak(turkishText, { 
      lang: 'tr-TR', 
      rate: 1.0 
    });
  } catch (error) {
    console.error("Translation error:", error);
    chrome.tabs.sendMessage(tabId, { action: 'translationError' });
  }
}
