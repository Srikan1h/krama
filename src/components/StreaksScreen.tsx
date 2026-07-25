import { useMemo } from 'react';
import ActivityHeatmap from './ActivityHeatmap';
import { Task } from '../types';

interface StreaksScreenProps {
  activityData: Record<string, number>;
  tasks: Task[];
}

function getDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreaks(data: Record<string, number>) {
  let currentStreak = 0;
  let longestStreak = 0;
  let run = 0;
  let inCurrentRun = true;

  const cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const count = data[getDateStr(cursor)] || 0;
    if (count > 0) {
      run++;
      if (inCurrentRun) currentStreak = run;
      longestStreak = Math.max(longestStreak, run);
    } else {
      // Allow missing today (streak may continue from yesterday)
      if (i === 0) {
        /* skip today if no activity yet */
      } else {
        inCurrentRun = false;
        run = 0;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return { currentStreak, longestStreak };
}

function sumFocusMinutes(data: Record<string, number>, days: number): number {
  const today = new Date();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    total += (data[getDateStr(d)] || 0) * 25;
  }
  return total;
}

function getActiveDays(data: Record<string, number>): number {
  return Object.values(data).filter(n => n > 0).length;
}

function getMonthSummary(data: Record<string, number>) {
  const months: Record<string, number> = {};
  for (const [date, count] of Object.entries(data)) {
    const key = date.slice(0, 7);
    months[key] = (months[key] || 0) + count;
  }
  return Object.entries(months)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([key, count]) => {
      const [year, month] = key.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        pomodoros: count,
        minutes: count * 25,
      };
    });
}

function fmt(mins: number): string {
  if (mins === 0) return '0m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function StreaksScreen({ activityData, tasks }: StreaksScreenProps) {
  const { currentStreak, longestStreak } = useMemo(() => computeStreaks(activityData), [activityData]);
  const todayMinutes   = useMemo(() => sumFocusMinutes(activityData, 1),  [activityData]);
  const weeklyMinutes  = useMemo(() => sumFocusMinutes(activityData, 7),  [activityData]);
  const monthlyMinutes = useMemo(() => sumFocusMinutes(activityData, 30), [activityData]);
  const totalPomodoros = useMemo(() => Object.values(activityData).reduce((s, n) => s + n, 0), [activityData]);
  const activeDays     = useMemo(() => getActiveDays(activityData), [activityData]);
  const completedCount = useMemo(() => tasks.filter(t => t.completed).length, [tasks]);
  const monthSummary   = useMemo(() => getMonthSummary(activityData), [activityData]);

  const stats = [
    { label: 'Today',           value: fmt(todayMinutes) },
    { label: 'This week',       value: fmt(weeklyMinutes) },
    { label: 'This month',      value: fmt(monthlyMinutes) },
    { label: 'Total pomodoros', value: String(totalPomodoros) },
    { label: 'Tasks completed', value: String(completedCount) },
  ];

  return (
    <div className="streaks-screen">

      {/* 1. Today hero */}
      <section className="streaks-hero" aria-label="Today's focus">
        <div className="streaks-hero-value">{fmt(todayMinutes)}</div>
        <div className="streaks-hero-label">Today's focus</div>
      </section>

      {/* 2. Activity overview — inline row, no cards */}
      <section className="streaks-overview" aria-label="Activity overview">
        <div className="streaks-overview-item">
          <span className="streaks-overview-value">{activeDays}</span>
          <span className="streaks-overview-label">Active days</span>
        </div>
        <div className="streaks-overview-divider" aria-hidden="true" />
        <div className="streaks-overview-item">
          <span className="streaks-overview-value">{currentStreak}</span>
          <span className="streaks-overview-label">Current streak</span>
        </div>
        <div className="streaks-overview-divider" aria-hidden="true" />
        <div className="streaks-overview-item">
          <span className="streaks-overview-value">{longestStreak}</span>
          <span className="streaks-overview-label">Longest streak</span>
        </div>
      </section>

      {/* 3. Heatmap — hero visual */}
      <section className="streaks-heatmap-section" aria-label="Focus activity heatmap">
        <ActivityHeatmap data={activityData} />
      </section>

      {/* 4. Stats — compact vertical list */}
      <section className="streaks-stat-list" aria-label="Focus statistics">
        <h2 className="streaks-list-heading">Statistics</h2>
        {stats.map(({ label, value }) => (
          <div key={label} className="streaks-stat-row">
            <span className="streaks-stat-label">{label}</span>
            <span className="streaks-stat-value">{value}</span>
          </div>
        ))}
      </section>

      {/* 5. Monthly history */}
      {monthSummary.length > 0 && (
        <section className="streaks-stat-list" aria-label="Monthly history">
          <h2 className="streaks-list-heading">Monthly history</h2>
          {monthSummary.map(({ month, pomodoros, minutes }) => (
            <div key={month} className="streaks-stat-row">
              <span className="streaks-stat-label">{month}</span>
              <span className="streaks-stat-value streaks-stat-value--secondary">
                {pomodoros} 🍅 · {fmt(minutes)}
              </span>
            </div>
          ))}
        </section>
      )}

    </div>
  );
}
