<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# YouTube Translator & Narrator

YouTube videolarını **Türkçeye çeviren** ve **Chrome TTS ile sesli okuyan** Chrome eklentisi.

**İngilizce video → Gemini API ile Türkçe çeviri → Türkçe seslendirme**

---

## Özellikler

- YouTube oynatma çubuğuna **"Çevir"** butonu ekler
- İngilizce altyazıları otomatik çeker (script injection + HTTP fallback)
- **Gemini 2.0 Flash Lite** ile Türkçeye çevirir
- Chrome TTS ile **Türkçe seslendirir**, video ile senkronize çalar
- Segment geçişlerinde eski ses kesilir, yenisi başlar

---

## Kurulum

**Gereksinimler:** Chrome, Gemini API anahtarı

1. Bu repoyu klonla veya ZIP olarak indir
2. Chrome'da `chrome://extensions` adresine git
3. **"Geliştirici modu"**nu aç
4. **"Paketlenmemiş uzantı yükle"** → proje klasörünü seç
5. Eklenti ikonuna tıkla → Gemini API anahtarını gir

> Gemini API anahtarı: [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Kullanım

1. Herhangi bir YouTube videosuna git
2. Oynatma çubuğundaki **TR / Çevir** butonuna tıkla
3. Altyazı çekilip çevrilirken bekle (~10-30 saniye)
4. Video otomatik oynar, Türkçe seslendirme başlar
5. Durdurmak için tekrar **Durdur** butonuna tıkla

---

## Proje Yapısı

```
├── manifest.json           # Chrome eklenti tanımı (MV3)
├── content.js              # YouTube sayfasına enjekte edilen script
├── background.mjs          # Service worker: çeviri + TTS
├── transcript-fetcher.js   # Altyazı çekme modülü
├── sync-engine.js          # TTS zamanlama motoru (throttle + segment eşleştirme)
├── gemini-parser.js        # Gemini API yanıt ayrıştırıcı (güvenli parse)
├── popup.html / popup.js   # API anahtarı giriş ekranı
├── styles.css              # Altyazı kutusu stili
└── tests/                  # Jest testleri (60 test)
    ├── transcript.test.cjs
    ├── sync-engine.test.cjs
    └── gemini-parser.test.cjs
```

---

## Testler

```bash
npm install
npm test
```

71 birim testi — altyazı ayrıştırma, zamanlama motoru, API yanıt işleme, bellek yönetimi.

---

## Teknik Notlar

- **Altyazı çekme:** `window.ytInitialPlayerResponse` script injection ile okunur; HTTP fallback `[\s\S]` regex ile çok satırlı JSON'ı da yakalar
- **TTS sync:** `timeupdate` 80ms throttle ile ~12 kontrol/sn'ye düşürüldü; `enqueue: false` ile ses çakışması önlendi
- **Hata yönetimi:** Gemini null/bozuk JSON yanıtlarında crash yerine boş segment döner, çeviri devam eder
