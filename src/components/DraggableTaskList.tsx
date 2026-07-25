import { Task } from '../types';
import TaskItem from './TaskItem';
import { useRef, useState } from 'react';

interface Props {
  tasks: Task[];
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  activeTaskId?: string | null;
  onSelectTask?: (id: string) => void;
  onReorder?: (reordered: Task[]) => void;
  draggable?: boolean;
}

export default function DraggableTaskList({
  tasks,
  onToggle,
  onEdit,
  onDelete,
  activeTaskId,
  onSelectTask,
  onReorder,
  draggable = false,
}: Props) {
  const dragSourceIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragSourceIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Small delay so the dragged element renders properly
    setTimeout(() => {
      (e.target as HTMLElement).classList.add('dragging');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
    dragSourceIndex.current = null;
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceIndex.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const sourceIndex = dragSourceIndex.current;
    if (sourceIndex === null || sourceIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const reordered = [...tasks];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    // Reassign queueOrder based on new positions
    const withNewOrder = reordered.map((t, i) => ({
      ...t,
      queueOrder: i,
      updatedAt: new Date().toISOString(),
    }));

    onReorder?.(withNewOrder);
    setDragOverIndex(null);
  };

  return (
    <div className="task-list">
      {tasks.map((task, index) => (
        <div
          key={task.id}
          className={`task-list-item-wrapper${dragOverIndex === index ? ' drag-over' : ''}`}
          draggable={draggable}
          onDragStart={draggable ? (e) => handleDragStart(e, index) : undefined}
          onDragEnd={draggable ? handleDragEnd : undefined}
          onDragOver={draggable ? (e) => handleDragOver(e, index) : undefined}
          onDragLeave={draggable ? handleDragLeave : undefined}
          onDrop={draggable ? (e) => handleDrop(e, index) : undefined}
        >
          {draggable && (
            <div className="drag-handle" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.5" />
                <circle cx="11" cy="4" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="11" cy="12" r="1.5" />
              </svg>
            </div>
          )}
          <TaskItem
            task={task}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            isActive={activeTaskId === task.id}
            onSelect={onSelectTask}
            queuePosition={draggable ? index + 1 : undefined}
          />
        </div>
      ))}
    </div>
  );
}
