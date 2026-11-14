import { PersistedTimerSession, PomodoroMode, PomodoroSettings, SessionStatus } from './types';

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
};

export const FOCUS_SECONDS = DEFAULT_SETTINGS.focusDuration * 60;
export const SHORT_BREAK_SECONDS = DEFAULT_SETTINGS.shortBreakDuration * 60;
export const LONG_BREAK_SECONDS = DEFAULT_SETTINGS.longBreakDuration * 60;

export const STORAGE_KEY_SETTINGS = 'kanth_settings';
export const STORAGE_KEY_TIMER_SESSION = 'kanth_timer_session';
export const STORAGE_KEY_COMPLETED_SESSIONS = 'kanth_completed_session_ids';
export const STORAGE_KEY_POMODORO_MODE = 'kanth_pomodoro_mode';
export const STORAGE_KEY_POMODORO_SECONDS = 'kanth_pomodoro_seconds';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage: Storage }).localStorage) {
      return (globalThis as unknown as { localStorage: Storage }).localStorage;
    }
  } catch {
    /* ignore storage access error */
  }
  return null;
}

export function isValidSettings(data: unknown): data is PomodoroSettings {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Partial<PomodoroSettings>;
  if (typeof obj.focusDuration !== 'number' || isNaN(obj.focusDuration) || obj.focusDuration < 1 || obj.focusDuration > 120) return false;
  if (typeof obj.shortBreakDuration !== 'number' || isNaN(obj.shortBreakDuration) || obj.shortBreakDuration < 1 || obj.shortBreakDuration > 60) return false;
  if (typeof obj.longBreakDuration !== 'number' || isNaN(obj.longBreakDuration) || obj.longBreakDuration < 1 || obj.longBreakDuration > 90) return false;
  if (typeof obj.longBreakInterval !== 'number' || isNaN(obj.longBreakInterval) || obj.longBreakInterval < 1 || obj.longBreakInterval > 24) return false;
  return true;
}

export function loadSettings(): PomodoroSettings {
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidSettings(parsed)) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: PomodoroSettings): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

export function getModeDuration(mode: PomodoroMode, settings?: PomodoroSettings): number {
  const s = settings || DEFAULT_SETTINGS;
  switch (mode) {
    case 'focus':
      return s.focusDuration * 60;
    case 'short-break':
      return s.shortBreakDuration * 60;
    case 'long-break':
      return s.longBreakDuration * 60;
  }
}

export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getCompletedSessionIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY_COMPLETED_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isSessionCompleted(sessionId: string): boolean {
  if (!sessionId) return false;
  return getCompletedSessionIds().includes(sessionId);
}

export function markSessionCompleted(sessionId: string): boolean {
  if (!sessionId) return false;
  const storage = getStorage();
  if (!storage) return false;

  const completed = getCompletedSessionIds();
  if (completed.includes(sessionId)) {
    return false; // Already completed — prevent duplicate completion
  }

  completed.push(sessionId);
  // Keep the list bounded to last 100 sessions
  if (completed.length > 100) {
    completed.splice(0, completed.length - 100);
  }

  try {
    storage.setItem(STORAGE_KEY_COMPLETED_SESSIONS, JSON.stringify(completed));
    return true;
  } catch {
    return false;
  }
}

export function isValidTimerSession(data: unknown): data is PersistedTimerSession {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Partial<PersistedTimerSession>;

  if (typeof obj.sessionId !== 'string' || !obj.sessionId) return false;
  if (obj.status !== 'idle' && obj.status !== 'running' && obj.status !== 'paused') return false;
  if (obj.mode !== 'focus' && obj.mode !== 'short-break' && obj.mode !== 'long-break') return false;
  if (typeof obj.remainingSeconds !== 'number' || isNaN(obj.remainingSeconds) || obj.remainingSeconds < 0) return false;
  if (obj.startedAt !== null && (typeof obj.startedAt !== 'number' || isNaN(obj.startedAt))) return false;
  if (obj.expectedEndAt !== null && (typeof obj.expectedEndAt !== 'number' || isNaN(obj.expectedEndAt))) return false;
  if (obj.taskId !== null && typeof obj.taskId !== 'string') return false;
  if (typeof obj.lastUpdated !== 'number' || isNaN(obj.lastUpdated)) return false;

  return true;
}

