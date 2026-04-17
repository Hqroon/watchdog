import { createContext, useCallback, useContext, useState } from "react";

const ActivityLogContext = createContext(null);

export function ActivityLogProvider({ children }) {
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((category, severity, title, detail) => {
    setLogs(prev => [{
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      category,
      severity,
      title,
      detail: detail ?? "",
    }, ...prev].slice(0, 200));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <ActivityLogContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const ctx = useContext(ActivityLogContext);
  if (!ctx) throw new Error("useActivityLog must be used inside ActivityLogProvider");
  return ctx;
}
