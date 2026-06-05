import React, { useState, Suspense, lazy } from 'react';
import { ThemeProvider } from './src/context/ThemeContext';
import Sidebar from './src/components/Sidebar';
import Header from './src/components/Header';
import { Provider, useSelector } from 'react-redux';
import store from './src/store/store';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

const Dashboard = lazy(() => import('./src/components/Dashboard'));
const Influencers = lazy(() => import('./src/components/Influencers'));
const InfluencerDetail = lazy(() => import('./src/components/InfluencerDetail'));
const Brands = lazy(() => import('./src/components/Brands'));
const BrandDetail = lazy(() => import('./src/components/BrandDetail'));
const Insights = lazy(() => import('./src/components/Insights'));
const TopCreators = lazy(() => import('./src/components/TopCreators'));
const EmailCampaigns = lazy(() => import('./src/components/EmailCampaigns'));
const EmailCampaignDetail = lazy(() => import('./src/components/EmailCampaignDetail'));
const CsvEmailCampaigns = lazy(() => import('./src/components/CsvEmailCampaigns'));
const CsvEmailCampaignDetail = lazy(() => import('./src/components/CsvEmailCampaignDetail'));
const SocialSyncStatus = lazy(() => import('./src/components/SocialSyncStatus'));
const BrandActivity = lazy(() => import('./src/components/BrandActivity'));
const BrandActivityDetail = lazy(() => import('./src/components/BrandActivityDetail'));
const BrandActivitySearches = lazy(() => import('./src/components/BrandActivitySearches'));
const AdminOrders = lazy(() => import('./src/components/AdminOrders'));
const AdminOrderDetail = lazy(() => import('./src/components/AdminOrderDetail'));
const AdminDisputes = lazy(() => import('./src/components/AdminDisputes'));
const AdminTasks = lazy(() => import('./src/components/AdminTasks'));
const LoginPage = lazy(() => import('./src/components/LoginPage'));

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <Main />
      </ThemeProvider>
    </Provider>
  );
};

const Main: React.FC = () => {
  const user = useSelector((state: any) => state.user);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  const activeScreen = pathname.startsWith('/influencers')
    ? 'Influencers'
    : pathname.startsWith('/brand-activity')
      ? 'Brand Activity'
      : pathname.startsWith('/brands')
        ? 'Brands'
        : pathname.startsWith('/top-creators')
          ? 'Top Creators'
          : pathname.startsWith('/insights')
            ? 'Insights'
            : pathname.startsWith('/email-campaigns')
              ? 'Email Campaigns'
              : pathname.startsWith('/csv-campaigns')
                ? 'Bulk Email'
                : pathname.startsWith('/social-sync')
                  ? 'Social Sync'
                  : pathname.startsWith('/orders')
                    ? 'Orders'
                    : pathname.startsWith('/disputes')
                      ? 'Disputes'
                      : pathname.startsWith('/tasks')
                        ? 'Tasks'
                        : 'Dashboard';

  const setActiveScreen = (screen: string) => {
    switch (screen) {
      case 'Influencers':
        navigate('/influencers');
        break;
      case 'Brands':
        navigate('/brands');
        break;
      case 'Insights':
        navigate('/insights');
        break;
      case 'Top Creators':
        navigate('/top-creators');
        break;
      case 'Email Campaigns':
        navigate('/email-campaigns');
        break;
      case 'Bulk Email':
        navigate('/csv-campaigns');
        break;
      case 'Social Sync':
        navigate('/social-sync');
        break;
      case 'Brand Activity':
        navigate('/brand-activity');
        break;
      case 'Orders':
        navigate('/orders');
        break;
      case 'Disputes':
        navigate('/disputes');
        break;
      case 'Tasks':
        navigate('/tasks');
        break;
      case 'Dashboard':
      default:
        navigate('/dashboard');
        break;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-dark-900">
      {user ? (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            setIsOpen={setSidebarOpen}
            activeScreen={activeScreen}
            setActiveScreen={setActiveScreen}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-dark-900">
              {/* <div className="container mx-auto px-6 py-8"> */}
              <div className="px-6 py-8">
                <Suspense fallback={<div className="flex items-center justify-center h-screen bg-dark-900">
                  <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"></div>
                </div>}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/influencers" element={<Influencers />} />
                    <Route path="/influencers/:id" element={<InfluencerDetail />} />
                    <Route path="/brands" element={<Brands />} />
                    <Route path="/brands/:id" element={<BrandDetail />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/top-creators" element={<TopCreators />} />
                    <Route path="/email-campaigns" element={<EmailCampaigns />} />
                    <Route path="/email-campaigns/:id" element={<EmailCampaignDetail />} />
                    <Route path="/csv-campaigns" element={<CsvEmailCampaigns />} />
                    <Route path="/csv-campaigns/:id" element={<CsvEmailCampaignDetail />} />
                    <Route path="/social-sync" element={<SocialSyncStatus />} />
                    <Route path="/brand-activity" element={<BrandActivity />} />
                    <Route path="/brand-activity/searches" element={<BrandActivitySearches />} />
                    <Route path="/brand-activity/:brandId" element={<BrandActivityDetail />} />
                    <Route path="/orders" element={<AdminOrders />} />
                    <Route path="/orders/:id" element={<AdminOrderDetail />} />
                    <Route path="/disputes" element={<AdminDisputes />} />
                    <Route path="/tasks" element={<AdminTasks />} />
                    <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </main>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden w-full">
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-dark-900">
            {/* <div className="container mx-auto px-6 py-8"> */}
            <div className="px-6 py-8">
              <Suspense fallback={<div className="flex items-center justify-center h-screen bg-dark-900">
                  <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"></div>
                </div>}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
