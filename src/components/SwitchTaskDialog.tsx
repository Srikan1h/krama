import { Task } from '../types';

interface SwitchTaskDialogProps {
  targetTask: Task;
  onContinueCurrent: () => void;
  onSwitch: () => void;
}

export default function SwitchTaskDialog({ targetTask, onContinueCurrent, onSwitch }: SwitchTaskDialogProps) {
  return (
    <div className="completion-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="switch-dialog-title">
      <div className="completion-prompt">
        <h3 id="switch-dialog-title">Timer is Running</h3>
        <p>
          A focus session is active. Switch to{' '}
          <strong>{targetTask.title}</strong>?
        </p>
        <div className="completion-prompt-actions">
          <button
            id="btn-switch-task"
            className="primary"
            onClick={onSwitch}
          >
            Switch to this task
          </button>
          <button
            id="btn-keep-current"
            className="secondary"
            onClick={onContinueCurrent}
          >
            Continue current session
          </button>
        </div>
      </div>
    </div>
  );
}
