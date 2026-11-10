// Dashboard for team logins (sales): brand signups + open tasks only.
// Backed by GET /admin/dashboard/team-summary.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import collabs from '../config/collabs';

interface Summary {
  brands: { total: number; today: number; last_7_days: number };
  tasks: { open: number; mine_open: number; mine_overdue: number };
}

const card = 'p-5 bg-white rounded-xl border border-gray-200 dark:bg-dark-800 dark:border-dark-700';

const Stat: React.FC<{ label: string; value: number | string; tone?: 'red'; onClick?: () => void }> = ({ label, value, tone, onClick }) => (
  <button type="button" onClick={onClick} className={`${card} text-left w-full ${onClick ? 'hover:border-primary cursor-pointer' : 'cursor-default'}`}>
    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{label}</p>
    <p className={`mt-2 text-3xl font-bold ${tone === 'red' && Number(value) > 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>{value}</p>
  </button>
);

const TeamDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    collabs.get('/admin/dashboard/team-summary')
      .then(res => (res.data?.success ? setData(res.data.data) : setError(res.data?.message || 'Could not load.')))
      .catch(err => setError(err?.response?.data?.message || 'Could not load.'));
  }, []);

  if (error) return <div className="p-6 text-sm text-red-500">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase dark:text-gray-400">Brand signups</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Today" value={data.brands.today} onClick={() => navigate('/brands')} />
          <Stat label="Last 7 days" value={data.brands.last_7_days} onClick={() => navigate('/brands')} />
          <Stat label="All time" value={data.brands.total} onClick={() => navigate('/brands')} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase dark:text-gray-400">Tasks</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="My open tasks" value={data.tasks.mine_open} onClick={() => navigate('/tasks')} />
          <Stat label="My overdue" value={data.tasks.mine_overdue} tone="red" onClick={() => navigate('/tasks')} />
          <Stat label="Team open tasks" value={data.tasks.open} onClick={() => navigate('/tasks')} />
        </div>
      </section>
    </div>
  );
};

export default TeamDashboard;
