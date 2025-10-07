import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const DashboardRefreshContext = createContext();

export const DashboardRefreshProvider = ({ children }) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to trigger dashboard refresh from any screen
  const triggerDashboardRefresh = useCallback(() => {
    console.log('🔄 Dashboard refresh triggered from external screen');
    setRefreshTrigger(prev => {
      const newValue = prev + 1;
      console.log(`🔄 Dashboard refresh trigger updated: ${prev} -> ${newValue}`);
      return newValue;
    });
  }, []);

  // Function to reset refresh trigger (called by dashboard when it has refreshed)
  const resetRefreshTrigger = useCallback(() => {
    console.log('🔄 Dashboard refresh trigger reset to 0');
    setRefreshTrigger(0);
  }, []);

  // CRASH FIX: Only include refreshTrigger in dependencies, not the callbacks
  // Callbacks are stable (created with useCallback with empty deps), so they don't need to be dependencies
  const value = useMemo(() => ({
    refreshTrigger,
    triggerDashboardRefresh,
    resetRefreshTrigger,
  }), [refreshTrigger]);

  return (
    <DashboardRefreshContext.Provider value={value}>
      {children}
    </DashboardRefreshContext.Provider>
  );
};

export const useDashboardRefresh = () => {
  const context = useContext(DashboardRefreshContext);
  if (context === undefined) {
    throw new Error('useDashboardRefresh must be used within a DashboardRefreshProvider');
  }
  return context;
};

export default DashboardRefreshContext;