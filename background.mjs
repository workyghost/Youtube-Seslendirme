chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateFullTranscript') {
    handleFullTranslation(request.segments, sender.tab.id)
      .then(translated => sendResponse({ success: true, translated }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Asenkron yanıt vereceğimizi belirtir
  } else if (request.action === 'speak') {
    // enqueue: true sayesinde sesler üst üste binmez, sırayla okunur
    chrome.tts.speak(request.text, { lang: 'tr-TR', enqueue: true, rate: 1.0 });
  } else if (request.action === 'stopSpeak') {
    chrome.tts.stop();
  }
});

async function handleFullTranslation(segments, tabId) {
  const result = await chrome.storage.sync.get(['apiKey']);
  const apiKey = result.apiKey;
  
  if (!apiKey) throw new Error('API Anahtarı eksik. Lütfen eklenti menüsünden girin.');

  // Gemini API'nin tek seferde çok fazla token almasını önlemek için 100 satırlık bloklar halinde çeviriyoruz
  const chunkSize = 100;
  let allTranslated = [];

  for (let i = 0; i < segments.length; i += chunkSize) {
    const chunk = segments.slice(i, i + chunkSize);
    
    // Content script'e ilerleme durumunu bildir
    chrome.tabs.sendMessage(tabId, { 
      action: 'translationProgress', 
      progress: Math.round((i / segments.length) * 100) 
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-preview:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are a professional subtitle translator. Translate the given JSON array of strings from English to Turkish. Return ONLY a valid JSON array of strings with the EXACT SAME length and order. Do not combine or split items." }]
        },
        contents: [{ parts: [{ text: JSON.stringify(chunk) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: { type: "STRING" }
          }
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("API Error:", errData);
      throw new Error(`API Hatası: ${response.status}`);
    }
    
    const data = await response.json();
    const translatedChunkText = data.candidates[0].content.parts[0].text;
    const translatedChunk = JSON.parse(translatedChunkText);
    
    allTranslated = allTranslated.concat(translatedChunk);
  }

  return allTranslated;
}
