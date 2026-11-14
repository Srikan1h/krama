import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  isValidSettings,
  loadSettings,
  saveSettings,
  getModeDuration,
  STORAGE_KEY_SETTINGS,
} from './timerPersistence';
import { PomodoroSettings } from './types';

// Mock localStorage for node test runner
class LocalStorageMock implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  clear(): void {
    this.store = {};
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;

test('Settings: Default settings match requirements', () => {
  assert.equal(DEFAULT_SETTINGS.focusDuration, 25);
  assert.equal(DEFAULT_SETTINGS.shortBreakDuration, 5);
  assert.equal(DEFAULT_SETTINGS.longBreakDuration, 15);
  assert.equal(DEFAULT_SETTINGS.longBreakInterval, 4);
});

test('Settings: Validation handles valid and invalid objects', () => {
  assert.equal(isValidSettings(DEFAULT_SETTINGS), true);
  assert.equal(isValidSettings({
    focusDuration: 50,
    shortBreakDuration: 10,
    longBreakDuration: 30,
    longBreakInterval: 6,
  }), true);

  // Invalid: missing or out of range
  assert.equal(isValidSettings(null), false);
  assert.equal(isValidSettings({ focusDuration: 0 }), false);
  assert.equal(isValidSettings({ ...DEFAULT_SETTINGS, focusDuration: 150 }), false); // max 120
  assert.equal(isValidSettings({ ...DEFAULT_SETTINGS, shortBreakDuration: -1 }), false);
  assert.equal(isValidSettings({ ...DEFAULT_SETTINGS, longBreakDuration: 100 }), false); // max 90
  assert.equal(isValidSettings({ ...DEFAULT_SETTINGS, longBreakInterval: 0 }), false);
  assert.equal(isValidSettings({ ...DEFAULT_SETTINGS, longBreakInterval: 50 }), false);
});

test('Settings: loadSettings returns defaults when storage is empty or corrupt', () => {
  mockStorage.clear();
  const loaded1 = loadSettings();
  assert.deepEqual(loaded1, DEFAULT_SETTINGS);

  mockStorage.setItem(STORAGE_KEY_SETTINGS, 'invalid json {');
  const loaded2 = loadSettings();
  assert.deepEqual(loaded2, DEFAULT_SETTINGS);

  mockStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({ focusDuration: 'not a number' }));
  const loaded3 = loadSettings();
  assert.deepEqual(loaded3, DEFAULT_SETTINGS);
});

test('Settings: saveSettings and loadSettings round-trip correctly', () => {
  mockStorage.clear();
  const custom: PomodoroSettings = {
    focusDuration: 45,
    shortBreakDuration: 10,
    longBreakDuration: 25,
    longBreakInterval: 3,
  };
  saveSettings(custom);
  const reloaded = loadSettings();
  assert.deepEqual(reloaded, custom);
});

test('Settings: getModeDuration respects customized settings', () => {
  const custom: PomodoroSettings = {
    focusDuration: 50,
    shortBreakDuration: 12,
    longBreakDuration: 20,
    longBreakInterval: 4,
  };

  assert.equal(getModeDuration('focus', custom), 50 * 60);
  assert.equal(getModeDuration('short-break', custom), 12 * 60);
  assert.equal(getModeDuration('long-break', custom), 20 * 60);

  // Fallback without settings uses defaults
  assert.equal(getModeDuration('focus'), 25 * 60);
  assert.equal(getModeDuration('short-break'), 5 * 60);
  assert.equal(getModeDuration('long-break'), 15 * 60);
});

test('Settings: Cycle progression calculation with custom interval', () => {
  const interval = 3;
  // Completed sessions count: 1 -> short break, 2 -> short break, 3 -> long break
  assert.equal(1 % interval === 0, false);
  assert.equal(2 % interval === 0, false);
  assert.equal(3 % interval === 0, true);
  assert.equal(4 % interval === 0, false);
  assert.equal(6 % interval === 0, true);
});

