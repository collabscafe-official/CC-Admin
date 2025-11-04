import React, { useState } from 'react';
import { ThemeProvider } from './src/context/ThemeContext';
import LoginPage from './src/components/LoginPage';
import Sidebar from './src/components/Sidebar';
import Header from './src/components/Header';
import Dashboard from './src/components/Dashboard';
import Influencers from './src/components/Influencers';
import Brands from './src/components/Brands';
import { Provider, useSelector } from 'react-redux';
import store from './src/store/store';

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
  const [activeScreen, setActiveScreen] = useState('Dashboard');

  if (!user) {
    return <LoginPage />;
  }

  return (    
    <div className="flex h-screen bg-gray-100 dark:bg-dark-900">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-dark-900">
          <div className="container mx-auto px-6 py-8">
            {activeScreen === 'Dashboard' && <Dashboard />}
            {activeScreen === 'Influencers' && <Influencers />}
            {activeScreen === 'Brands' && <Brands />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
