import { useState, useRef, useEffect } from 'react';
import { Task, Priority } from '../types';
import { MoreVertical, Trash2, CheckCircle } from 'lucide-react';
import DraggableTaskList from './DraggableTaskList';
import AddTaskForm from './AddTaskForm';
import CompletedTasksSection from './CompletedTasksSection';

function TaskMenu({ onClearAll, onClearCompleted }: { onClearAll: () => void, onClearCompleted: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="task-menu" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="task-menu-btn"
        aria-label="Task options"
      >
        <MoreVertical size={20} />
      </button>
      
      {isOpen && (
        <div className="task-menu-dropdown">
          <button 
            onClick={() => { onClearCompleted(); setIsOpen(false); }}
            className="task-menu-item"
          >
            <CheckCircle size={16} className="icon" />
            Delete finished tasks
          </button>
          <button 
            onClick={() => { onClearAll(); setIsOpen(false); }}
            className="task-menu-item danger"
          >
            <Trash2 size={16} className="icon" />
            Clear all tasks
          </button>
        </div>
      )}
    </div>
  );
}

interface TaskManagementProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  onTaskCompleted: (task: Task) => void;
  onSelectTask: (id: string) => void;
  onClearActiveTask: () => void;
  onContribution?: () => void;
}

export default function TaskManagement({ tasks, setTasks, activeTaskId, setActiveTaskId, onTaskCompleted, onSelectTask, onClearActiveTask, onContribution }: TaskManagementProps) {

  const getNextQueueOrder = () => {
    const active = tasks.filter(t => !t.completed);
    if (active.length === 0) return 0;
    return Math.max(...active.map(t => t.queueOrder)) + 1;
  };

  const addTask = (title: string, priority: Priority, estimatedPomodoros: number) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      priority,
      estimatedPomodoros,
      completedPomodoros: 0,
      completed: false,
      status: 'idle',
      queueOrder: getNextQueueOrder(),
      createdAt: now,
      updatedAt: now,
    };
    setTasks(prev => [...prev, newTask]);
  };

  const toggleTaskCompleted = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const isCompleting = !task.completed;
    const now = new Date().toISOString();

    setTasks(tasks.map(t => t.id === id ? {
      ...t,
      completed: isCompleting,
      status: isCompleting ? 'completed' : 'idle',
      completedAt: isCompleting ? now : undefined,
      updatedAt: now,
      remainingSeconds: isCompleting ? undefined : t.remainingSeconds,
    } : t));
    
    if (isCompleting && onContribution) {
      onContribution();
    }

    if (isCompleting && activeTaskId === id) {
      onTaskCompleted(task);
    } else if (activeTaskId === id) {
      setActiveTaskId(null);
    }
  };

  const editTask = (id: string, updates: Partial<Task>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));
  };

  const deleteTask = (id: string) => {
    if (activeTaskId === id) onClearActiveTask();
    setTasks(tasks.filter(t => t.id !== id));
  };

  const clearAllTasks = () => {
    if (activeTaskId) onClearActiveTask();
    setTasks([]);
  };

  const clearCompletedTasks = () => {
    setTasks(tasks.filter(t => !t.completed));
  };

  const handleReorder = (reordered: Task[]) => {
    // Merge reordered active tasks back into the full task array
    const reorderedIds = new Set(reordered.map(t => t.id));
    const rest = tasks.filter(t => !reorderedIds.has(t.id));
    setTasks([...reordered, ...rest]);
  };

  const activeTasks = tasks
    .filter(t => !t.completed)
    .sort((a, b) => a.queueOrder - b.queueOrder);

  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="task-management">
      <div className="task-header">
        <div className="task-header-top">
          <h2 className="task-header-title">Tasks</h2>
          <TaskMenu onClearAll={clearAllTasks} onClearCompleted={clearCompletedTasks} />
        </div>
        <AddTaskForm onAdd={addTask} />
      </div>

      {activeTasks.length > 0 ? (
        <div className="task-section">
          <h3 className="task-section-title">Active Tasks</h3>
          <DraggableTaskList
            tasks={activeTasks}
            onToggle={toggleTaskCompleted}
            onEdit={editTask}
            onDelete={deleteTask}
            activeTaskId={activeTaskId}
            onSelectTask={onSelectTask}
            onReorder={handleReorder}
            draggable
          />
        </div>
      ) : (
        completedTasks.length === 0 && (
          <div className="task-empty-state">
            <div className="task-empty-icon">🍅</div>
            <p className="task-empty-title">No tasks yet</p>
            <p className="task-empty-sub">Add a task above to get started</p>
          </div>
        )
      )}

      <CompletedTasksSection tasks={completedTasks} onToggle={toggleTaskCompleted} onEdit={editTask} onDelete={deleteTask} />
    </div>
  );
}
