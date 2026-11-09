export type Priority = "high" | "medium" | "low";
export type TaskStatus = "idle" | "active" | "completed";
export type PomodoroMode = 'focus' | 'short-break' | 'long-break';
export type SessionStatus = 'idle' | 'running' | 'paused';

export interface PersistedTimerSession {
  sessionId: string;
  status: SessionStatus;
  mode: PomodoroMode;
  startedAt: number | null;
  expectedEndAt: number | null;
  remainingSeconds: number;
  taskId: string | null;
  lastUpdated: number;
}

export type Task = {
  id: string;
  title: string;
  priority: Priority;
  estimatedPomodoros: number;
  completedPomodoros: number;
  status: TaskStatus;
  queueOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  remainingSeconds?: number;
  // Backward-compat helper — derived from status
  completed: boolean;
};
