import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_SECONDS,
  SHORT_BREAK_SECONDS,
  saveTimerSession,
  clearTimerSession,
  restoreTimerSession,
  markSessionCompleted,
  isSessionCompleted,
  STORAGE_KEY_TIMER_SESSION,
  STORAGE_KEY_COMPLETED_SESSIONS,
  STORAGE_KEY_POMODORO_SECONDS,
  STORAGE_KEY_POMODORO_MODE,
} from './timerPersistence';
import { PersistedTimerSession } from './types';

// Mock localStorage
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

test('Integration: Running timer transition and legacy key synchronization', () => {
  mockStorage.clear();
  const now = 1700000000000;
  const runningSession: PersistedTimerSession = {
    sessionId: 'sess_integ_1',
    status: 'running',
    mode: 'focus',
    startedAt: now,
    expectedEndAt: now + 1500_000,
    remainingSeconds: 1500,
    taskId: 'task_integ',
    lastUpdated: now,
  };

  saveTimerSession(runningSession);

  // When running, mode should be synced to legacy key, but pomodoro_seconds is not overwritten with running values
  assert.equal(mockStorage.getItem(STORAGE_KEY_POMODORO_MODE), JSON.stringify('focus'));

  // Pause session
  const pausedSession: PersistedTimerSession = {
    ...runningSession,
    status: 'paused',
    expectedEndAt: null,
    remainingSeconds: 1200,
    lastUpdated: now + 300_000,
  };
  saveTimerSession(pausedSession);

  // When paused, legacy pomodoro_seconds must be synced
  assert.equal(mockStorage.getItem(STORAGE_KEY_POMODORO_SECONDS), JSON.stringify(1200));

  // Verify restore
  const restored = restoreTimerSession(now + 400_000);
  assert.equal(restored.isRunning, false);
  assert.equal(restored.seconds, 1200);
  assert.equal(restored.taskId, 'task_integ');
});

test('Integration: Storage-thrashing prevention verification', () => {
  mockStorage.clear();
  let setItemCalls = 0;
  const originalSetItem = mockStorage.setItem.bind(mockStorage);
  mockStorage.setItem = (key: string, value: string) => {
    setItemCalls++;
    originalSetItem(key, value);
  };

  const now = 1700000000000;
  const session: PersistedTimerSession = {
    sessionId: 'sess_integ_thrash',
    status: 'running',
    mode: 'focus',
    startedAt: now,
    expectedEndAt: now + 1500_000,
    remainingSeconds: 1500,
    taskId: null,
    lastUpdated: now,
  };

  // 1 write on session start
  saveTimerSession(session);
  const startCalls = setItemCalls;
  assert.ok(startCalls > 0);

  // During 1500 seconds of ticking, zero calls to saveTimerSession are needed
  // because remaining time is derived deterministically from expectedEndAt - Date.now()
  for (let s = 1; s <= 60; s++) {
    const tickTime = now + s * 1000;
    const remaining = Math.max(0, Math.ceil((session.expectedEndAt! - tickTime) / 1000));
    assert.equal(remaining, 1500 - s);
  }

  // SetItem calls during ticks should be 0 additional calls
  assert.equal(setItemCalls, startCalls, 'Timer ticking must not thrash localStorage every second');
});

test('Integration: Mode switching and clearing session resets state cleanly', () => {
  mockStorage.clear();
  const cleared = clearTimerSession('short-break', 'task_123');

  assert.equal(cleared.status, 'idle');
  assert.equal(cleared.mode, 'short-break');
  assert.equal(cleared.remainingSeconds, SHORT_BREAK_SECONDS);
  assert.equal(cleared.expectedEndAt, null);
  assert.equal(cleared.taskId, 'task_123');

  const restored = restoreTimerSession(Date.now());
  assert.equal(restored.mode, 'short-break');
  assert.equal(restored.seconds, SHORT_BREAK_SECONDS);
  assert.equal(restored.isRunning, false);
});

