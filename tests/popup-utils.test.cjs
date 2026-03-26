'use strict';

const { createRequire } = require('module');
const requireFile = createRequire(__filename);

let filterGeminiModels, formatModelName;

try {
  const mod = requireFile('../popup-utils.js');
  filterGeminiModels = mod.filterGeminiModels;
  formatModelName = mod.formatModelName;
} catch (e) {
  throw new Error('popup-utils.js yüklenemedi: ' + e.message);
}

// --- filterGeminiModels ---

describe('filterGeminiModels', () => {
  const makeModel = (name, methods = ['generateContent']) => ({
    name: `models/${name}`,
    supportedGenerationMethods: methods,
    displayName: name,
  });

  test('generateContent destekleyen modelleri döner', () => {
    const models = [
      makeModel('gemini-2.0-flash'),
      makeModel('gemini-3.1-flash-lite'),
      makeModel('embedding-001', ['embedContent']),
    ];
    const result = filterGeminiModels(models);
    expect(result.map(m => m.name)).toEqual([
      'models/gemini-2.0-flash',
      'models/gemini-3.1-flash-lite',
    ]);
  });

  test('gemini olmayan modelleri filtreler', () => {
    const models = [
      makeModel('gemini-2.0-flash'),
      makeModel('text-bison-001'),
      makeModel('aqa'),
    ];
    const result = filterGeminiModels(models);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('models/gemini-2.0-flash');
  });

  test('boş liste için boş dizi döner', () => {
    expect(filterGeminiModels([])).toEqual([]);
  });

  test('null/undefined için boş dizi döner (crash yok)', () => {
    expect(filterGeminiModels(null)).toEqual([]);
    expect(filterGeminiModels(undefined)).toEqual([]);
  });

  test('flash modelleri önce, pro modelleri sonra sıralar', () => {
    const models = [
      makeModel('gemini-2.0-pro'),
      makeModel('gemini-3.1-flash-lite'),
      makeModel('gemini-2.0-flash'),
    ];
    const result = filterGeminiModels(models);
    const names = result.map(m => m.name);
    const flashIdx = names.findIndex(n => n.includes('flash'));
    const proIdx = names.findIndex(n => n.includes('pro'));
    expect(flashIdx).toBeLessThan(proIdx);
  });

  test('experimental/preview modelleri sona koyar', () => {
    const models = [
      makeModel('gemini-2.0-flash-exp'),
      makeModel('gemini-3.1-flash-lite'),
    ];
    const result = filterGeminiModels(models);
    expect(result[0].name).toBe('models/gemini-3.1-flash-lite');
    expect(result[1].name).toBe('models/gemini-2.0-flash-exp');
  });
});

// --- formatModelName ---

describe('formatModelName', () => {
  test('models/ önekini kaldırır', () => {
    expect(formatModelName('models/gemini-3.1-flash-lite')).toBe('gemini-3.1-flash-lite');
  });

  test('öneksiz model adını olduğu gibi döner', () => {
    expect(formatModelName('gemini-2.0-flash')).toBe('gemini-2.0-flash');
  });

  test('null/undefined için boş string döner', () => {
    expect(formatModelName(null)).toBe('');
    expect(formatModelName(undefined)).toBe('');
  });

  test('preview/exp etiketini köşeli paranteze alır', () => {
    expect(formatModelName('models/gemini-2.0-flash-exp')).toBe('gemini-2.0-flash [exp]');
    expect(formatModelName('models/gemini-2.0-flash-preview')).toBe('gemini-2.0-flash [preview]');
  });
});
