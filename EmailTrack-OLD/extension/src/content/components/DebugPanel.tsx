
import React, { useEffect, useState } from 'react';
import './StatsDisplay.css';

interface DebugState {
    lastAction: string;
    recipient: string;
    subject: string;
    trackingEnabled: boolean;
    pixelInjected: boolean;
    statsVisible: boolean;
}

const DebugPanel: React.FC = () => {
    const [state, setState] = useState<DebugState>({
        lastAction: 'Idle',
        recipient: 'None',
        subject: 'None',
        trackingEnabled: false,
        pixelInjected: false,
        statsVisible: false
    });

    useEffect(() => {
        const handler = (e: CustomEvent) => {
            setState(prev => ({ ...prev, ...e.detail }));
        };

        window.addEventListener('EMAIL_TRACK_DEBUG', handler as EventListener);
        return () => window.removeEventListener('EMAIL_TRACK_DEBUG', handler as EventListener);
    }, []);

    return (
        <div className="email-track-debug-panel">
            <h4>EmailTrack Debugger 🛠️</h4>
            <div className="email-track-debug-row">
                <span>Action:</span>
                <span className="email-track-debug-val">{state.lastAction}</span>
            </div>
            <div className="email-track-debug-row">
                <span>Tracking:</span>
                <span className="email-track-debug-val" style={{ color: state.trackingEnabled ? '#10b981' : '#ef4444' }}>
                    {state.trackingEnabled ? 'ON' : 'OFF'}
                </span>
            </div>
            <div className="email-track-debug-row">
                <span>Subject:</span>
                <span className="email-track-debug-val" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state.subject}
                </span>
            </div>
            <div className="email-track-debug-row">
                <span>Recipient:</span>
                <span className="email-track-debug-val" style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state.recipient}
                </span>
            </div>
            <div className="email-track-debug-row">
                <span>Pixel:</span>
                <span className="email-track-debug-val">{state.pixelInjected ? '✅ Injected' : '❌ Not Injected'}</span>
            </div>
            <div className="email-track-debug-row">
                <span>Stats UI:</span>
                <span className="email-track-debug-val">{state.statsVisible ? '✅ Visible' : '❌ Searching...'}</span>
            </div>
        </div>
    );
};

export default DebugPanel;
