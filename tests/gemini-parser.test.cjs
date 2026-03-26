'use strict';

const { createRequire } = require('module');
const requireFile = createRequire(__filename);

let extractTextFromGeminiResponse, parseTranslatedChunk, padTranslationChunk;

try {
  const mod = requireFile('../gemini-parser.js');
  extractTextFromGeminiResponse = mod.extractTextFromGeminiResponse;
  parseTranslatedChunk = mod.parseTranslatedChunk;
  padTranslationChunk = mod.padTranslationChunk;
} catch (e) {
  throw new Error('gemini-parser.js yüklenemedi: ' + e.message);
}

// --- extractTextFromGeminiResponse ---

describe('extractTextFromGeminiResponse', () => {
  function makeResponse(text) {
    return {
      candidates: [{ content: { parts: [{ text }] } }]
    };
  }

  test('geçerli yanıtten metni çıkarır', () => {
    const result = makeResponse('["merhaba","dünya"]');
    expect(extractTextFromGeminiResponse(result)).toBe('["merhaba","dünya"]');
  });

  test('null result için null döner (crash yok)', () => {
    expect(extractTextFromGeminiResponse(null)).toBeNull();
  });

  test('undefined result için null döner', () => {
    expect(extractTextFromGeminiResponse(undefined)).toBeNull();
  });

  test('candidates dizisi yoksa null döner', () => {
    expect(extractTextFromGeminiResponse({})).toBeNull();
  });

  test('candidates boş diziyse null döner', () => {
    expect(extractTextFromGeminiResponse({ candidates: [] })).toBeNull();
  });

  test('candidates[0] yoksa null döner', () => {
    expect(extractTextFromGeminiResponse({ candidates: [null] })).toBeNull();
  });

  test('content yoksa null döner', () => {
    expect(extractTextFromGeminiResponse({ candidates: [{}] })).toBeNull();
  });

  test('parts boş diziyse null döner', () => {
    expect(extractTextFromGeminiResponse({
      candidates: [{ content: { parts: [] } }]
    })).toBeNull();
  });

  test('text alanı yoksa null döner', () => {
    expect(extractTextFromGeminiResponse({
      candidates: [{ content: { parts: [{}] } }]
    })).toBeNull();
  });

  test('text boş string ise null döner', () => {
    expect(extractTextFromGeminiResponse(makeResponse(''))).toBeNull();
  });

  test('markdown ```json bloklarını temizler', () => {
    const result = makeResponse('```json\n["merhaba"]\n```');
    expect(extractTextFromGeminiResponse(result)).toBe('["merhaba"]');
  });

  test('sadece ``` olan bloklarını temizler', () => {
    const result = makeResponse('```\n["test"]\n```');
    expect(extractTextFromGeminiResponse(result)).toBe('["test"]');
  });

  test('başındaki/sonundaki boşlukları temizler', () => {
    const result = makeResponse('  ["merhaba"]  ');
    expect(extractTextFromGeminiResponse(result)).toBe('["merhaba"]');
  });
});

// --- parseTranslatedChunk ---

describe('parseTranslatedChunk', () => {
  test('geçerli JSON dizisini parse eder', () => {
    expect(parseTranslatedChunk('["merhaba","dünya"]')).toEqual(['merhaba', 'dünya']);
  });

  test('null input için null döner (crash yok)', () => {
    expect(parseTranslatedChunk(null)).toBeNull();
  });

  test('undefined input için null döner', () => {
    expect(parseTranslatedChunk(undefined)).toBeNull();
  });

  test('bozuk JSON için null döner (crash yok)', () => {
    expect(parseTranslatedChunk('{broken')).toBeNull();
  });

  test('dizi olmayan JSON için null döner', () => {
    expect(parseTranslatedChunk('{"key":"val"}')).toBeNull();
  });

  test('boş dizi için boş dizi döner', () => {
    expect(parseTranslatedChunk('[]')).toEqual([]);
  });

  test('iç içe nesneler içeren diziyi parse eder', () => {
    // Gemini bazen obje dönebilir — güvenli olmalı
    expect(parseTranslatedChunk('["a","b","c"]')).toEqual(['a', 'b', 'c']);
  });
});

// --- padTranslationChunk ---

describe('padTranslationChunk', () => {
  test('doğru uzunlukta geldiyse değiştirmez', () => {
    const original = ['a', 'b', 'c'];
    const translated = ['x', 'y', 'z'];
    expect(padTranslationChunk(translated, original.length)).toEqual(['x', 'y', 'z']);
  });

  test('çeviri kısa geldiyse orijinal metinlerle doldurur', () => {
    // Gemini 3 istenirken 2 dönerse → 3. eleman orijinalden alınır
    const translated = ['x', 'y'];
    const result = padTranslationChunk(translated, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('x');
    expect(result[1]).toBe('y');
    expect(result[2]).toBe('');  // boş string ile doldurulur
  });

  test('çeviri fazla geldiyse kırpar', () => {
    const translated = ['x', 'y', 'z', 'w'];
    const result = padTranslationChunk(translated, 3);
    expect(result).toHaveLength(3);
    expect(result).toEqual(['x', 'y', 'z']);
  });

  test('null translated için boş dizi döner', () => {
    const result = padTranslationChunk(null, 3);
    expect(result).toHaveLength(3);
    expect(result.every(s => s === '')).toBe(true);
  });

  test('expectedLength=0 için boş dizi döner', () => {
    expect(padTranslationChunk(['a', 'b'], 0)).toEqual([]);
  });
});
