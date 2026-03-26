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
    // Validation: listModels endpoint — hangi model adı olduğunu bilmeye gerek yok
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=5`
    );

    if (response.ok) {
      const data = await response.json();
      const models = filterGeminiModels(data.models || []);
      chrome.storage.sync.set({ apiKey: key }, () => {
        setStatus(`✓ Doğrulandı. ${models.length} model bulundu.`, 'success');
        enableTranslateBtn(true);
        renderModelList(models, key);
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
  loading.textContent = 'Modeller yükleniyor...';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
    );
    if (!res.ok) throw new Error('Model listesi alınamadı');
    const data = await res.json();
    renderModelList(filterGeminiModels(data.models || []), apiKey);
  } catch (err) {
    loading.textContent = 'Model listesi alınamadı: ' + err.message;
  }
}

function renderModelList(filtered, apiKey) {
  const loading = document.getElementById('modelLoading');
  const list = document.getElementById('modelList');

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

  chrome.storage.sync.get([STORAGE_KEY_MODEL], (result) => {
    const saved = result[STORAGE_KEY_MODEL];
    if (saved) setActiveModel(saved);
    else if (list.options.length > 0) {
      list.selectedIndex = 0;
      document.getElementById('selectedModel').textContent = formatModelName(list.options[0].value);
      document.getElementById('useModelBtn').disabled = false;
    }
  });
}
