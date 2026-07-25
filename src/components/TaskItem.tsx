import { useState } from 'react';
import { Task } from '../types';
import { Edit2, Trash2, Check, X, ChevronUp, ChevronDown, Info } from 'lucide-react';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  isActive?: boolean;
  onSelect?: (id: string) => void;
  queuePosition?: number;
}

export default function TaskItem({ task, onToggle, onEdit, onDelete, isActive, onSelect, queuePosition }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPomodoros, setEditPomodoros] = useState(task.estimatedPomodoros);

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onEdit(task.id, {
      title: editTitle.trim(),
      estimatedPomodoros: Math.max(task.completedPomodoros, editPomodoros),
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditPomodoros(task.estimatedPomodoros);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="task-item editing">
        <div className="task-edit-inputs">
          <input 
            type="text" 
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="task-edit-title-input"
            autoFocus
          />
          <div className="task-edit-pomodoros">
            <div className="pomodoro-tooltip-wrapper">
              <Info size={14} className="pomodoro-info-icon" />
              <div className="pomodoro-tooltip">
                Estimated Pomodoros: Number of 25-minute focus sessions needed for this task.
              </div>
            </div>
            <span>🍅 Est.</span>
            <input 
              type="number" 
              min={Math.max(1, task.completedPomodoros)}
              max="10" 
              value={editPomodoros} 
              onChange={(e) => setEditPomodoros(parseInt(e.target.value) || 1)}
            />
            <div className="pomodoro-spin-controls">
              <button type="button" onClick={() => setEditPomodoros(Math.min(10, editPomodoros + 1))} className="pomodoro-spin-btn" aria-label="Increase pomodoros"><ChevronUp size={12} strokeWidth={3} /></button>
              <button type="button" onClick={() => setEditPomodoros(Math.max(Math.max(1, task.completedPomodoros), editPomodoros - 1))} className="pomodoro-spin-btn" aria-label="Decrease pomodoros"><ChevronDown size={12} strokeWidth={3} /></button>
            </div>
          </div>
        </div>
        <div className="task-edit-buttons">
          <button onClick={handleSave} className="task-edit-btn save" title="Save">
            <Check size={16} strokeWidth={2.5} />
          </button>
          <button onClick={handleCancel} className="task-edit-btn cancel" title="Cancel">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`task-item ${task.completed ? 'completed' : ''} ${isActive ? 'active-focus' : ''}`}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('input')) {
          onSelect?.(task.id);
        }
      }}
      style={{ cursor: onSelect && !task.completed ? 'pointer' : 'default' }}
    >
      <button 
        onClick={() => onToggle(task.id)}
        className="task-item-checkbox"
      >
        {task.completed && (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      
      <div className="task-item-content">
        <div className="task-item-title-row">
          <span className="task-item-title">
            {task.title}
          </span>
          {isActive && (
            <span className="task-current-indicator">Current Task</span>
          )}
        </div>
        
        <div className="task-item-footer">
          <span className="emoji">🍅</span>
          <span className="count">{task.completedPomodoros}/{task.estimatedPomodoros}</span>
          <div className="task-pomodoro-dots">
            {Array.from({ length: task.estimatedPomodoros }).map((_, i) => (
              <span key={i} className={`pomodoro-dot ${i < task.completedPomodoros ? task.priority : 'empty'}`}>
                {i < task.completedPomodoros ? '●' : '○'}
              </span>
            ))}
          </div>
          {queuePosition !== undefined && !task.completed && (
            <span className="task-queue-position">#{queuePosition}</span>
          )}
        </div>
      </div>

      <div className="task-item-right">
        <span className={`task-priority-badge ${task.priority}`}>
          {task.priority}
        </span>
        <div className="task-item-actions">
          <button onClick={() => setIsEditing(true)} className="task-item-action-btn" title="Edit task">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(task.id)} className="task-item-action-btn danger" title="Delete task">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
