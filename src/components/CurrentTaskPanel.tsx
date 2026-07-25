import { Task } from '../types';

interface CurrentTaskPanelProps {
  task: Task | undefined;
}

export default function CurrentTaskPanel({ task }: CurrentTaskPanelProps) {
  if (!task) {
    return (
      <div className="current-task-panel empty">
        <p className="current-task-panel-empty">No task selected — go to Tasks to pick one</p>
      </div>
    );
  }

  const isEstimateReached = task.completedPomodoros >= task.estimatedPomodoros;

  return (
    <div className="current-task-panel">
      <span className="current-task-panel-label">Current Task</span>
      <div className="current-task-panel-title">{task.title}</div>
      <div className="current-task-panel-meta">
        <span>🍅 {task.completedPomodoros} / {task.estimatedPomodoros}</span>
        <span className={`task-priority-badge ${task.priority}`}>{task.priority}</span>
        {isEstimateReached && (
          <span className="suggested-completion">✓ Estimate reached</span>
        )}
      </div>
    </div>
  );
}
