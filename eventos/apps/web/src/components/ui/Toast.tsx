"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, type, title, message };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  const success = useCallback(
    (msg: string, title?: string) => showToast(msg, "success", title),
    [showToast]
  );
  const error = useCallback(
    (msg: string, title?: string) => showToast(msg, "error", title),
    [showToast]
  );
  const warning = useCallback(
    (msg: string, title?: string) => showToast(msg, "warning", title),
    [showToast]
  );
  const info = useCallback(
    (msg: string, title?: string) => showToast(msg, "info", title),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Container de Toasts Flutuantes */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((toast) => {
          const isSuccess = toast.type === "success";
          const isError = toast.type === "error";
          const isWarning = toast.type === "warning";

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-all animate-in slide-in-from-bottom-5 duration-300 ${
                isSuccess
                  ? "bg-slate-900/95 border-emerald-500/40 text-emerald-100 shadow-emerald-950/40"
                  : isError
                  ? "bg-slate-900/95 border-rose-500/40 text-rose-100 shadow-rose-950/40"
                  : isWarning
                  ? "bg-slate-900/95 border-amber-500/40 text-amber-100 shadow-amber-950/40"
                  : "bg-slate-900/95 border-indigo-500/40 text-indigo-100 shadow-indigo-950/40"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
                {isError && <XCircle size={18} className="text-rose-400" />}
                {isWarning && <AlertTriangle size={18} className="text-amber-400" />}
                {!isSuccess && !isError && !isWarning && <Info size={18} className="text-indigo-400" />}
              </div>

              <div className="flex-1 text-xs">
                {toast.title && <strong className="font-bold block mb-0.5">{toast.title}</strong>}
                <p className="leading-relaxed opacity-90">{toast.message}</p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback gracioso se usado fora do provider
    return {
      showToast: (msg: string) => console.log(msg),
      success: (msg: string) => console.log(msg),
      error: (msg: string) => console.error(msg),
      warning: (msg: string) => console.warn(msg),
      info: (msg: string) => console.info(msg),
    };
  }
  return context;
}
