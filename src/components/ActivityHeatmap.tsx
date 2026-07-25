import { useState, useLayoutEffect, useRef, useMemo } from 'react';

interface ActivityHeatmapProps {
  data: Record<string, number>;
}

const CELL_SIZE = 14;
const CELL_GAP = 4;
const COLUMN_WIDTH = CELL_SIZE + CELL_GAP; // 18px per week column

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Measure container width responsively with ResizeObserver
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    setContainerWidth(el.clientWidth);

    return () => observer.disconnect();
  }, []);

  // Calculate visible weeks count dynamically based on measured width
  const visibleWeeksCount = useMemo(() => {
    if (containerWidth <= 0) return 20; // Default fallback
    // Calculate how many 18px columns fit cleanly
    const count = Math.floor((containerWidth + CELL_GAP) / COLUMN_WIDTH);
    return Math.max(4, count);
  }, [containerWidth]);

  // Generate only the visible week columns backwards from today
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();

    // End current week on Saturday so column aligns cleanly
    const endOfCurrentWeek = new Date(today);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    endOfCurrentWeek.setDate(today.getDate() + (6 - dayOfWeek));

    // Calculate start date: (visibleWeeksCount * 7 - 1) days back
    const startDate = new Date(endOfCurrentWeek);
    startDate.setDate(endOfCurrentWeek.getDate() - (visibleWeeksCount * 7 - 1));

    const weeks: { date: string; count: number }[][] = [];
    let currentWeek: { date: string; count: number }[] = [];

    for (let d = new Date(startDate); d <= endOfCurrentWeek; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      const count = data[dateStr] || 0;

      currentWeek.push({ date: dateStr, count });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Generate month labels after week columns are built
    const monthLabels: { month: string; index: number }[] = [];
    let lastMonthName = '';

    weeks.forEach((week, index) => {
      const firstDayStr = week[0]?.date;
      if (!firstDayStr) return;
      const [yr, mo, dy] = firstDayStr.split('-').map(Number);
      const dateObj = new Date(yr, mo - 1, dy);
      const monthName = dateObj.toLocaleString('default', { month: 'short' });

      if (monthName !== lastMonthName) {
        monthLabels.push({ month: monthName, index });
        lastMonthName = monthName;
      }
    });

    return { weeks, monthLabels };
  }, [data, visibleWeeksCount]);

  const getColorLevel = (count: number) => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 8) return 3;
    return 4;
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayStr();

  const formatDateToolTip = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const monthStr = dt.toLocaleString('default', { month: 'short' });
    return `${d} ${monthStr}`;
  };

  return (
    <div className="activity-heatmap">
      <div className="heatmap-header">
        <h3>Focus Activity</h3>
      </div>
      <div className="heatmap-container" ref={containerRef}>
        <div
          className="heatmap-months"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, ${CELL_SIZE}px)` }}
        >
          {monthLabels.map((m, i) => (
            <span key={i} style={{ gridColumn: m.index + 1 }}>
              {m.month}
            </span>
          ))}
        </div>
        <div className="heatmap-grid">
          {weeks.map((week, i) => (
            <div key={i} className="heatmap-week">
              {week.map((day) => {
                const isToday = day.date === todayStr;
                const focusMin = day.count * 25;
                const dateFormatted = formatDateToolTip(day.date);
                const pomodoroText = `${day.count} Pomodoro${day.count === 1 ? '' : 's'}`;
                const tooltipText = `${dateFormatted}\n${focusMin} min focus\n${pomodoroText}`;

                return (
                  <div
                    key={day.date}
                    className={`heatmap-day level-${getColorLevel(day.count)}${isToday ? ' today' : ''}`}
                    data-tooltip={tooltipText}
                    aria-label={`${dateFormatted}: ${day.count} pomodoro${day.count === 1 ? '' : 's'}, ${focusMin}min focus`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-day level-0" />
        <div className="heatmap-day level-1" />
        <div className="heatmap-day level-2" />
        <div className="heatmap-day level-3" />
        <div className="heatmap-day level-4" />
        <span>More</span>
      </div>
    </div>
  );
}
