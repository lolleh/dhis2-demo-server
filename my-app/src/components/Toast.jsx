import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

const styles = {
    container: {
        position: 'fixed', top: 16, right: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400,
    },
    toast: {
        padding: '12px 16px', borderRadius: 4, color: '#fff',
        fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        animation: 'slideIn 0.3s ease',
    },
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const showToast = useCallback((message, type = 'info') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 4000)
    }, [])

    const colors = { success: '#009688', error: '#f44336', warning: '#ff9800', info: '#1976d2' }

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div style={styles.container}>
                {toasts.map(t => (
                    <div key={t.id} style={{ ...styles.toast, backgroundColor: colors[t.type] || colors.info }}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    return useContext(ToastContext)
}
