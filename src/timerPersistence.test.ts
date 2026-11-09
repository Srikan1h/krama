import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOCUS_SECONDS,
  SHORT_BREAK_SECONDS,
  LONG_BREAK_SECONDS,
  STORAGE_KEY_TIMER_SESSION,
  STORAGE_KEY_COMPLETED_SESSIONS,
  generateSessionId,
  isValidTimerSession,
  saveTimerSession,
  clearTimerSession,
  restoreTimerSession,
  markSessionCompleted,
  isSessionCompleted,
  getCompletedSessionIds,
} from './timerPersistence';
import { PersistedTimerSession } from './types';

// Mock localStorage for test execution
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

// Set up global storage before running tests
const mockStorage = new LocalStorageMock();
(globalThis as unknown as { localStorage: Storage }).localStorage = mockStorage;

test('P0.2 Verification: 1. Refresh during an active focus session', () => {
  mockStorage.clear();
  const now = 1700000000000;
  const startedAt = now - 50_000; // started 50s ago
  const expectedEndAt = now + 1450_000; // 1450s remaining

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_1',
    status: 'running',
    mode: 'focus',
    startedAt,
    expectedEndAt,
    remainingSeconds: 1450,
    taskId: 'task_abc',
    lastUpdated: startedAt,
  };

  saveTimerSession(session);

  // Simulate refresh at timestamp `now`
  const restored = restoreTimerSession(now);

  assert.equal(restored.isRunning, true, 'Timer should still be running');
  assert.equal(restored.seconds, 1450, 'Remaining seconds should match recalculation from absolute timestamp');
  assert.equal(restored.mode, 'focus', 'Mode should be focus');
  assert.equal(restored.taskId, 'task_abc', 'Task ID should be preserved');
  assert.equal(restored.expiredWhileAway, false, 'Session should not be expired');
  assert.notEqual(restored.seconds, FOCUS_SECONDS, 'Should never restart original duration');
});

test('P0.2 Verification: 2. Close and reopen the browser during an active session', () => {
  mockStorage.clear();
  const startTime = 1700000000000;
  const expectedEndAt = startTime + 1000_000; // 1000s session

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_2',
    status: 'running',
    mode: 'focus',
    startedAt: startTime,
    expectedEndAt,
    remainingSeconds: 1000,
    taskId: 'task_def',
    lastUpdated: startTime,
  };

  saveTimerSession(session);

  // User closed browser for 300 seconds and reopens at startTime + 300_000
  const reopenTime = startTime + 300_000;
  const restored = restoreTimerSession(reopenTime);

  assert.equal(restored.isRunning, true, 'Timer should still be running');
  assert.equal(restored.seconds, 700, 'Timer should advance 300 seconds using absolute timestamps');
  assert.equal(restored.expiredWhileAway, false);
});

test('P0.2 Verification: 3. Refresh during a paused session', () => {
  mockStorage.clear();
  const now = 1700000000000;

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_3',
    status: 'paused',
    mode: 'focus',
    startedAt: now - 300_000,
    expectedEndAt: null,
    remainingSeconds: 842,
    taskId: 'task_xyz',
    lastUpdated: now,
  };

  saveTimerSession(session);

  // Simulate refresh 10 minutes later while paused
  const refreshTime = now + 600_000;
  const restored = restoreTimerSession(refreshTime);

  assert.equal(restored.isRunning, false, 'Timer should remain paused');
  assert.equal(restored.seconds, 842, 'Paused duration should remain exact');
  assert.equal(restored.taskId, 'task_xyz');
  assert.equal(restored.expiredWhileAway, false);
});

test('P0.2 Verification: 4. Resume a restored paused session', () => {
  mockStorage.clear();
  const now = 1700000000000;

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_4',
    status: 'paused',
    mode: 'focus',
    startedAt: null,
    expectedEndAt: null,
    remainingSeconds: 500,
    taskId: 'task_1',
    lastUpdated: now,
  };

  saveTimerSession(session);
  const restored = restoreTimerSession(now);

  // User clicks resume at `resumeTime`
  const resumeTime = now + 10_000;
  const runningSession: PersistedTimerSession = {
    ...restored.session,
    status: 'running',
    startedAt: resumeTime,
    expectedEndAt: resumeTime + restored.seconds * 1000,
    remainingSeconds: restored.seconds,
    lastUpdated: resumeTime,
  };
  saveTimerSession(runningSession);

  // Verify ticking 50 seconds later
  const tickTime = resumeTime + 50_000;
  const tickRestore = restoreTimerSession(tickTime);

  assert.equal(tickRestore.isRunning, true);
  assert.equal(tickRestore.seconds, 450);
});

test('P0.2 Verification: 5. Reopen after the session deadline has passed', () => {
  mockStorage.clear();
  const startTime = 1700000000000;
  const expectedEndAt = startTime + 1500_000; // 25 min

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_5',
    status: 'running',
    mode: 'focus',
    startedAt: startTime,
    expectedEndAt,
    remainingSeconds: 1500,
    taskId: 'task_completed_target',
    lastUpdated: startTime,
  };

  saveTimerSession(session);

  // Reopen 1 minute AFTER deadline passed
  const reopenTime = expectedEndAt + 60_000;
  const restored = restoreTimerSession(reopenTime);

  assert.equal(restored.isRunning, false, 'Timer should not be running after deadline');
  assert.equal(restored.expiredWhileAway, true, 'Should detect that session expired while away');
  assert.equal(restored.expiredSessionId, 'sess_test_5');

  // Process completion exactly once
  const marked = markSessionCompleted(restored.expiredSessionId!);
  assert.equal(marked, true, 'First completion should succeed');

  // Verify second completion attempt is rejected
  const markedAgain = markSessionCompleted(restored.expiredSessionId!);
  assert.equal(markedAgain, false, 'Second completion attempt should be rejected');
});

