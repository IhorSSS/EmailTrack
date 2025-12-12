import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './TrackButton.css';

interface Props {
    composeId: string;
}

const TrackButton: React.FC<Props> = ({ composeId }) => {
    const [enabled, setEnabled] = useState(false);

    // Communicate with background or directly handle logic
    // For now, toggle state.
    // We need to attach this state to the compose window so when Send is clicked we know.
    // Or we modify the DOM to include a hidden marker?
    // Proper way: Store state in a global map keyed by composeId.

    const toggle = () => {
        const newState = !enabled;
        setEnabled(newState);
        // Dispatch event or update global store
        window.dispatchEvent(new CustomEvent('EMAIL_TRACK_TOGGLE', {
            detail: { composeId, enabled: newState }
        }));
    };

    return (
        <div
            className={`email-track-btn ${enabled ? 'enabled' : ''}`}
            onClick={toggle}
            title="Track Email Opens"
        >
            {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
        </div>
    );
};

export default TrackButton;
