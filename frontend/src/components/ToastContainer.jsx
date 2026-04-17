import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

const TYPE_COLOR = {
  critical: "#E24B4A",
  warning:  "#EF9F27",
  info:     "#378ADD",
  success:  "#639922",
};

const DEFAULT_DURATION = {
  critical: 5000,
  warning:  3500,
  info:     3500,
  success:  3000,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = "info", duration) => {
    const id = Date.now() + Math.random();
    const dur = duration ?? DEFAULT_DURATION[type] ?? 3500;

    setToasts((prev) => [...prev, { id, message, type, duration: dur, exiting: false }]);

    // Start exit animation before removal
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
    }, dur - 300);

    setTimeout(() => removeToast(id), dur);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position:      "fixed",
      top:           72,
      right:         16,
      zIndex:        1000,
      display:       "flex",
      flexDirection: "column",
      gap:           8,
      maxWidth:      320,
      pointerEvents: "none",
    }}>
      {toasts.map((toast) => {
        const color = TYPE_COLOR[toast.type] ?? TYPE_COLOR.info;
        return (
          <div
            key={toast.id}
            style={{
              background:   "#111827",
              borderLeft:   `4px solid ${color}`,
              borderRadius: 8,
              padding:      "10px 14px",
              fontSize:     13,
              display:      "flex",
              alignItems:   "flex-start",
              gap:          10,
              pointerEvents: "auto",
              position:     "relative",
              overflow:     "hidden",
              animation:    toast.exiting
                ? "toastSlideOut 0.3s ease-in forwards"
                : "toastSlideIn 0.25s ease-out",
            }}
          >
            {/* Icon dot */}
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: color, marginTop: 3, flexShrink: 0,
            }} />

            {/* Message */}
            <span style={{ flex: 1, color: "#e5e7eb", lineHeight: 1.5 }}>
              {toast.message}
            </span>

            {/* Close */}
            <button
              onClick={() => onRemove(toast.id)}
              style={{
                color: "#6b7280", fontSize: 16, lineHeight: 1,
                padding: 0, background: "none", border: "none",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              ×
            </button>

            {/* Progress bar */}
            <div style={{
              position:        "absolute",
              bottom:          0,
              left:            0,
              height:          2,
              width:           "100%",
              background:      color,
              transformOrigin: "left",
              animation:       `toastProgress ${toast.duration}ms linear forwards`,
            }} />
          </div>
        );
      })}
    </div>
  );
}
