
import { createRoot } from 'react-dom/client';
import StatsDisplay from './components/StatsDisplay';
import './components/StatsDisplay.css';

console.log('EmailTrack: Content Script UI Loaded');

// --- Script Injection for Main World (Tracking) ---
const injectScript = (fileName: string) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(fileName);
    script.onload = function () {
        console.log(`EmailTrack: Injected ${fileName}`);
        (this as HTMLScriptElement).remove();
    };
    (document.head || document.documentElement).appendChild(script);
};

// Inject dependencies in order
setTimeout(() => {
    injectScript('jquery.js');
    setTimeout(() => {
        injectScript('gmail.js');
        setTimeout(() => {
            injectScript('logic.js');
        }, 100);
    }, 100);
}, 1000);

const STATS_INJECT_CLASS = 'email-track-stats-injected';

// --- Optimistic UI: Listen for Sent Events from logic.js ---
window.addEventListener('EMAILTRACK_REGISTER', (event: any) => {
    const data = event.detail;
    if (!data || !data.id) return;

    const { id } = data;
    console.log('EmailTrack: [UI] Received REGISTER CustomEvent for ID:', id);

    // 1. Forward to Background Script
    chrome.runtime.sendMessage({
        type: 'REGISTER_EMAIL',
        data: data
    }, (response) => {
        console.log('EmailTrack: [UI] Registration forwarded to background:', response);
    });

    // 2. Optimistic UI Update (With Retries)
    const attemptInject = (attempt = 1) => {
        const success = handleOptimisticBadge(id);
        if (success) {
            console.log(`EmailTrack: [UI] Badge Injected on attempt ${attempt}`);
        } else if (attempt < 5) {
            // Retry with backoff (500ms, 1000ms... 2500ms)
            setTimeout(() => attemptInject(attempt + 1), 500 * attempt);
        } else {
            console.warn('EmailTrack: [UI] Failed to inject optimistic badge after 5 attempts');
        }
    };

    setTimeout(() => attemptInject(1), 500);
});

function handleOptimisticBadge(trackId: string): boolean {
    const messages = document.querySelectorAll('div.adn');
    if (messages.length === 0) return false;

    // Target the last message (most recent)
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.classList.contains(STATS_INJECT_CLASS)) return true;

    // Find Anchor
    const dateElement = lastMessage.querySelector('.gH');
    const subjectHeader = lastMessage.closest('.gs')?.parentElement?.querySelector('h2.hP');
    const anchor = dateElement || subjectHeader;

    if (anchor && anchor.parentElement) {
        console.log('EmailTrack: [UI] Optimistically injecting badge for', trackId);
        const statsContainer = document.createElement('span');
        statsContainer.style.marginLeft = '10px';
        statsContainer.style.display = 'inline-flex';
        statsContainer.style.alignItems = 'center';
        statsContainer.style.verticalAlign = 'middle';
        statsContainer.style.position = 'relative';

        statsContainer.onclick = (e) => e.stopPropagation();

        if (anchor.nextSibling) {
            anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
        } else {
            anchor.parentElement.appendChild(statsContainer);
        }

        lastMessage.classList.add(STATS_INJECT_CLASS);
        createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
        return true;
    }

    return false;
}

function injectStats() {
    // .adn is the container for a single message in conversation view
    const messages = document.querySelectorAll('div.adn');

    messages.forEach((row) => {
        const body = row.querySelector('.a3s');
        if (!body) return;

        // Skip if already injected
        if (row.classList.contains(STATS_INJECT_CLASS)) return;

        const imgs = body.querySelectorAll('img');
        let trackId = null;

        // Scan images but STRICTLY EXCLUDE those inside quoted text.
        let uniquePixels: { id: string }[] = [];

        for (const img of imgs) {
            if (img.closest('.gmail_quote') || img.closest('.im')) {
                continue;
            }

            const rawSrc = img.src;
            let decodedSrc = rawSrc;
            try { decodedSrc = decodeURIComponent(rawSrc); } catch { }

            const uuidRegex = /(?:track(?:%2F|\/)|id=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
            const match = rawSrc.match(uuidRegex) || decodedSrc.match(uuidRegex);

            if (match) {
                uniquePixels.push({ id: match[1] });
            }
        }

        if (uniquePixels.length > 0) {
            trackId = uniquePixels[0].id;
        }

        if (trackId) {
            // Find Injection Point: .gH (Date/Header) prioritized
            const dateElement = row.querySelector('.gH');
            const subjectHeader = row.closest('.gs')?.parentElement?.querySelector('h2.hP');
            const anchor = dateElement || subjectHeader;

            if (anchor && anchor.parentElement) {
                const statsContainer = document.createElement('span');
                statsContainer.style.marginLeft = '10px';
                statsContainer.style.display = 'inline-flex';
                statsContainer.style.alignItems = 'center';
                statsContainer.style.verticalAlign = 'middle';
                statsContainer.style.position = 'relative';

                statsContainer.onclick = (e) => e.stopPropagation();

                if (anchor.nextSibling) {
                    anchor.parentElement.insertBefore(statsContainer, anchor.nextSibling);
                } else {
                    anchor.parentElement.appendChild(statsContainer);
                }

                row.classList.add(STATS_INJECT_CLASS);
                createRoot(statsContainer).render(<StatsDisplay trackId={trackId} />);
            }
        }
    });
}

// Watch for DOM changes to inject Stats
const observer = new MutationObserver(() => {
    injectStats();
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    injectStats();
} else {
    window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        injectStats();
    });
}
