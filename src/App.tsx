import { useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { Moon, Pause, Play, RefreshCcw, SkipForward, Sun } from 'lucide-react'
import TaskManagement from './components/TaskManagement'
import BottomNav from './components/BottomNav'
import CurrentTaskPanel from './components/CurrentTaskPanel'
import TaskCompletionModal from './components/TaskCompletionModal'
import SwitchTaskDialog from './components/SwitchTaskDialog'
import StreaksScreen from './components/StreaksScreen'
import { Task, PomodoroMode, PersistedTimerSession } from './types'
import {
  FOCUS_SECONDS,
  SHORT_BREAK_SECONDS,
  LONG_BREAK_SECONDS,
  restoreTimerSession,
  saveTimerSession,
  clearTimerSession,
  markSessionCompleted,
  generateSessionId,
  getModeDuration,
} from './timerPersistence'

type Tab = 'tasks' | 'pomodoro' | 'streaks'

// ─── TimeDisplay ────────────────────────────────────────────────────────────
interface TimeDisplayProps {
  totalMs: number
  isPomodoro?: boolean
}

function TimeDisplay({ totalMs, isPomodoro }: TimeDisplayProps) {
  const totalSeconds = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const hStr = String(hours).padStart(2, '0')
  const mStr = String(minutes).padStart(2, '0')
  const sStr = String(seconds).padStart(2, '0')

  return (
    <div className="time-display">
      {!isPomodoro && (
        <>
          <div className="time-part"><span className="val">{hStr}</span></div>
          <span className="sep">:</span>
        </>
      )}
      <div className="time-part">
        <span className="val">{isPomodoro && hours > 0 ? hStr : mStr}</span>
      </div>
      <span className="sep">:</span>
      <div className="time-part">
        <span className="val">{isPomodoro && hours > 0 ? mStr : sStr}</span>
      </div>
    </div>
  )
}

// ─── ControlButton ───────────────────────────────────────────────────────────
interface ControlButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  label: string
  icon: ReactNode
}

