'use strict';
/**
 * transcript-fetcher.js saf fonksiyonları için TDD testleri.
 */

// Production kodunu import et
// Not: transcript-fetcher.js'in sonundaki module.exports koşullu bloğu
// sayesinde Node.js ortamında bu require çalışır.
// Chrome extension ortamında ise o blok çalışmaz (module tanımsız).

// Node.js "type":"module" ESM projede .js dosyası ESM olarak yorumlanır,
// bu yüzden require trick kullanıyoruz: Module.createRequire ile
const { createRequire } = require('module');
const requireFile = createRequire(__filename);

let selectBestTrack, decodeHtmlEntities, extractCaptionTracksFromHtml;

try {
  const mod = requireFile('../transcript-fetcher.js');
  selectBestTrack = mod.selectBestTrack;
  decodeHtmlEntities = mod.decodeHtmlEntities;
  extractCaptionTracksFromHtml = mod.extractCaptionTracksFromHtml;
} catch (e) {
  // Fallback: dosya bulunamazsa testler açık hata verir
  throw new Error('transcript-fetcher.js yüklenemedi: ' + e.message);
}

// --- TEST SUITE ---

describe('selectBestTrack', () => {
  test('boş dizi için null döner', () => {
    expect(selectBestTrack([])).toBeNull();
  });

  test('null/undefined için null döner', () => {
    expect(selectBestTrack(null)).toBeNull();
    expect(selectBestTrack(undefined)).toBeNull();
  });

  test('İngilizce track varsa onu seçer', () => {
    const tracks = [
      { languageCode: 'fr', baseUrl: 'fr-url' },
      { languageCode: 'en', baseUrl: 'en-url' },
      { languageCode: 'de', baseUrl: 'de-url' },
    ];
    expect(selectBestTrack(tracks)).toEqual({ languageCode: 'en', baseUrl: 'en-url' });
  });

  test('en-US gibi bölgesel İngilizce kodu da kabul eder', () => {
    const tracks = [
      { languageCode: 'fr', baseUrl: 'fr-url' },
      { languageCode: 'en-US', baseUrl: 'en-us-url' },
    ];
    expect(selectBestTrack(tracks)).toEqual({ languageCode: 'en-US', baseUrl: 'en-us-url' });
  });

  test('İngilizce yoksa ilk track\'i seçer', () => {
    const tracks = [
      { languageCode: 'fr', baseUrl: 'fr-url' },
      { languageCode: 'de', baseUrl: 'de-url' },
    ];
    expect(selectBestTrack(tracks)).toEqual({ languageCode: 'fr', baseUrl: 'fr-url' });
  });

  test('tek track varsa onu döner', () => {
    const tracks = [{ languageCode: 'tr', baseUrl: 'tr-url' }];
    expect(selectBestTrack(tracks)).toEqual({ languageCode: 'tr', baseUrl: 'tr-url' });
  });
});

describe('decodeHtmlEntities', () => {
  test('&amp; karakterini & yapar', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  test("&#39; karakterini ' yapar", () => {
    expect(decodeHtmlEntities("I&#39;m here")).toBe("I'm here");
  });

  test('&quot; karakterini " yapar', () => {
    expect(decodeHtmlEntities('Say &quot;hello&quot;')).toBe('Say "hello"');
  });

  test('&lt; ve &gt; karakterlerini dönüştürür', () => {
    expect(decodeHtmlEntities('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
  });

  test('newline karakterlerini boşluğa çevirir', () => {
    expect(decodeHtmlEntities('line one\nline two')).toBe('line one line two');
  });

  test('başındaki ve sonundaki boşlukları temizler', () => {
    expect(decodeHtmlEntities('  hello world  ')).toBe('hello world');
  });

  test('birden fazla entity aynı anda dönüştürülür', () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry&#39;s &quot;show&quot;")).toBe(`Tom & Jerry's "show"`);
  });
});

describe('extractCaptionTracksFromHtml', () => {
  test('boş HTML için boş dizi döner', () => {
    expect(extractCaptionTracksFromHtml('')).toEqual([]);
  });

  test('captionTracks olmayan HTML için boş dizi döner', () => {
    expect(extractCaptionTracksFromHtml('<html><body>no captions here</body></html>')).toEqual([]);
  });

  test('audioTracks ile biten captionTracks\'i parse eder', () => {
    const tracks = [{ languageCode: 'en', baseUrl: 'https://example.com/en' }];
    const html = `"captionTracks":${JSON.stringify(tracks)},"audioTracks"`;
    expect(extractCaptionTracksFromHtml(html)).toEqual(tracks);
  });

  test('defaultAudioTrackIndex ile biten captionTracks\'i parse eder', () => {
    const tracks = [{ languageCode: 'en', baseUrl: 'https://example.com/en' }];
    const html = `"captionTracks":${JSON.stringify(tracks)},"defaultAudioTrackIndex"`;
    expect(extractCaptionTracksFromHtml(html)).toEqual(tracks);
  });

  test('translationLanguages ile biten captionTracks\'i parse eder', () => {
    const tracks = [{ languageCode: 'fr', baseUrl: 'https://example.com/fr' }];
    const html = `"captionTracks":${JSON.stringify(tracks)},"translationLanguages"`;
    expect(extractCaptionTracksFromHtml(html)).toEqual(tracks);
  });

  test('ÖNEMLİ: çok satırlı (multiline) JSON\'ı da parse eder', () => {
    const tracks = [
      { languageCode: 'en', baseUrl: 'https://example.com/en', name: { simpleText: 'English' } },
      { languageCode: 'fr', baseUrl: 'https://example.com/fr', name: { simpleText: 'French' } },
    ];
    const tracksJson = JSON.stringify(tracks, null, 2);
    const html = `var ytInitialPlayerResponse = {\n  "captions": {\n    "captionTracks": ${tracksJson},\n    "audioTracks": []\n  }\n};`;
    const result = extractCaptionTracksFromHtml(html);
    expect(result).toHaveLength(2);
    expect(result[0].languageCode).toBe('en');
  });

  test('bozuk JSON için boş dizi döner (crash yok)', () => {
    const html = '"captionTracks":[{broken json}],"audioTracks"';
    expect(extractCaptionTracksFromHtml(html)).toEqual([]);
  });
});
