document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['apiKey'], (result) => {
    if (result.apiKey) {
      document.getElementById('apiKey').value = result.apiKey;
    }
  });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  chrome.storage.sync.set({ apiKey: key }, () => {
    const status = document.getElementById('status');
    status.innerText = 'Ayarlar başarıyla kaydedildi!';
    setTimeout(() => {
      status.innerText = '';
    }, 3000);
  });
});
