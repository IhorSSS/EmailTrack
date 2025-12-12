
import React, { useEffect, useState } from 'react';
import './StatsDisplay.css';

interface StatsDisplayProps {
    trackId: string;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ trackId }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Send message to background script to fetch stats
        try {
            chrome.runtime.sendMessage({
                type: 'GET_STATS',
                trackId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Runtime error:', chrome.runtime.lastError);
                    setLoading(false);
                    return;
                }

                if (response && !response.error) {
                    setStats(response);
                }
                setLoading(false);
            });
        } catch (e) {
            console.error('SendMessage failed:', e);
            setLoading(false);
        }
    }, [trackId]);

    if (loading) return <span className="email-track-badge loading">Loading...</span>;
    if (!stats) return <span className="email-track-badge error">Unregistered</span>;

    const openText = stats.opens > 0 ? `${stats.opens} Open${stats.opens === 1 ? '' : 's'}` : 'Unopened';
    const statusClass = stats.opens > 0 ? 'opened' : 'sent';

    return (
        <span className={`email-track-badge ${statusClass}`} title={`Last update: ${new Date().toLocaleTimeString()}`}>
            {stats.opens > 0 && <span className="dot"></span>}
            {openText}
        </span>
    );
};

export default StatsDisplay;
