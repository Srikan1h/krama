import { Task } from '../types';

interface TaskCompletionModalProps {
  task: Task;
  nextTask: Task | undefined;
  onContinue: () => void;
  onBreak: () => void;
}

export default function TaskCompletionModal({ task, nextTask, onContinue, onBreak }: TaskCompletionModalProps) {
  return (
    <div className="completion-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <div className="completion-prompt">
        <div className="completion-emoji">🎉</div>
        <h3 id="completion-title">Task Completed!</h3>
        <p>You finished <strong>{task.title}</strong>.</p>
        <div className="completion-prompt-actions">
          {nextTask ? (
            <button
              id="btn-continue-next"
              className="primary"
              onClick={onContinue}
            >
              Continue with Next Task
            </button>
          ) : (
            <button
              id="btn-all-done"
              className="primary"
              onClick={onContinue}
            >
              All done — back to Tasks
            </button>
          )}
          <button
            id="btn-short-break"
            className="secondary"
            onClick={onBreak}
          >
            Take a Short Break
          </button>
        </div>
      </div>
    </div>
  );
}
