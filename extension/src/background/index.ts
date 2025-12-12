
console.log('EmailTrack: Background Script Loaded');

const API_BASE = 'http://localhost:3000';

async function handleRegister(data: any) {
    console.log('Registering email:', data);
    try {
        await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: data.id,
                subject: data.subject,
                recipient: data.recipient
            })
        });

        console.log('Email registered successfully');
    } catch (err) {
        console.error('Registration failed:', err);
    }
}

async function handleGetStats(trackId: string) {
    console.log('Fetching stats for:', trackId);
    try {
        const res = await fetch(`${API_BASE}/stats/${trackId}`);
        if (!res.ok) throw new Error('Stats fetch failed');
        const data = await res.json();
        return data;
    } catch (err: any) {
        console.error('Stats fetch error:', err);
        return { error: err.message || 'Unknown error' };
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'REGISTER_EMAIL') {
        handleRegister(message.data);
    } else if (message.type === 'GET_STATS') {
        handleGetStats(message.trackId).then(sendResponse);
        return true; // Keep channel open for async response
    }
});
