import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSelector } from 'react-redux';

const chartData = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Feb', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 2000, expenses: 9800 },
  { name: 'Apr', revenue: 2780, expenses: 3908 },
  { name: 'May', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
];

// Fix: Replaced `JSX.Element` with `React.ReactNode` to resolve "Cannot find namespace 'JSX'" error.
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="flex items-center p-6 bg-white rounded-lg shadow-md dark:bg-dark-800">
        <div className={`p-3 mr-4 text-white ${color} rounded-full`}>
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{value}</p>
        </div>
    </div>
);

const UserIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m9 5.197a6 6 0 01-3.172-10.957M12 6.043A6 6 0 0118 10a6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-3.957z"></path></svg>);
const RevenueIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v.01M12 18v-2m0-4v-2m0-4V4m0 0H9m3 0h3m-3 18h3m-3 0H9m12-9a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>);
const OrdersIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>);

const Dashboard: React.FC = () => {
  const user = useSelector((state: any) => state.user);
  return (
    <>
      <h2 className="mb-6 text-3xl font-semibold text-gray-700 dark:text-gray-200">
        Welcome, {user?.name}!
      </h2>

      <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Users" value="4,382" icon={<UserIcon/>} color="bg-blue-500"/>
        <StatCard title="Total Revenue" value="$21,499" icon={<RevenueIcon/>} color="bg-gradient-to-r from-primary to-primary-accent"/>
        <StatCard title="New Orders" value="1,205" icon={<OrdersIcon/>} color="bg-orange-500"/>
      </div>
      
      <div className="p-6 bg-white rounded-lg shadow-md dark:bg-dark-800">
        <h3 className="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-200">Monthly Performance</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#7c6edd" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.3)" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(31, 41, 55, 0.9)',
                borderColor: '#4b5563'
              }}
              cursor={{fill: 'rgba(79, 70, 229, 0.1)'}}
            />
            <Legend />
            <Bar dataKey="revenue" fill="url(#colorRevenue)" />
            <Bar dataKey="expenses" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

export default Dashboard;