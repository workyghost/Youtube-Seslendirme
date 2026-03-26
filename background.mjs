chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateFullTranscript') {
    handleTranslation(request.segments, sender.tab.id).then(sendResponse);
    return true; // Asenkron yanıt için
  } else if (request.action === 'speak') {
    chrome.tts.speak(request.text, { lang: 'tr-TR', rate: 1.0, enqueue: true });
  } else if (request.action === 'stopSpeak') {
    chrome.tts.stop();
  }
});

async function handleTranslation(segments, tabId) {
  try {
    const data = await chrome.storage.sync.get(['apiKey']);
    const apiKey = data.apiKey;
    
    if (!apiKey) {
      return { success: false, error: 'API Anahtarı eksik. Lütfen eklenti menüsünden girin.' };
    }

    // 40 satırlık güvenli bloklar
    const chunkSize = 40;
    let allTranslated = [];

    for (let i = 0; i < segments.length; i += chunkSize) {
      const chunk = segments.slice(i, i + chunkSize);
      
      chrome.tabs.sendMessage(tabId, { 
        action: 'translationProgress', 
        progress: Math.round((i / segments.length) * 100) 
      });

      // KESİN ÇÖZÜM: İstenen model gemini-3.1-flash-lite-preview
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are a professional subtitle translator. Translate the given JSON array of strings from English to Turkish. Return ONLY a valid JSON array of strings with the EXACT SAME length and order. Do not add markdown formatting, do not add ```json." }]
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
        throw new Error(errData.error?.message || `API Hatası (${response.status})`);
      }

      const result = await response.json();
      let translatedText = result.candidates[0].content.parts[0].text;
      
      // Olası markdown kalıntılarını temizle
      translatedText = translatedText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const translatedChunk = JSON.parse(translatedText);
      allTranslated = allTranslated.concat(translatedChunk);
    }

    return { success: true, translated: allTranslated };
  } catch (error) {
    console.error("Translation error:", error);
    return { success: false, error: error.message };
  }
}
