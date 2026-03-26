document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
      document.getElementById('actionBtn').style.display = 'block';
    }
  });
});

document.getElementById('toggleEye').addEventListener('click', function() {
  const input = document.getElementById('apiKey');
  if (input.type === 'password') {
    input.type = 'text';
    this.innerText = '🙈';
  } else {
    input.type = 'password';
    this.innerText = '👁️';
  }
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const key = document.getElementById('apiKey').value.trim();
  const status = document.getElementById('status');
  const saveBtn = document.getElementById('saveBtn');
  const actionBtn = document.getElementById('actionBtn');

  if (!key) {
    status.innerText = 'Lütfen bir API anahtarı girin.';
    status.className = 'error';
    return;
  }

  status.innerText = 'Doğrulanıyor... Lütfen bekleyin.';
  status.className = '';
  saveBtn.disabled = true;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
    });

    if (response.ok) {
      chrome.storage.sync.set({ apiKey: key }, () => {
        status.innerText = 'Başarılı! Doğrulandı ve Kaydedildi.';
        status.className = 'success';
        actionBtn.style.display = 'block';
      });
    } else {
      const errData = await response.json();
      status.innerText = 'Hata: ' + (errData.error?.message || 'Geçersiz API Anahtarı');
      status.className = 'error';
      actionBtn.style.display = 'none';
    }
  } catch (err) {
    status.innerText = 'Bağlantı hatası: ' + err.message;
    status.className = 'error';
  } finally {
    saveBtn.disabled = false;
  }
});

document.getElementById('actionBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if(tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "triggerTranslate"});
    }
  });
});
