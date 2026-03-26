'use strict';
/**
 * @jest-environment jsdom
 */

const { createRequire } = require('module');
const requireFile = createRequire(__filename);

let createCleanupManager;

try {
  const mod = requireFile('../cleanup-manager.js');
  createCleanupManager = mod.createCleanupManager;
} catch (e) {
  throw new Error('cleanup-manager.js yüklenemedi: ' + e.message);
}

// --- createCleanupManager ---

describe('createCleanupManager — listener yönetimi', () => {
  test('registerListener çağrısı addEventListener\'ı tetikler', () => {
    const manager = createCleanupManager();
    const el = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const handler = jest.fn();

    manager.registerListener(el, 'click', handler);

    expect(el.addEventListener).toHaveBeenCalledWith('click', handler);
  });

  test('cleanAll çağrısı tüm listener\'ları removeEventListener ile siler', () => {
    const manager = createCleanupManager();
    const el = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const h1 = jest.fn();
    const h2 = jest.fn();

    manager.registerListener(el, 'click', h1);
    manager.registerListener(el, 'mousemove', h2);
    manager.cleanAll();

    expect(el.removeEventListener).toHaveBeenCalledWith('click', h1);
    expect(el.removeEventListener).toHaveBeenCalledWith('mousemove', h2);
  });

  test('cleanAll sonrası listenerCount sıfırlanır', () => {
    const manager = createCleanupManager();
    const el = { addEventListener: jest.fn(), removeEventListener: jest.fn() };

    manager.registerListener(el, 'click', jest.fn());
    manager.registerListener(el, 'pause', jest.fn());
    expect(manager.listenerCount).toBe(2);

    manager.cleanAll();
    expect(manager.listenerCount).toBe(0);
  });

  test('cleanAll birden fazla kez çağrılabilir (crash yok)', () => {
    const manager = createCleanupManager();
    const el = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    manager.registerListener(el, 'click', jest.fn());

    expect(() => {
      manager.cleanAll();
      manager.cleanAll();
      manager.cleanAll();
    }).not.toThrow();
  });

  test('farklı elementlerin listener\'ları ayrı ayrı temizlenir', () => {
    const manager = createCleanupManager();
    const el1 = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const el2 = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const h1 = jest.fn();
    const h2 = jest.fn();

    manager.registerListener(el1, 'click', h1);
    manager.registerListener(el2, 'timeupdate', h2);
    manager.cleanAll();

    expect(el1.removeEventListener).toHaveBeenCalledWith('click', h1);
    expect(el2.removeEventListener).toHaveBeenCalledWith('timeupdate', h2);
  });
});

describe('createCleanupManager — DOM element yönetimi', () => {
  test('registerElement + cleanAll elementi DOM\'dan kaldırır', () => {
    const manager = createCleanupManager();
    const div = document.createElement('div');
    document.body.appendChild(div);

    expect(document.body.contains(div)).toBe(true);

    manager.registerElement(div);
    manager.cleanAll();

    expect(document.body.contains(div)).toBe(false);
  });

  test('cleanAll sonrası elementCount sıfırlanır', () => {
    const manager = createCleanupManager();
    const el1 = document.createElement('div');
    const el2 = document.createElement('span');
    document.body.appendChild(el1);
    document.body.appendChild(el2);

    manager.registerElement(el1);
    manager.registerElement(el2);
    expect(manager.elementCount).toBe(2);

    manager.cleanAll();
    expect(manager.elementCount).toBe(0);
  });

  test('DOM\'dan zaten kaldırılmış element için cleanAll crash yapmaz', () => {
    const manager = createCleanupManager();
    const div = document.createElement('div');
    // DOM'a eklenmemiş element

    manager.registerElement(div);
    expect(() => manager.cleanAll()).not.toThrow();
  });

  test('listener ve element birlikte temizlenir', () => {
    const manager = createCleanupManager();
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    const video = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const handler = jest.fn();

    manager.registerElement(btn);
    manager.registerListener(video, 'timeupdate', handler);

    manager.cleanAll();

    expect(document.body.contains(btn)).toBe(false);
    expect(video.removeEventListener).toHaveBeenCalledWith('timeupdate', handler);
    expect(manager.listenerCount).toBe(0);
    expect(manager.elementCount).toBe(0);
  });
});

describe('createCleanupManager — interval yönetimi', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('registerInterval + cleanAll interval\'ı durdurur', () => {
    const manager = createCleanupManager();
    const fn = jest.fn();
    const id = setInterval(fn, 1000);

    manager.registerInterval(id);
    manager.cleanAll();

    jest.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
  });

  test('birden fazla interval temizlenir', () => {
    const manager = createCleanupManager();
    const fn1 = jest.fn();
    const fn2 = jest.fn();

    manager.registerInterval(setInterval(fn1, 500));
    manager.registerInterval(setInterval(fn2, 1000));
    manager.cleanAll();

    jest.advanceTimersByTime(3000);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });
});
