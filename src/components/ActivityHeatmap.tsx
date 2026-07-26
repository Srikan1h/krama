import { useState, useLayoutEffect, useRef, useMemo } from 'react';

interface ActivityHeatmapProps {
  data: Record<string, number>;
}

interface TooltipInfo {
  dateFormatted: string;
  focusMin: number;
  count: number;
  top: number;
  left?: number;
  right?: number;
  transform?: string;
  positionBelow: boolean;
}

const CELL_SIZE = 14;
const CELL_GAP = 4;
const COLUMN_WIDTH = CELL_SIZE + CELL_GAP; // 18px per week column

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

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

  const formatDateToolTip = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const monthStr = dt.toLocaleString('default', { month: 'short' });
    return `${d} ${monthStr}`;
  };

  const handleCellHover = (
    e: React.MouseEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>,
    day: { date: string; count: number }
  ) => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const cardRect = cardEl.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();

    const relTop = cellRect.top - cardRect.top;
    const relLeft = cellRect.left - cardRect.left;
    const relRight = cardRect.right - cellRect.right;

    // Flip below if cell is near top edge (top row cells)
    const positionBelow = relTop < 60;
    const top = positionBelow ? relTop + cellRect.height + 6 : relTop - 6;

    let left: number | undefined;
    let right: number | undefined;
    let transform: string | undefined;

    if (relLeft < 60) {
      left = Math.max(12, relLeft);
    } else if (relRight < 60) {
      right = Math.max(12, relRight);
    } else {
      left = relLeft + cellRect.width / 2;
      transform = 'translateX(-50%)';
    }

    setTooltip({
      dateFormatted: formatDateToolTip(day.date),
      focusMin: day.count * 25,
      count: day.count,
      top,
      left,
      right,
      transform,
      positionBelow,
    });
  };

  const handleCellLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="activity-heatmap" ref={cardRef}>
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
                const focusMin = day.count * 25;
                const dateFormatted = formatDateToolTip(day.date);

                return (
                  <div
                    key={day.date}
                    tabIndex={0}
                    className={`heatmap-day level-${getColorLevel(day.count)}`}
                    onMouseEnter={(e) => handleCellHover(e, day)}
                    onMouseLeave={handleCellLeave}
                    onFocus={(e) => handleCellHover(e, day)}
                    onBlur={handleCellLeave}
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

      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{
            top: tooltip.top,
            left: tooltip.left !== undefined ? tooltip.left : 'auto',
            right: tooltip.right !== undefined ? tooltip.right : 'auto',
            transform: tooltip.transform
              ? `${tooltip.transform} ${tooltip.positionBelow ? '' : 'translateY(-100%)'}`.trim()
              : tooltip.positionBelow
              ? 'none'
              : 'translateY(-100%)',
          }}
        >
          <div className="heatmap-tooltip-date">{tooltip.dateFormatted}</div>
          <div className="heatmap-tooltip-min">{tooltip.focusMin} min focus</div>
          <div className="heatmap-tooltip-count">
            {tooltip.count} Pomodoro{tooltip.count === 1 ? '' : 's'}
          </div>
        </div>
      )}
    </div>
  );
}