export function saveTimerSession(session: PersistedTimerSession): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    session.lastUpdated = Date.now();
    storage.setItem(STORAGE_KEY_TIMER_SESSION, JSON.stringify(session));

    // Synchronize legacy keys for backward-compatibility with existing components/storage
    storage.setItem(STORAGE_KEY_POMODORO_MODE, JSON.stringify(session.mode));
    if (session.status !== 'running') {
      storage.setItem(STORAGE_KEY_POMODORO_SECONDS, JSON.stringify(session.remainingSeconds));
    }
  } catch {
    /* ignore storage quota errors */
  }
}

export function clearTimerSession(
  mode: PomodoroMode = 'focus',
  taskId: string | null = null,
  settings?: PomodoroSettings
): PersistedTimerSession {
  const duration = getModeDuration(mode, settings);
  const idleSession: PersistedTimerSession = {
    sessionId: generateSessionId(),
    status: 'idle',
    mode,
    startedAt: null,
    expectedEndAt: null,
    remainingSeconds: duration,
    taskId,
    lastUpdated: Date.now(),
  };

  saveTimerSession(idleSession);
  return idleSession;
}

export interface RestoredTimerResult {
  session: PersistedTimerSession;
  expiredWhileAway: boolean;
  expiredSessionId: string | null;
  mode: PomodoroMode;
  seconds: number;
  isRunning: boolean;
  taskId: string | null;
}

export function restoreTimerSession(now = Date.now()): RestoredTimerResult {
  const storage = getStorage();
  let session: PersistedTimerSession | null = null;

  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY_TIMER_SESSION);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidTimerSession(parsed)) {
          session = parsed;
        }
      }
    } catch {
      session = null;
    }
  }

  // Fallback to legacy keys if no valid session found in localStorage
  if (!session) {
    let legacyMode: PomodoroMode = 'focus';
    let legacySeconds = FOCUS_SECONDS;
    let legacyTaskId: string | null = null;

    if (storage) {
      try {
        const savedMode = storage.getItem(STORAGE_KEY_POMODORO_MODE);
        if (savedMode) {
          const m = JSON.parse(savedMode);
          if (m === 'focus' || m === 'short-break' || m === 'long-break') legacyMode = m;
        }
      } catch {
        /* ignore */
      }

      try {
        const savedSecs = storage.getItem(STORAGE_KEY_POMODORO_SECONDS);
        if (savedSecs) {
          const s = JSON.parse(savedSecs);
          if (typeof s === 'number' && !isNaN(s) && s > 0) legacySeconds = s;
        }
      } catch {
        /* ignore */
      }

      try {
        const savedTaskId = storage.getItem('kanth_active_task_id');
        if (savedTaskId) {
          legacyTaskId = JSON.parse(savedTaskId);
        }
      } catch {
        /* ignore */
      }
    }

    session = {
      sessionId: generateSessionId(),
      status: 'idle',
      mode: legacyMode,
      startedAt: null,
      expectedEndAt: null,
      remainingSeconds: legacySeconds,
      taskId: legacyTaskId,
      lastUpdated: now,
    };
    saveTimerSession(session);
  }

  // Handle paused session
  if (session.status === 'paused') {
    return {
      session,
      expiredWhileAway: false,
      expiredSessionId: null,
      mode: session.mode,
      seconds: session.remainingSeconds,
      isRunning: false,
      taskId: session.taskId,
    };
  }

  // Handle running session
  if (session.status === 'running') {
    if (session.expectedEndAt === null || typeof session.expectedEndAt !== 'number') {
      // Degraded session with missing deadline: convert to paused
      session.status = 'paused';
      saveTimerSession(session);
      return {
        session,
        expiredWhileAway: false,
        expiredSessionId: null,
        mode: session.mode,
        seconds: session.remainingSeconds,
        isRunning: false,
        taskId: session.taskId,
      };
    }

    const remaining = Math.ceil((session.expectedEndAt - now) / 1000);

    if (remaining > 0) {
      // Session is still active!
      session.remainingSeconds = remaining;
      return {
        session,
        expiredWhileAway: false,
        expiredSessionId: null,
        mode: session.mode,
        seconds: remaining,
        isRunning: true,
        taskId: session.taskId,
      };
    } else {
      // Session deadline passed while away
      const expiredId = session.sessionId;
      const alreadyCompleted = isSessionCompleted(expiredId);

      return {
        session,
        expiredWhileAway: !alreadyCompleted,
        expiredSessionId: expiredId,
        mode: session.mode,
        seconds: 0,
        isRunning: false,
        taskId: session.taskId,
      };
    }
  }

  // Handle idle session
  return {
    session,
    expiredWhileAway: false,
    expiredSessionId: null,
    mode: session.mode,
    seconds: session.remainingSeconds || getModeDuration(session.mode),
    isRunning: false,
    taskId: session.taskId,
  };
}

