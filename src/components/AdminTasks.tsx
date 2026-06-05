// AdminTasks — shared task list for the admin team.
//
// Data: POST /v1/admin/tasks/{list|create|update|toggle|delete} (Backend-V2).
// Replaces the local Node task manager at /tasks/ (port 5556). All admin
// users see the same list; no per-user separation.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import collabs from '../config/collabs';

// ── Types ────────────────────────────────────────────────────────────────────
type Priority = 'high' | 'medium' | 'low';
type Status = 'todo' | 'doing' | 'done';

interface TaskRow {
  _id: string;
  title: string;
  notes?: string;
  priority: Priority;
  status: Status;
  done: boolean;
  done_at?: string | null;
  created_at?: string;
  updated_at?: string;
  legacy_id?: string | null;
}

interface Counts {
  todo: number;
  doing: number;
  done: number;
}

// ── Styling maps ─────────────────────────────────────────────────────────────
const PRIORITY_STYLES: Record<Priority, { label: string; chip: string }> = {
  high:   { label: 'High',   chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
  medium: { label: 'Medium', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  low:    { label: 'Low',    chip: 'bg-gray-500/15 text-gray-300 border-gray-500/30' },
};
const STATUS_STYLES: Record<Status, { label: string; chip: string; dot: string }> = {
  todo:  { label: 'To do',     chip: 'bg-gray-500/15 text-gray-300 border-gray-500/30',     dot: 'bg-gray-400' },
  doing: { label: 'In progress', chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',     dot: 'bg-blue-400' },
  done:  { label: 'Done',      chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(s?: string | null) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

// ── Component ────────────────────────────────────────────────────────────────
const AdminTasks: React.FC = () => {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [counts, setCounts] = useState<Counts>({ todo: 0, doing: 0, done: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — kanban view always shows all 3 columns, so no status filter here.
  // (Backend supports it; we just don't expose a UI for it in kanban mode.)
  const [priorityFilter, setPriorityFilter] = useState<'' | Priority>('');
  const [search, setSearch] = useState('');

  // Modal / inline-edit state
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, any> = {};
      if (priorityFilter) body.priority = priorityFilter;
      if (search.trim()) body.q = search.trim();
      const res = await collabs.post('/admin/tasks/list', body, { params: { page: 1, limit: 500 } });
      if (res?.data?.success && res?.data?.data) {
        setTasks(res.data.data.tasks || []);
        setCounts(res.data.data.counts || { todo: 0, doing: 0, done: 0 });
      } else {
        setTasks([]);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [priorityFilter, search]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Mutations ────────────────────────────────────────────────────────────

  // Move a task to a specific status (kanban quick-shift). Optimistic update,
  // revert on server error.
  const changeStatus = async (task: TaskRow, nextStatus: Status) => {
    if (task.status === nextStatus) return;
    setTasks((prev) =>
      prev.map((t) =>
        t._id === task._id
          ? { ...t, status: nextStatus, done: nextStatus === 'done' }
          : t
      )
    );
    try {
      await collabs.post('/admin/tasks/update', { id: task._id, status: nextStatus });
      await fetchTasks();
    } catch {
      await fetchTasks(); // revert via re-fetch on failure
    }
  };

  const toggleDone = async (task: TaskRow) => {
    // Optimistic flip
    setTasks((prev) =>
      prev.map((t) =>
        t._id === task._id
          ? { ...t, done: !t.done, status: (!t.done ? 'done' : 'todo') as Status }
          : t
      )
    );
    try {
      await collabs.post('/admin/tasks/toggle', { id: task._id });
      await fetchTasks();
    } catch {
      await fetchTasks(); // revert on failure
    }
  };

  const removeTask = async (task: TaskRow) => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await collabs.post('/admin/tasks/delete', { id: task._id });
      setTasks((prev) => prev.filter((t) => t._id !== task._id));
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete');
    }
  };

  // ── Derived grouping for the kanban-ish layout ───────────────────────────
  const grouped = useMemo(() => {
    const buckets: Record<Status, TaskRow[]> = { todo: [], doing: [], done: [] };
    for (const t of tasks) {
      const s = (t.status as Status) || 'todo';
      if (buckets[s]) buckets[s].push(t);
    }
    return buckets;
  }, [tasks]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-gray-200">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-gray-400 mt-1">
            Shared admin task list. Replaces the local task manager at localhost:5556.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-gradient-to-r from-primary to-primary-accent rounded-lg text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
        >
          + New task
        </button>
      </div>

      {/* Filter bar — kanban view shows all 3 status columns side by side,
          so the status tabs are gone. Priority + search still useful. */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as any)}
          className="px-3 py-1.5 text-xs font-semibold bg-dark-800 text-gray-200 border border-dark-700 rounded-lg"
        >
          <option value="">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or notes…"
          className="px-3 py-1.5 text-xs bg-dark-800 text-gray-200 border border-dark-700 rounded-lg flex-1 min-w-[200px] max-w-xs"
        />

        <div className="ml-auto text-xs text-gray-500">
          Total: {counts.todo + counts.doing + counts.done}
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Kanban grid — 3 columns side by side on md+, stacks to 1 column on mobile */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          {(['todo', 'doing', 'done'] as Status[]).map((bucket) => {
            const items = grouped[bucket];
            const meta = STATUS_STYLES[bucket];
            return (
              <div key={bucket} className="bg-dark-900/40 rounded-lg p-3 min-h-[200px] border border-dark-800/50">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      {meta.label}
                    </h2>
                    <span className="text-[10px] font-bold text-gray-500 bg-dark-800 px-1.5 py-0.5 rounded">
                      {items.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {items.length === 0 && (
                    <div className="text-center py-6 text-xs text-gray-600 italic">
                      No tasks
                    </div>
                  )}
                  {items.map((t) => (
                    <div
                      key={t._id}
                      className={`p-3 bg-dark-800 border border-dark-700 rounded-lg hover:border-emerald-500/30 transition-colors group ${
                        t.done ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Top row: priority chip + actions (visible on hover) */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${PRIORITY_STYLES[t.priority].chip}`}>
                          {PRIORITY_STYLES[t.priority].label}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditing(t)}
                            className="p-1 text-gray-500 hover:text-white hover:bg-dark-700 rounded transition-colors"
                            title="Edit"
                            aria-label="Edit task"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeTask(t)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Delete"
                            aria-label="Delete task"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <div className={`text-sm font-medium leading-snug ${t.done ? 'line-through text-gray-500' : 'text-white'}`}>
                        {t.title}
                      </div>

                      {/* Notes */}
                      {t.notes && (
                        <div className="text-xs text-gray-400 mt-1.5 whitespace-pre-wrap line-clamp-3">
                          {t.notes}
                        </div>
                      )}

                      {/* Bottom row: quick-move buttons */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-dark-700/50">
                        {bucket !== 'todo' ? (
                          <button
                            onClick={() => changeStatus(t, bucket === 'doing' ? 'todo' : 'doing')}
                            className="p-1 text-[10px] text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                            title={`Move to ${bucket === 'doing' ? 'To do' : 'In progress'}`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>{bucket === 'doing' ? 'To do' : 'In progress'}</span>
                          </button>
                        ) : <span />}

                        {bucket !== 'done' ? (
                          <button
                            onClick={() => changeStatus(t, bucket === 'todo' ? 'doing' : 'done')}
                            className="p-1 text-[10px] text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
                            title={`Move to ${bucket === 'todo' ? 'In progress' : 'Done'}`}
                          >
                            <span>{bucket === 'todo' ? 'In progress' : 'Done'}</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ) : <span />}
                      </div>

                      {t.legacy_id && (
                        <div className="text-[9px] text-gray-700 mt-1.5" title="Migrated from local task manager">
                          legacy:{t.legacy_id.slice(0, 6)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || editing) && (
        <TaskModal
          task={editing || null}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); fetchTasks(); }}
        />
      )}
    </div>
  );
};

// ── Modal ─────────────────────────────────────────────────────────────────────
interface TaskModalProps {
  task: TaskRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, onClose, onSaved }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [notes, setNotes] = useState(task?.notes || '');
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium');
  const [status, setStatus] = useState<Status>(task?.status || 'todo');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const isEdit = !!task;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setErr('Title is required.'); return; }

    setSaving(true);
    setErr('');
    try {
      if (isEdit) {
        await collabs.post('/admin/tasks/update', {
          id: task!._id,
          title: trimmedTitle,
          notes,
          priority,
          status,
        });
      } else {
        await collabs.post('/admin/tasks/create', {
          title: trimmedTitle,
          notes,
          priority,
          status,
        });
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-dark-700 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {isEdit ? 'Edit task' : 'New task'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                maxLength={1000}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                placeholder="What needs doing?"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={5000}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none resize-y"
                placeholder="Context, links, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="todo">To do</option>
                  <option value="doing">In progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {err && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-3 py-2 rounded-lg">
                {err}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-primary to-primary-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create task')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminTasks;
