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
const CampaignsModeration = lazy(() => import('./src/components/CampaignsModeration'));
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
    : pathname.startsWith('/brands')
      ? 'Brands'
      : pathname.startsWith('/campaigns')
        ? 'Campaigns'
        : 'Dashboard';

  const setActiveScreen = (screen: string) => {
    switch (screen) {
      case 'Influencers':
        navigate('/influencers');
        break;
      case 'Brands':
        navigate('/brands');
        break;
      case 'Campaigns':
        navigate('/campaigns');
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
                    <Route path="/campaigns" element={<CampaignsModeration />} />
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
