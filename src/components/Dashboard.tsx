import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDispatch, useSelector } from 'react-redux';
import { getInfluencerStats } from '../store/actions/dashboardAction';

const chartData = [
  { name: 'Jan', revenue: 4000, expenses: 2400 },
  { name: 'Feb', revenue: 3000, expenses: 1398 },
  { name: 'Mar', revenue: 2000, expenses: 9800 },
  { name: 'Apr', revenue: 2780, expenses: 3908 },
  { name: 'May', revenue: 1890, expenses: 4800 },
  { name: 'Jun', revenue: 2390, expenses: 3800 },
];



// Fix: Replaced `JSX.Element` with `React.ReactNode` to resolve "Cannot find namespace 'JSX'" error.
const StatCard: React.FC<{ title: string; value: string; subtext?: string; icon: React.ReactNode; color: string }> = ({ title, value, subtext, icon, color }) => (
  <div className="flex items-center p-6 bg-white rounded-lg shadow-md dark:bg-dark-800">
      <div className={`p-3 mr-4 text-white ${color} rounded-full`}>
          {icon}
      </div>
      <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-semibold text-gray-700 dark:text-gray-200">{value}</p>
          {subtext && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{subtext}</p>}
      </div>
  </div>
);

const UserIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m9 5.197a6 6 0 01-3.172-10.957M12 6.043A6 6 0 0118 10a6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-3.957z"></path></svg>);
const RevenueIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01M12 6v.01M12 18v-2m0-4v-2m0-4V4m0 0H9m3 0h3m-3 18h3m-3 0H9m12-9a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>);
const OrdersIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>);
const MailIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>);
const ProfileIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>);
const ShieldIcon = () => (<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>);

const Dashboard: React.FC = () => {
  const user = useSelector((state: any) => state.user);
  const influencerStats = useSelector((state: any) => state?.influencerStats?.data);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const loadingCallback = () => {
    setIsLoading(false);
  }
  useEffect(() => {
    dispatch(getInfluencerStats(loadingCallback) as unknown as any);
    return () => {
      dispatch(getInfluencerStats(loadingCallback) as unknown as any);
    }
  }, []);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-900">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"></div>
      </div>
    );
  }
  return (
    <>
      <h2 className="mb-6 text-3xl font-semibold text-gray-700 dark:text-gray-200">
        Welcome, {user?.name}!
      </h2>

      {/* Main Stats */}
      <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Users" value="4,382" icon={<UserIcon/>} color="bg-blue-500"/>
        <StatCard title="Total Revenue" value="$21,499" icon={<RevenueIcon/>} color="bg-gradient-to-r from-primary to-primary-accent"/>
        <StatCard title="New Orders" value="1,205" icon={<OrdersIcon/>} color="bg-orange-500"/>
      </div>

      {/* Influencer Insights */}
      <h3 className="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-200">Influencer Insights</h3>
      <div className="grid gap-6 mb-8 md:grid-cols-2 xl:grid-cols-4">
        <StatCard 
            title="Total Influencers" 
            value={influencerStats?.total_influencers.toString()} 
            subtext={`${influencerStats?.total_active_influencers} Active, ${influencerStats?.total_inactive_influencers} Inactive`}
            icon={<UserIcon/>} 
            color="bg-indigo-500"
        />
        <StatCard 
            title="Verified Emails" 
            value={influencerStats?.total_active_influencers_with_verified_email.toString()} 
            subtext={`${influencerStats?.total_active_influencers_with_unverified_email} Unverified`}
            icon={<MailIcon/>} 
            color="bg-emerald-500"
        />
        <StatCard 
            title="Profile Completion" 
            value={influencerStats?.total_active_influencers_with_complete_profile.toString()} 
            subtext={`${influencerStats?.total_active_influencers_with_incomplete_profile} Incomplete`}
            icon={<ProfileIcon/>} 
            color="bg-amber-500"
        />
        <StatCard 
            title="Admin Approved" 
            value={influencerStats?.total_active_influencers_with_complete_profile_and_approved_by_admin.toString()} 
            subtext={`${influencerStats?.total_active_influencers_with_complete_profile_and_not_approved_by_admin} Pending`}
            icon={<ShieldIcon/>} 
            color="bg-rose-500"
        />
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