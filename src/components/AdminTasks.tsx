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

  // Filters
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
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
      if (statusFilter) body.status = statusFilter;
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
  }, [statusFilter, priorityFilter, search]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── Mutations ────────────────────────────────────────────────────────────
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Status tabs */}
        <div className="flex bg-dark-800 rounded-lg overflow-hidden border border-dark-700">
          {(['', 'todo', 'doing', 'done'] as const).map((s) => {
            const label =
              s === '' ? `All (${counts.todo + counts.doing + counts.done})` :
              s === 'todo' ? `To do (${counts.todo})` :
              s === 'doing' ? `In progress (${counts.doing})` :
              `Done (${counts.done})`;
            return (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Priority filter */}
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

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or notes…"
          className="px-3 py-1.5 text-xs bg-dark-800 text-gray-200 border border-dark-700 rounded-lg flex-1 min-w-[200px] max-w-xs"
        />
      </div>

      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-base mb-2">No tasks match your filters.</p>
          <p className="text-sm">Adjust the filters or create a new task.</p>
        </div>
      )}

      {/* Task list — single column, grouped or flat depending on filter */}
      {!loading && !error && tasks.length > 0 && (
        <div className="space-y-3">
          {(['todo', 'doing', 'done'] as Status[]).map((bucket) => {
            const items = grouped[bucket];
            if (items.length === 0) return null;
            // If a status filter is active, suppress the section heading (redundant)
            const showHeading = !statusFilter;
            return (
              <div key={bucket}>
                {showHeading && (
                  <div className="flex items-center gap-2 mt-6 mb-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_STYLES[bucket].dot}`} />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {STATUS_STYLES[bucket].label} · {items.length}
                    </h2>
                  </div>
                )}
                <div className="space-y-2">
                  {items.map((t) => (
                    <div
                      key={t._id}
                      className={`p-4 bg-dark-800 border border-dark-700 rounded-lg flex items-start gap-3 hover:border-emerald-500/30 transition-colors ${
                        t.done ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Checkbox / toggle */}
                      <button
                        onClick={() => toggleDone(t)}
                        className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          t.done
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-gray-500 hover:border-emerald-400'
                        }`}
                        aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                      >
                        {t.done && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${t.done ? 'line-through text-gray-500' : 'text-white'}`}>
                          {t.title}
                        </div>
                        {t.notes && (
                          <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{t.notes}</div>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${PRIORITY_STYLES[t.priority].chip}`}>
                            {PRIORITY_STYLES[t.priority].label}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_STYLES[t.status].chip}`}>
                            {STATUS_STYLES[t.status].label}
                          </span>
                          {t.created_at && (
                            <span className="text-[10px] text-gray-500">
                              Created {formatDateTime(t.created_at)}
                            </span>
                          )}
                          {t.legacy_id && (
                            <span className="text-[10px] text-gray-600" title="Migrated from local task manager">
                              · legacy:{t.legacy_id.slice(0, 6)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setEditing(t)}
                          className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
                          title="Edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeTask(t)}
                          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
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
