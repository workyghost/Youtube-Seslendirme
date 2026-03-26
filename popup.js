// popup-utils.js bu dosyadan önce yüklenir (filterGeminiModels, formatModelName)

const STORAGE_KEY_MODEL = 'geminiModel';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

// --- Sayfa yüklenince kayıtlı değerleri doldur ---
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey', STORAGE_KEY_MODEL], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
      enableTranslateBtn(true);
      fetchAndShowModels(result.apiKey);
    }
    if (result[STORAGE_KEY_MODEL]) {
      setActiveModel(result[STORAGE_KEY_MODEL]);
    }
  });
});

// --- Göz ikonu ---
document.getElementById('toggleEye').addEventListener('click', function () {
  const input = document.getElementById('apiKey');
  input.type = input.type === 'password' ? 'text' : 'password';
  this.innerText = input.type === 'password' ? '👁️' : '🙈';
});

// --- API Anahtarı Doğrula & Kaydet ---
document.getElementById('saveBtn').addEventListener('click', async () => {
  const key = document.getElementById('apiKey').value.trim();
  const status = document.getElementById('status');
  const saveBtn = document.getElementById('saveBtn');

  if (!key) {
    setStatus('Lütfen bir API anahtarı girin.', 'error');
    return;
  }

  setStatus('Doğrulanıyor...', '');
  saveBtn.disabled = true;

  try {
    const model = getCurrentModel();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] }),
      }
    );

    if (response.ok) {
      chrome.storage.sync.set({ apiKey: key }, () => {
        setStatus('✓ API Anahtarı doğrulandı ve kaydedildi.', 'success');
        enableTranslateBtn(true);
        fetchAndShowModels(key);
      });
    } else {
      const errData = await response.json().catch(() => ({}));
      setStatus('Hata: ' + (errData.error?.message || 'Geçersiz API Anahtarı'), 'error');
    }
  } catch (err) {
    setStatus('Bağlantı hatası: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
});

// --- TR Çeviri Butonu (aktif sekmeye mesaj gönder) ---
document.getElementById('translateBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
    setStatus('Lütfen bir YouTube video sayfasında olun.', 'error');
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: 'startTranslationFromPopup' });
  window.close();
});

// --- Model Seçimi ---
document.getElementById('modelList').addEventListener('change', function () {
  const val = this.value;
  if (val) {
    document.getElementById('selectedModel').textContent = val;
    document.getElementById('useModelBtn').disabled = false;
  }
});

document.getElementById('useModelBtn').addEventListener('click', () => {
  const selected = document.getElementById('modelList').value;
  if (!selected) return;
  chrome.storage.sync.set({ [STORAGE_KEY_MODEL]: selected }, () => {
    setStatus(`Model seçildi: ${formatModelName(selected)}`, 'info');
    setActiveModel(selected);
  });
});

// --- Yardımcı Fonksiyonlar ---

function setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = cls;
}

function enableTranslateBtn(enabled) {
  document.getElementById('translateBtn').disabled = !enabled;
}

function getCurrentModel() {
  // storage'dan senkron okuyamayız — DOM'daki seçili değeri kullan
  const list = document.getElementById('modelList');
  return (list.value) || DEFAULT_MODEL;
}

function setActiveModel(modelId) {
  const list = document.getElementById('modelList');
  // Seçili option varsa seç
  for (const opt of list.options) {
    if (opt.value === modelId) {
      opt.selected = true;
      document.getElementById('selectedModel').textContent = formatModelName(modelId);
      document.getElementById('useModelBtn').disabled = false;
      return;
    }
  }
}

async function fetchAndShowModels(apiKey) {
  const loading = document.getElementById('modelLoading');
  const list = document.getElementById('modelList');
  loading.textContent = 'Modeller yükleniyor...';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    if (!res.ok) throw new Error('Model listesi alınamadı');

    const data = await res.json();
    const filtered = filterGeminiModels(data.models || []);

    list.innerHTML = '';
    if (filtered.length === 0) {
      list.innerHTML = '<option value="">Model bulunamadı</option>';
      loading.textContent = '';
      return;
    }

    filtered.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = formatModelName(m.name);
      list.appendChild(opt);
    });

    loading.textContent = `${filtered.length} model listelendi`;

    // Kayıtlı modeli seç
    chrome.storage.sync.get([STORAGE_KEY_MODEL], (result) => {
      const saved = result[STORAGE_KEY_MODEL] || `models/${DEFAULT_MODEL}`;
      setActiveModel(saved);
    });
  } catch (err) {
    loading.textContent = 'Model listesi alınamadı: ' + err.message;
  }
}
