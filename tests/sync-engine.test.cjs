'use strict';

const { createRequire } = require('module');
const requireFile = createRequire(__filename);

let findSegmentAtTime, createThrottle;

try {
  const mod = requireFile('../sync-engine.js');
  findSegmentAtTime = mod.findSegmentAtTime;
  createThrottle = mod.createThrottle;
} catch (e) {
  throw new Error('sync-engine.js yüklenemedi: ' + e.message);
}

// --- findSegmentAtTime ---

describe('findSegmentAtTime', () => {
  const segments = [
    { start: 0.0, duration: 2.0, text: 'birinci' },
    { start: 2.0, duration: 3.0, text: 'ikinci' },
    { start: 6.0, duration: 1.5, text: 'üçüncü' },
  ];

  test('segment başlangıcında (tam eşleşme) doğru indeksi döner', () => {
    expect(findSegmentAtTime(segments, 0.0)).toBe(0);
    expect(findSegmentAtTime(segments, 2.0)).toBe(1);
    expect(findSegmentAtTime(segments, 6.0)).toBe(2);
  });

  test('segment ortasında doğru indeksi döner', () => {
    expect(findSegmentAtTime(segments, 1.0)).toBe(0);
    expect(findSegmentAtTime(segments, 3.5)).toBe(1);
    expect(findSegmentAtTime(segments, 6.9)).toBe(2);
  });

  test('segment bitiş anı dahil değildir (yarı açık aralık)', () => {
    // start=0, dur=2 → geçerli: [0, 2), bitiş=2 artık ikinci segmente girer
    expect(findSegmentAtTime(segments, 2.0)).toBe(1); // 0. segmentin bitişi = 1. segmentin başı
    expect(findSegmentAtTime(segments, 7.5)).toBe(-1); // 2. segmentin sonu = 7.5
  });

  test('segmentler arası boşlukta -1 döner', () => {
    // 1. segment biter: 5.0, 2. başlar: 6.0 → boşluk [5.0, 6.0)
    expect(findSegmentAtTime(segments, 5.0)).toBe(-1);
    expect(findSegmentAtTime(segments, 5.5)).toBe(-1);
    expect(findSegmentAtTime(segments, 5.99)).toBe(-1);
  });

  test('video başından önce -1 döner', () => {
    expect(findSegmentAtTime(segments, -1.0)).toBe(-1);
  });

  test('tüm segmentlerden sonra -1 döner', () => {
    expect(findSegmentAtTime(segments, 100.0)).toBe(-1);
  });

  test('boş segments dizisi için -1 döner', () => {
    expect(findSegmentAtTime([], 5.0)).toBe(-1);
  });

  test('null/undefined segments için -1 döner (crash yok)', () => {
    expect(findSegmentAtTime(null, 1.0)).toBe(-1);
    expect(findSegmentAtTime(undefined, 1.0)).toBe(-1);
  });

  test('tek segmentli dizide çalışır', () => {
    const single = [{ start: 10.0, duration: 5.0, text: 'tek' }];
    expect(findSegmentAtTime(single, 10.0)).toBe(0);
    expect(findSegmentAtTime(single, 12.5)).toBe(0);
    expect(findSegmentAtTime(single, 15.0)).toBe(-1);
  });

  test('dur=0 olan segment anlık eşleşir', () => {
    const instant = [{ start: 5.0, duration: 0, text: 'anlık' }];
    // [5.0, 5.0) → hiçbir zaman eşleşmez
    expect(findSegmentAtTime(instant, 5.0)).toBe(-1);
  });
});

// --- createThrottle ---

describe('createThrottle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('ilk çağrıda fonksiyonu hemen çalıştırır', () => {
    const fn = jest.fn();
    const throttled = createThrottle(fn, 100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle süresi içinde tekrar çağrılırsa fonksiyonu çalıştırmaz', () => {
    const fn = jest.fn();
    const throttled = createThrottle(fn, 100);
    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('throttle süresi geçince tekrar çalıştırır', () => {
    const fn = jest.fn();
    const throttled = createThrottle(fn, 100);
    throttled();
    jest.advanceTimersByTime(101);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('argümanları doğru iletir', () => {
    const fn = jest.fn();
    const throttled = createThrottle(fn, 100);
    throttled('a', 42);
    expect(fn).toHaveBeenCalledWith('a', 42);
  });

  test('farklı throttle sürelerini doğru uygular', () => {
    const fn = jest.fn();
    const throttled = createThrottle(fn, 250);
    throttled();
    jest.advanceTimersByTime(200);
    throttled(); // henüz geçmedi
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60);
    throttled(); // 260ms geçti
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
