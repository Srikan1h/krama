import { ListTodo, Timer, BarChart2 } from 'lucide-react';

type Tab = 'tasks' | 'pomodoro' | 'streaks';

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof ListTodo }[] = [
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
  { id: 'streaks', label: 'Streaks', icon: BarChart2 },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          id={`nav-${id}`}
          className={`bottom-nav-item${activeTab === id ? ' active' : ''}`}
          onClick={() => onTabChange(id)}
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
          type="button"
        >
          <Icon size={20} strokeWidth={activeTab === id ? 2.5 : 1.75} />
          <span className="bottom-nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
