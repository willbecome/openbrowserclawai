// ---------------------------------------------------------------------------
// OpenBrowserClaw — Tasks page
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { Plus, X, Calendar, Clock, Trash2 } from 'lucide-react';
import { getAllTasks, saveTask, deleteTask } from '../../db.js';
import { DEFAULT_GROUP_ID } from '../../config.js';
import type { Task } from '../../types.js';
import { ulid } from '../../ulid.js';

// ---------------------------------------------------------------------------
// Cron helpers
// ---------------------------------------------------------------------------

const DAYS_OF_WEEK = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const DAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type ScheduleFrequency = 'every-minute' | 'every-5-min' | 'every-15-min' | 'every-30-min' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom';

interface SchedulePreset {
  label: string;
  value: ScheduleFrequency;
  description: string;
}

const PRESETS: SchedulePreset[] = [
  { label: 'Mỗi phút', value: 'every-minute', description: 'Chạy mỗi phút' },
  { label: 'Mỗi 5 phút', value: 'every-5-min', description: 'Chạy mỗi 5 phút' },
  { label: 'Mỗi 15 phút', value: 'every-15-min', description: 'Chạy mỗi 15 phút' },
  { label: 'Mỗi 30 phút', value: 'every-30-min', description: 'Chạy mỗi 30 phút' },
  { label: 'Mỗi giờ', value: 'hourly', description: 'Chạy vào đầu mỗi giờ' },
  { label: 'Mỗi ngày', value: 'daily', description: 'Chạy một lần mỗi ngày' },
  { label: 'Chỉ ngày trong tuần', value: 'weekdays', description: 'Thứ 2 – Thứ 6' },
  { label: 'Mỗi tuần', value: 'weekly', description: 'Chạy một lần mỗi tuần' },
  { label: 'Mỗi tháng', value: 'monthly', description: 'Chạy một lần mỗi tháng' },
  { label: 'Tùy chỉnh (cron)', value: 'custom', description: 'Nhập biểu thức cron' },
];

function buildCron(freq: ScheduleFrequency, hour: number, minute: number, dayOfWeek: number, dayOfMonth: number): string {
  switch (freq) {
    case 'every-minute': return '* * * * *';
    case 'every-5-min': return '*/5 * * * *';
    case 'every-15-min': return '*/15 * * * *';
    case 'every-30-min': return '*/30 * * * *';
    case 'hourly': return `${minute} * * * *`;
    case 'daily': return `${minute} ${hour} * * *`;
    case 'weekdays': return `${minute} ${hour} * * 1-5`;
    case 'weekly': return `${minute} ${hour} * * ${dayOfWeek}`;
    case 'monthly': return `${minute} ${hour} ${dayOfMonth} * *`;
    case 'custom': return '* * * * *';
  }
}

function cronToHuman(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;
  const [min, hour, dom, , dow] = parts;

  if (cron === '* * * * *') return 'Mỗi phút';
  if (min.startsWith('*/') && hour === '*' && dom === '*' && dow === '*') {
    return `Mỗi ${min.slice(2)} phút`;
  }
  if (hour === '*' && dom === '*' && dow === '*' && !min.includes('*') && !min.includes('/')) {
    const m = parseInt(min, 10);
    return m === 0 ? 'Mỗi giờ' : `Mỗi giờ tại phút :${String(m).padStart(2, '0')}`;
  }
  if (!hour.includes('*') && !min.includes('*') && !hour.includes('/') && !min.includes('/')) {
    const h = parseInt(hour, 10);
    const m = parseInt(min, 10);
    const ts = formatTime12(h, m);
    if (dom === '*' && dow === '*') return `Mỗi ngày lúc ${ts}`;
    if (dom === '*' && dow === '1-5') return `Ngày trong tuần lúc ${ts}`;
    if (dom === '*' && dow !== '*') {
      const d = parseInt(dow, 10);
      if (!isNaN(d) && d >= 0 && d <= 6) return `Mỗi ${DAYS_OF_WEEK[d]} lúc ${ts}`;
      const names = dow.split(',').map((x) => {
        const n = parseInt(x.trim(), 10);
        return !isNaN(n) && n >= 0 && n <= 6 ? DAYS_SHORT[n] : x;
      });
      return `Mỗi ${names.join(', ')} lúc ${ts}`;
    }
    if (dow === '*' && dom !== '*') {
      const d = parseInt(dom, 10);
      if (!isNaN(d)) return `Ngày ${d} hàng tháng lúc ${ts}`;
    }
  }
  return cron;
}