test('P0.2 Verification: 6. Refresh repeatedly around session completion', () => {
  mockStorage.clear();
  const startTime = 1700000000000;
  const expectedEndAt = startTime + 1500_000;

  const session: PersistedTimerSession = {
    sessionId: 'sess_test_6',
    status: 'running',
    mode: 'focus',
    startedAt: startTime,
    expectedEndAt,
    remainingSeconds: 1500,
    taskId: null,
    lastUpdated: startTime,
  };
  saveTimerSession(session);

  const afterDeadline = expectedEndAt + 5_000;

  // First refresh after deadline
  const r1 = restoreTimerSession(afterDeadline);
  assert.equal(r1.expiredWhileAway, true);
  markSessionCompleted(r1.expiredSessionId!);

  // Second refresh 1 second later
  const r2 = restoreTimerSession(afterDeadline + 1_000);
  assert.equal(r2.expiredWhileAway, false, 'Second refresh must NOT flag as newly expired');

  // Third refresh 5 seconds later
  const r3 = restoreTimerSession(afterDeadline + 5_000);
  assert.equal(r3.expiredWhileAway, false, 'Third refresh must NOT flag as newly expired');
});

test('P0.2 Verification: 7. Reset an active session and refresh', () => {
  mockStorage.clear();
  const now = 1700000000000;

  const runningSession: PersistedTimerSession = {
    sessionId: 'sess_test_7',
    status: 'running',
    mode: 'focus',
    startedAt: now,
    expectedEndAt: now + 1500_000,
    remainingSeconds: 1500,
    taskId: null,
    lastUpdated: now,
  };
  saveTimerSession(runningSession);

  // User resets session
  const resetSession = clearTimerSession('focus', null);
  assert.equal(resetSession.status, 'idle');
  assert.equal(resetSession.expectedEndAt, null);
  assert.equal(resetSession.remainingSeconds, FOCUS_SECONDS);

  // Refresh immediately
  const restored = restoreTimerSession(now + 10_000);
  assert.equal(restored.isRunning, false);
  assert.equal(restored.seconds, FOCUS_SECONDS);
  assert.equal(restored.expiredWhileAway, false);
});

test('P0.2 Verification: 8. Verify no duplicate session completion or statistics entries', () => {
  mockStorage.clear();
  const sessId = 'sess_unique_test_8';

  assert.equal(isSessionCompleted(sessId), false);
  assert.equal(markSessionCompleted(sessId), true);
  assert.equal(isSessionCompleted(sessId), true);

  // 10 concurrent / redundant calls
  for (let i = 0; i < 10; i++) {
    assert.equal(markSessionCompleted(sessId), false, 'Duplicate completion must be prevented');
  }

  const completedList = getCompletedSessionIds();
  const occurrences = completedList.filter((id) => id === sessId).length;
  assert.equal(occurrences, 1, 'Session ID must only appear once in completion registry');
});

test('P0.2 Verification: 9. Test malformed persisted state handling', () => {
  const malformedInputs = [
    'invalid json string',
    '{"status": "not_a_real_status"}',
    '{"status": "running", "expectedEndAt": "not a number"}',
    '{"sessionId": "", "status": "idle"}',
    '{"remainingSeconds": -50}',
    'null',
    '12345',
  ];

  for (const input of malformedInputs) {
    mockStorage.clear();
    mockStorage.setItem(STORAGE_KEY_TIMER_SESSION, input);

    // Should not throw and should safely return fallback idle session
    const restored = restoreTimerSession(Date.now());
    assert.ok(restored, 'Must return restored result');
    assert.equal(restored.isRunning, false, 'Malformed state must fallback to paused/idle');
    assert.equal(restored.mode, 'focus', 'Fallback mode should be focus');
    assert.equal(restored.seconds, FOCUS_SECONDS, 'Fallback seconds should be 1500');
    assert.equal(restored.expiredWhileAway, false);
  }
});

test('P0.2 Verification: 10. Test React StrictMode idempotency', () => {
  mockStorage.clear();
  const now = 1700000000000;
  const expiredEndAt = now - 10_000;

  saveTimerSession({
    sessionId: 'sess_strict_mode',
    status: 'running',
    mode: 'focus',
    startedAt: now - 1510_000,
    expectedEndAt: expiredEndAt,
    remainingSeconds: 1500,
    taskId: 'task_strict',
    lastUpdated: now - 1510_000,
  });

  // StrictMode mount 1
  const mount1 = restoreTimerSession(now);
  let completionsProcessed = 0;

  if (mount1.expiredWhileAway && mount1.expiredSessionId) {
    if (markSessionCompleted(mount1.expiredSessionId)) {
      completionsProcessed++;
    }
  }

  // StrictMode mount 2 (immediately re-running with same state/timestamps)
  const mount2 = restoreTimerSession(now);
  if (mount2.expiredWhileAway && mount2.expiredSessionId) {
    if (markSessionCompleted(mount2.expiredSessionId)) {
      completionsProcessed++;
    }
  }

  assert.equal(completionsProcessed, 1, 'StrictMode must process completion exactly once');
});

