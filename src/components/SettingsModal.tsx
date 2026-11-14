import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { PomodoroSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PomodoroSettings;
  onSave: (newSettings: PomodoroSettings) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: SettingsModalProps) {
  const [focusDuration, setFocusDuration] = useState(settings.focusDuration);
  const [shortBreakDuration, setShortBreakDuration] = useState(settings.shortBreakDuration);
  const [longBreakDuration, setLongBreakDuration] = useState(settings.longBreakDuration);
  const [longBreakInterval, setLongBreakInterval] = useState(settings.longBreakInterval);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever modal is opened with fresh settings
  useEffect(() => {
    if (isOpen) {
      setFocusDuration(settings.focusDuration);
      setShortBreakDuration(settings.shortBreakDuration);
      setLongBreakDuration(settings.longBreakDuration);
      setLongBreakInterval(settings.longBreakInterval);
      setError(null);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!focusDuration || focusDuration < 1 || focusDuration > 120) {
      setError('Focus duration must be between 1 and 120 minutes.');
      return;
    }
    if (!shortBreakDuration || shortBreakDuration < 1 || shortBreakDuration > 60) {
      setError('Short break duration must be between 1 and 60 minutes.');
      return;
    }
    if (!longBreakDuration || longBreakDuration < 1 || longBreakDuration > 90) {
      setError('Long break duration must be between 1 and 90 minutes.');
      return;
    }
    if (!longBreakInterval || longBreakInterval < 1 || longBreakInterval > 24) {
      setError('Long break interval must be between 1 and 24 sessions.');
      return;
    }

    setError(null);
    onSave({
      focusDuration,
      shortBreakDuration,
      longBreakDuration,
      longBreakInterval,
    });
    onClose();
  };

  return (
    <div
      className="settings-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="settings-modal">
        <header className="settings-modal-header">
          <h2 id="settings-dialog-title" className="settings-modal-title">
            Settings
          </h2>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
            title="Close"
          >
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="settings-form">
          <section className="settings-section">
            <h3 className="settings-section-heading">Pomodoro Preferences</h3>

            <div className="settings-field">
              <label htmlFor="setting-focus-duration" className="settings-label">
                Focus duration
              </label>
              <div className="settings-input-group">
                <input
                  id="setting-focus-duration"
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  value={focusDuration}
                  onChange={(e) => setFocusDuration(parseInt(e.target.value, 10) || 0)}
                  className="settings-input"
                  required
                />
                <span className="settings-unit">min</span>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="setting-short-break" className="settings-label">
                Short break
              </label>
              <div className="settings-input-group">
                <input
                  id="setting-short-break"
                  type="number"
                  min={1}
                  max={60}
                  step={1}
                  value={shortBreakDuration}
                  onChange={(e) => setShortBreakDuration(parseInt(e.target.value, 10) || 0)}
                  className="settings-input"
                  required
                />
                <span className="settings-unit">min</span>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="setting-long-break" className="settings-label">
                Long break
              </label>
              <div className="settings-input-group">
                <input
                  id="setting-long-break"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={longBreakDuration}
                  onChange={(e) => setLongBreakDuration(parseInt(e.target.value, 10) || 0)}
                  className="settings-input"
                  required
                />
                <span className="settings-unit">min</span>
              </div>
            </div>

            <div className="settings-field">
              <label htmlFor="setting-interval" className="settings-label">
                Long break interval
              </label>
              <div className="settings-input-group">
                <input
                  id="setting-interval"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  value={longBreakInterval}
                  onChange={(e) => setLongBreakInterval(parseInt(e.target.value, 10) || 0)}
                  className="settings-input"
                  required
                />
                <span className="settings-unit">sessions</span>
              </div>
            </div>
          </section>

          {error && (
            <div className="settings-error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="settings-modal-actions">
            <button
              type="button"
              className="settings-button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="settings-button primary"
            >
              <Check size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