function formatTime12(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function needsTimePicker(freq: ScheduleFrequency): boolean {
  return ['daily', 'weekdays', 'weekly', 'monthly'].includes(freq);
}

function needsDayOfWeek(freq: ScheduleFrequency): boolean {
  return freq === 'weekly';
}

function needsDayOfMonth(freq: ScheduleFrequency): boolean {
  return freq === 'monthly';
}

function needsMinutePicker(freq: ScheduleFrequency): boolean {
  return freq === 'hourly';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [prompt, setPrompt] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [customCron, setCustomCron] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const all = await getAllTasks();
    setTasks(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate() {
    const schedule =
      frequency === 'custom'
        ? customCron.trim() || '* * * * *'
        : buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth);

    const task: Task = {
      id: ulid(),
      groupId: DEFAULT_GROUP_ID,
      schedule,
      prompt: prompt.trim(),
      enabled: true,
      lastRun: null,
      createdAt: Date.now(),
    };

    await saveTask(task);
    setPrompt('');
    setShowForm(false);
    loadTasks();
  }

  async function handleToggle(task: Task) {
    await saveTask({ ...task, enabled: !task.enabled });
    loadTasks();
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setDeleteConfirm(null);
    loadTasks();
  }

  const previewCron =
    frequency === 'custom'
      ? customCron.trim() || '* * * * *'
      : buildCron(frequency, hour, minute, dayOfWeek, dayOfMonth);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Nhiệm vụ định kỳ
        </h2>
        <button
          className="btn btn-primary btn-sm gap-1.5"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <><X className="w-4 h-4" /> Hủy</> : <><Plus className="w-4 h-4" /> Nhiệm vụ mới</>}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card bg-base-200 shadow-sm border border-base-300 mb-6">
          <div className="card-body p-4 sm:p-6 gap-4">
            <h3 className="card-title text-base">Tạo nhiệm vụ định kỳ</h3>

            {/* Prompt */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Yêu cầu</span>
              </label>
              <textarea
                className="textarea textarea-bordered h-24"
                placeholder="Trợ lý nên làm gì theo lịch trình này?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Frequency */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Tần suất</span>
              </label>
              <select
                className="select select-bordered"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time picker */}
            {needsTimePicker(frequency) && (
              <div className="flex gap-3">
                <div className="form-control flex-1">
                  <label className="label">
                    <span className="label-text">Giờ</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={hour}
                    onChange={(e) => setHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {formatTime12(i, 0).replace(/:00/, '')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control flex-1">
                  <label className="label">
                    <span className="label-text">Phút</span>
                  </label>
                  <select
                    className="select select-bordered select-sm"
                    value={minute}
                    onChange={(e) => setMinute(Number(e.target.value))}
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>
                        :{String(m).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Minute picker for hourly */}
            {needsMinutePicker(frequency) && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Vào phút</span>
                </label>
                <select
                  className="select select-bordered select-sm"
                  value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                    <option key={m} value={m}>
                      :{String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Day of week picker */}
            {needsDayOfWeek(frequency) && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Ngày trong tuần</span>
                </label>
                <select
                  className="select select-bordered select-sm"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Day of month picker */}
            {needsDayOfMonth(frequency) && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Ngày trong tháng</span>
                </label>
                <select
                  className="select select-bordered select-sm"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {ordinal(i + 1)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom cron input */}
            {frequency === 'custom' && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Biểu thức Cron</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered font-mono"
                  placeholder="* * * * *"
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                />
                <label className="label">
                  <span className="label-text-alt opacity-60">
                    Định dạng: phút giờ ngày-trong-tháng tháng ngày-trong-tuần
                  </span>
                </label>
              </div>
            )}

            {/* Preview */}
            <div className="bg-base-200 rounded-lg px-3 py-2 text-sm border border-base-300">
              <span className="opacity-60">Xem trước lịch trình: </span>
              <span className="font-medium">{cronToHuman(previewCron)}</span>
              <span className="opacity-50 ml-2 font-mono text-xs">
                ({previewCron})
              </span>
            </div>

            {/* Submit */}
            <div className="card-actions justify-end">
              <button
                className="btn btn-primary"
                disabled={!prompt.trim()}
                onClick={handleCreate}
              >
                Tạo nhiệm vụ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="hero py-12">
          <div className="hero-content text-center">
            <div>
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-20 text-primary" />
              <p className="text-lg font-medium">Chưa có nhiệm vụ nào</p>
              <p className="text-sm opacity-60 mt-1">Tạo một nhiệm vụ để chạy tự động theo lịch</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`card bg-base-200 shadow-sm border border-base-300 ${!task.enabled ? 'opacity-50' : ''}`}
            >
              <div className="card-body p-4 sm:p-6 gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-2">{task.prompt}</p>
                    <p className="text-sm opacity-70 mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 inline text-primary" /> {cronToHuman(task.schedule)}
                      <span className="opacity-50 ml-2 font-mono text-xs">
                        ({task.schedule})
                      </span>
                    </p>
                    {task.lastRun && (
                      <p className="text-xs opacity-50 mt-1">
                        Chạy lần cuối: {new Date(task.lastRun).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={task.enabled}
                      onChange={() => handleToggle(task)}
                    />
                    <button
                      className="btn btn-ghost btn-xs text-error p-0"
                      onClick={() => setDeleteConfirm(task.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm shadow-xl border border-base-300">
            <h3 className="font-bold text-lg">Xóa nhiệm vụ?</h3>
            <p className="py-4 opacity-70">
              Nhiệm vụ định kỳ này sẽ bị xóa vĩnh viễn khỏi trình duyệt.
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>
                Hủy
              </button>
              <button
                className="btn btn-error"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Xóa ngay
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setDeleteConfirm(null)}>đóng</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