function ControlButton({ children, label, icon, ...props }: ControlButtonProps) {
  return (
    <button className="control-button" aria-label={label} title={label} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  // ── Persistence helpers ──
  const loadState = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) return JSON.parse(saved) as T
    } catch { /* ignore */ }
    return fallback
  }

  // ── Initial restored timer state ──
  const [restoredTimer] = useState(() => restoreTimerSession())

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<Tab>(() => loadState<Tab>('kanth_tab', 'tasks'))
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadState<'dark' | 'light'>('kanth_theme', 'dark'))

  // ── Pomodoro state ──
  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>(restoredTimer.mode)
  const [pomodoroSeconds, setPomodoroSeconds] = useState<number>(restoredTimer.seconds)
  const [pomodoroRunning, setPomodoroRunning] = useState<boolean>(restoredTimer.isRunning)
  const [focusSessionsCompleted, setFocusSessionsCompleted] = useState<number>(() =>
    loadState<number>('kanth_focus_sessions', 0))
  const sessionsRef = useRef(focusSessionsCompleted)
  const modeRef = useRef<PomodoroMode>(pomodoroMode)
  const audioContextRef = useRef<AudioContext | null>(null)
  const persistedSessionRef = useRef<PersistedTimerSession>(restoredTimer.session)
  const startupProcessedRef = useRef(false)

  // ── Task state ──
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = loadState<Task[]>('kanth_tasks', [])
    // Migrate old tasks that lack new fields
    return saved.map((t, i) => ({
      status: t.status ?? (t.completed ? 'completed' : 'idle'),
      queueOrder: t.queueOrder ?? i,
      createdAt: t.createdAt ?? new Date().toISOString(),
      updatedAt: t.updatedAt ?? new Date().toISOString(),
      completed: t.completed ?? (t.status === 'completed'),
      ...t,
    }))
  })
  const [activeTaskId, setActiveTaskId] = useState<string | null>(() => {
    if (restoredTimer.taskId) return restoredTimer.taskId
    return loadState<string | null>('kanth_active_task_id', null)
  })
  const activeTaskIdRef = useRef(activeTaskId)

  // ── Dialogs ──
  const [completionModalTask, setCompletionModalTask] = useState<Task | null>(null)
  const [switchDialogTarget, setSwitchDialogTarget] = useState<Task | null>(null)

  // ── Activity / streaks ──
  const [activityData, setActivityData] = useState<Record<string, number>>(() =>
    loadState<Record<string, number>>('kanth_activity', {}))

  // ── Derived ──
  const activeTask = useMemo(() => tasks.find(t => t.id === activeTaskId), [tasks, activeTaskId])
  const pomodoroLabel = pomodoroMode === 'focus' ? 'Focus' : pomodoroMode === 'short-break' ? 'Short Break' : 'Long Break'
  const pomodoroTotal = getModeDuration(pomodoroMode)
  const pomodoroProgress = 1 - pomodoroSeconds / pomodoroTotal

  // ─────────────────────────────────────────────────────────────────────────
  // Persistence effects
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('kanth_tasks', JSON.stringify(tasks)) }, [tasks])
  useEffect(() => { localStorage.setItem('kanth_activity', JSON.stringify(activityData)) }, [activityData])
  useEffect(() => { localStorage.setItem('kanth_active_task_id', JSON.stringify(activeTaskId)) }, [activeTaskId])
  useEffect(() => { localStorage.setItem('kanth_tab', JSON.stringify(activeTab)) }, [activeTab])
  useEffect(() => { localStorage.setItem('kanth_theme', JSON.stringify(theme)) }, [theme])
  useEffect(() => { localStorage.setItem('kanth_focus_sessions', JSON.stringify(focusSessionsCompleted)) }, [focusSessionsCompleted])

  // ─────────────────────────────────────────────────────────────────────────
  // Ref sync
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { modeRef.current = pomodoroMode }, [pomodoroMode])
  useEffect(() => { activeTaskIdRef.current = activeTaskId }, [activeTaskId])

  // ─────────────────────────────────────────────────────────────────────────
  // Theme / title
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  useEffect(() => {
    const formatPomo = (secs: number) => {
      const m = Math.floor(secs / 60)
      const s = secs % 60
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    document.title = pomodoroRunning
      ? `${formatPomo(pomodoroSeconds)} | ${pomodoroLabel}`
      : `Krama`
  }, [pomodoroRunning, pomodoroSeconds, pomodoroLabel])

  // ─────────────────────────────────────────────────────────────────────────
  // Audio
  // ─────────────────────────────────────────────────────────────────────────
  const unlockAudio = () => {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    if (!audioContextRef.current) audioContextRef.current = new AudioCtx()
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume()
    return audioContextRef.current
  }

  const playBell = () => {
    const context = unlockAudio()
    if (!context) return
    const now = context.currentTime
    ;[0, 0.28, 0.56].forEach((delay) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, now + delay)
      oscillator.frequency.exponentialRampToValueAtTime(660, now + delay + 0.22)
      gain.gain.setValueAtTime(0.001, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.28, now + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.42)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + 0.45)
    })
  }

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Activity recording
  // ─────────────────────────────────────────────────────────────────────────
  const recordContribution = () => {
    const d = new Date()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setActivityData(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session completion handler
  // ─────────────────────────────────────────────────────────────────────────
  const completeSession = ({
    mode,
    taskId,
    isStartupCatchup = false,
  }: {
    mode: PomodoroMode
    taskId: string | null
    isStartupCatchup?: boolean
  }) => {
    if (!isStartupCatchup) {
      playBell()
    }

    let nextMode: PomodoroMode = 'focus'

    if (mode === 'focus') {
      recordContribution()
      if (taskId) {
        setTasks(prev => prev.map(t => {
          if (t.id !== taskId) return t
          const next = { ...t, completedPomodoros: t.completedPomodoros + 1, remainingSeconds: undefined }
          // Show completion modal when estimate is reached
          if (next.completedPomodoros >= next.estimatedPomodoros) {
            setTimeout(() => {
              setCompletionModalTask(next)
            }, 300)
          }
          return next
        }))
      }

      const completed = sessionsRef.current + 1
      setFocusSessionsCompleted(completed)
      sessionsRef.current = completed
      nextMode = completed % 4 === 0 ? 'long-break' : 'short-break'
    } else {
      nextMode = 'focus'
    }

    const nextDuration = getModeDuration(nextMode)
    const newSession = clearTimerSession(nextMode, taskId)
    persistedSessionRef.current = newSession

    modeRef.current = nextMode
    setPomodoroMode(nextMode)
    setPomodoroSeconds(nextDuration)
    setPomodoroRunning(false)
  }

  // Handle session that expired while away on startup exactly once
  useEffect(() => {
    if (startupProcessedRef.current) return
    startupProcessedRef.current = true

    if (restoredTimer.expiredWhileAway && restoredTimer.expiredSessionId) {
      if (markSessionCompleted(restoredTimer.expiredSessionId)) {
        completeSession({
          mode: restoredTimer.mode,
          taskId: restoredTimer.taskId,
          isStartupCatchup: true,
        })
      }
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Queue helpers
  // ─────────────────────────────────────────────────────────────────────────
  const getNextTask = (currentTasks: Task[]): Task | undefined => {
    return currentTasks
      .filter(t => !t.completed && t.id !== activeTaskIdRef.current)
      .sort((a, b) => a.queueOrder - b.queueOrder)[0]
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task selection (does NOT auto-start timer)
  // ─────────────────────────────────────────────────────────────────────────
  const loadTask = (id: string | null) => {
    // Save remaining seconds on the current task before switching
    if (pomodoroMode === 'focus' && activeTaskIdRef.current && activeTaskIdRef.current !== id) {
      setTasks(prev => prev.map(t =>
        t.id === activeTaskIdRef.current ? { ...t, remainingSeconds: pomodoroSeconds } : t
      ))
    }

    if (!id) {
      setActiveTaskId(null)
      setPomodoroRunning(false)
      const idleSession = clearTimerSession(pomodoroMode, null)
      persistedSessionRef.current = idleSession
      return
    }

    const newTask = tasks.find(t => t.id === id)
    if (!newTask) return

    const seconds = newTask.remainingSeconds !== undefined ? newTask.remainingSeconds : FOCUS_SECONDS

    setActiveTaskId(id)
    setPomodoroMode('focus')
    modeRef.current = 'focus'
    setPomodoroSeconds(seconds)
    setPomodoroRunning(false)

    const session: PersistedTimerSession = {
      sessionId: generateSessionId(),
      status: 'idle',
      mode: 'focus',
      startedAt: null,
      expectedEndAt: null,
      remainingSeconds: seconds,
      taskId: id,
      lastUpdated: Date.now(),
    }
    saveTimerSession(session)
    persistedSessionRef.current = session
  }

  /**
   * Called when a task card is tapped. If a focus timer is running, show
   * the "Switch task?" dialog first. Otherwise load immediately and navigate.
   */
  const handleTaskSelect = (id: string) => {
    unlockAudio()

    if (pomodoroRunning && pomodoroMode === 'focus' && activeTaskIdRef.current !== id) {
      const target = tasks.find(t => t.id === id)
      if (target) {
        setSwitchDialogTarget(target)
        return
      }
    }

    loadTask(id)
    setActiveTab('pomodoro')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pomodoro timer tick (absolute wall-clock timestamps)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pomodoroRunning) return

    const tick = () => {
      const currentSession = persistedSessionRef.current
      if (!currentSession || currentSession.status !== 'running' || !currentSession.expectedEndAt) {
        return
      }

      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((currentSession.expectedEndAt - now) / 1000))

      setPomodoroSeconds(remaining)

      if (remaining <= 0) {
        const sessId = currentSession.sessionId
        if (sessId && markSessionCompleted(sessId)) {
          completeSession({
            mode: modeRef.current,
            taskId: activeTaskIdRef.current,
          })
        }
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 250)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        tick()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [pomodoroRunning])

  // ─────────────────────────────────────────────────────────────────────────
  // Pomodoro controls
  // ─────────────────────────────────────────────────────────────────────────
  const switchPomodoroMode = (nextMode: PomodoroMode) => {
    unlockAudio()
    const duration = getModeDuration(nextMode)
    const newSession = clearTimerSession(nextMode, activeTaskId)
    persistedSessionRef.current = newSession

    setPomodoroMode(nextMode)
    modeRef.current = nextMode
    setPomodoroSeconds(duration)
    setPomodoroRunning(false)
  }

  const restartPomodoro = () => {
    unlockAudio()
    const duration = getModeDuration(pomodoroMode)
    const newSession = clearTimerSession(pomodoroMode, activeTaskId)
    persistedSessionRef.current = newSession

    setPomodoroSeconds(duration)
    setPomodoroRunning(false)
  }

  const skipPomodoro = () => {
    unlockAudio()
    const currentSess = persistedSessionRef.current
    if (currentSess?.sessionId) {
      markSessionCompleted(currentSess.sessionId)
    }

    if (pomodoroMode === 'focus') {
      recordContribution()
      if (activeTaskIdRef.current) {
        setTasks(prev => prev.map(t =>
          t.id === activeTaskIdRef.current ? { ...t, completedPomodoros: t.completedPomodoros + 1, remainingSeconds: undefined } : t
        ))
      }
      const completed = focusSessionsCompleted + 1
      setFocusSessionsCompleted(completed)
      sessionsRef.current = completed
      const nextMode = completed % 4 === 0 ? 'long-break' : 'short-break'
      const nextDuration = getModeDuration(nextMode)
      const newSession = clearTimerSession(nextMode, activeTaskIdRef.current)
      persistedSessionRef.current = newSession

      setPomodoroMode(nextMode)
      modeRef.current = nextMode
      setPomodoroSeconds(nextDuration)
      setPomodoroRunning(false)
    } else {
      // Skip break → go back to focus
      const nextId = activeTaskIdRef.current
      const nextDuration = getModeDuration('focus')
      const newSession = clearTimerSession('focus', nextId)
      persistedSessionRef.current = newSession

      setPomodoroMode('focus')
      modeRef.current = 'focus'
      if (nextId) {
        loadTask(nextId)
      } else {
        setPomodoroSeconds(nextDuration)
        setPomodoroRunning(false)
      }
    }
  }

  const togglePomodoro = () => {
    unlockAudio()

    if (!pomodoroRunning) {
      let targetTaskId = activeTaskId
      if (pomodoroMode === 'focus' && !activeTaskId) {
        const next = tasks.filter(t => !t.completed).sort((a, b) => a.queueOrder - b.queueOrder)[0]
        if (next) {
          targetTaskId = next.id
          loadTask(next.id)
        }
      }

      const now = Date.now()
      const expectedEndAt = now + pomodoroSeconds * 1000
      const sessId = persistedSessionRef.current?.sessionId || generateSessionId()

      const runningSession: PersistedTimerSession = {
        sessionId: sessId,
        status: 'running',
        mode: pomodoroMode,
        startedAt: persistedSessionRef.current?.startedAt || now,
        expectedEndAt,
        remainingSeconds: pomodoroSeconds,
        taskId: targetTaskId,
        lastUpdated: now,
      }

      saveTimerSession(runningSession)
      persistedSessionRef.current = runningSession
      setPomodoroRunning(true)
    } else {
      const now = Date.now()
      let remaining = pomodoroSeconds
      if (persistedSessionRef.current?.expectedEndAt) {
        remaining = Math.max(0, Math.ceil((persistedSessionRef.current.expectedEndAt - now) / 1000))
      }

      const pausedSession: PersistedTimerSession = {
        sessionId: persistedSessionRef.current?.sessionId || generateSessionId(),
        status: 'paused',
        mode: pomodoroMode,
        startedAt: persistedSessionRef.current?.startedAt || null,
        expectedEndAt: null,
        remainingSeconds: remaining,
        taskId: activeTaskId,
        lastUpdated: now,
      }

      saveTimerSession(pausedSession)
      persistedSessionRef.current = pausedSession
      setPomodoroSeconds(remaining)
      setPomodoroRunning(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Task completion (from manual checkbox in TaskManagement)
  // ─────────────────────────────────────────────────────────────────────────
  const handleTaskCompleted = (task: Task) => {
    setPomodoroRunning(false)
    setCompletionModalTask(task)
    setActiveTaskId(null)
    const session = clearTimerSession(pomodoroMode, null)
    persistedSessionRef.current = session
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Completion modal actions
  // ─────────────────────────────────────────────────────────────────────────
  const handleCompletionContinue = () => {
    setCompletionModalTask(null)
    const next = getNextTask(tasks)
    if (next) {
      loadTask(next.id)
      setActiveTab('pomodoro')
    } else {
      // No tasks left — return to Tasks tab
      setActiveTaskId(null)
      setActiveTab('tasks')
    }
  }

  const handleCompletionBreak = () => {
    setCompletionModalTask(null)
    switchPomodoroMode('short-break')
    const now = Date.now()
    const duration = getModeDuration('short-break')
    const runningSession: PersistedTimerSession = {
      sessionId: generateSessionId(),
      status: 'running',
      mode: 'short-break',
      startedAt: now,
      expectedEndAt: now + duration * 1000,
      remainingSeconds: duration,
      taskId: null,
      lastUpdated: now,
    }
    saveTimerSession(runningSession)
    persistedSessionRef.current = runningSession
    setPomodoroSeconds(duration)
    setPomodoroRunning(true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Switch dialog actions
  // ─────────────────────────────────────────────────────────────────────────
  const handleSwitchConfirm = () => {
    if (!switchDialogTarget) return
    const id = switchDialogTarget.id
    setSwitchDialogTarget(null)
    loadTask(id)
    setActiveTab('pomodoro')
  }

  const handleSwitchCancel = () => {
    setSwitchDialogTarget(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── App Bar ─────────────────────────────────────────────────── */}
      <header className="app-bar">
        <div className="app-bar-brand">
          <span className="app-bar-title">Krama</span>
        </div>
        <button
          className="theme-button"
          type="button"
          aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <main className="tab-content" aria-live="polite">

        {/* Tasks Tab */}
        <div className={`tab-panel${activeTab === 'tasks' ? ' visible' : ''}`} aria-hidden={activeTab !== 'tasks'}>
          <TaskManagement
            tasks={tasks}
            setTasks={setTasks}
            activeTaskId={activeTaskId}
            setActiveTaskId={setActiveTaskId}
            onSelectTask={handleTaskSelect}
            onClearActiveTask={() => loadTask(null)}
            onContribution={recordContribution}
            onTaskCompleted={handleTaskCompleted}
          />
        </div>

        {/* Pomodoro Tab */}
        <div className={`tab-panel${activeTab === 'pomodoro' ? ' visible' : ''}`} aria-hidden={activeTab !== 'pomodoro'}>
          <div className="pomodoro-tab-content">
            <div className="pomodoro-card">
              {/* Completion modal */}
              {completionModalTask && activeTab === 'pomodoro' && (
                <TaskCompletionModal
                  task={completionModalTask}
                  nextTask={getNextTask(tasks)}
                  onContinue={handleCompletionContinue}
                  onBreak={handleCompletionBreak}
                />
              )}

              {/* Switch dialog */}
              {switchDialogTarget && activeTab === 'pomodoro' && (
                <SwitchTaskDialog
                  targetTask={switchDialogTarget}
                  onSwitch={handleSwitchConfirm}
                  onContinueCurrent={handleSwitchCancel}
                />
              )}

              {/* Phase tabs */}
              <div className="phase-tabs" aria-label="Pomodoro phase">
                {(['focus', 'short-break', 'long-break'] as PomodoroMode[]).map(mode => (
                  <button
                    key={mode}
                    className={pomodoroMode === mode ? 'active' : ''}
                    type="button"
                    onClick={() => switchPomodoroMode(mode)}
                  >
                    {mode === 'focus' ? 'Focus' : mode === 'short-break' ? 'Short Break' : 'Long Break'}
                  </button>
                ))}
              </div>

              {/* Timer */}
              <div className="pomodoro-time">
                <TimeDisplay totalMs={pomodoroSeconds * 1000} isPomodoro />
              </div>

              {/* Progress line */}
              <div className="progress-line" aria-hidden="true" style={{ '--progress': `${pomodoroProgress * 100}%` } as React.CSSProperties} />

              {/* Cycle dots */}
              <div className="cycle-indicator" aria-label={`Cycle: ${pomodoroMode === 'long-break' ? 4 : (focusSessionsCompleted % 4)} of 4`}>
                {[1, 2, 3, 4].map(step => {
                  const pos = focusSessionsCompleted % 4
                  const isCompleted = pomodoroMode === 'long-break' || pos >= step
                  const isActive = pomodoroMode === 'focus' && pos + 1 === step
                  return (
                    <div key={step} className={`cycle-dot${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`} />
                  )
                })}
              </div>

              {/* Controls */}
              <div className="pomodoro-controls">
                <ControlButton label={pomodoroRunning ? 'Pause' : 'Start'} icon={pomodoroRunning ? <Pause size={18} /> : <Play size={18} />} onClick={togglePomodoro}>
                  {pomodoroRunning ? 'Pause' : 'Start'}
                </ControlButton>
                <ControlButton label="Skip" icon={<SkipForward size={18} />} onClick={skipPomodoro}>
                  Skip
                </ControlButton>
                <ControlButton label="Reset" icon={<RefreshCcw size={18} />} onClick={restartPomodoro}>
                  Reset
                </ControlButton>
              </div>
            </div>

            {/* Current task panel below timer */}
            <CurrentTaskPanel task={activeTask} />
          </div>
        </div>

        {/* Streaks Tab */}
        <div className={`tab-panel${activeTab === 'streaks' ? ' visible' : ''}`} aria-hidden={activeTab !== 'streaks'}>
          <StreaksScreen activityData={activityData} tasks={tasks} />
        </div>
      </main>

      {/* Dialogs that appear from Tasks tab */}
      {switchDialogTarget && activeTab === 'tasks' && (
        <SwitchTaskDialog
          targetTask={switchDialogTarget}
          onSwitch={handleSwitchConfirm}
          onContinueCurrent={handleSwitchCancel}
        />
      )}
      {completionModalTask && activeTab === 'tasks' && (
        <TaskCompletionModal
          task={completionModalTask}
          nextTask={getNextTask(tasks)}
          onContinue={handleCompletionContinue}
          onBreak={handleCompletionBreak}
        />
      )}

      {/* ── Bottom Nav ──────────────────────────────────────────────── */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App
