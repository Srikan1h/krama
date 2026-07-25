export type Priority = "high" | "medium" | "low";
export type TaskStatus = "idle" | "active" | "completed";

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
