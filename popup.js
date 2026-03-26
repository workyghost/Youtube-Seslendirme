document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
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

  if (!key) {
    status.innerText = 'Lütfen bir API anahtarı girin.';
    status.className = 'error';
    return;
  }

  status.innerText = 'Doğrulanıyor... Lütfen bekleyin.';
  status.className = '';
  saveBtn.disabled = true;

  try {
    // KESİN ÇÖZÜM: Kullanıcının istediği gemini-3.1-flash-lite-preview modeli kullanılıyor
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
    });

    if (response.ok) {
      chrome.storage.sync.set({ apiKey: key }, () => {
        status.innerText = 'Başarılı! API Anahtarı Doğrulandı ve Kaydedildi. Artık YouTube\'a gidip çeviri yapabilirsiniz.';
        status.className = 'success';
      });
    } else {
      const errData = await response.json();
      status.innerText = 'Hata: ' + (errData.error?.message || 'Geçersiz API Anahtarı');
      status.className = 'error';
    }
  } catch (err) {
    status.innerText = 'Bağlantı hatası: ' + err.message;
    status.className = 'error';
  } finally {
    saveBtn.disabled = false;
  }
});
