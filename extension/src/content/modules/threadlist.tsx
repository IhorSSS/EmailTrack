import { createRoot } from 'react-dom/client';
import { LocalStorageService } from '../../services/LocalStorageService';
import { I18nProvider } from '../../hooks/useTranslation';
import { logger } from '../../utils/logger';
import { CONSTANTS } from '../../config/constants';
import StatusCheckmark from '../../components/common/StatusCheckmark';
import type { LocalEmailMetadata } from '../../types';

/**
 * Threadlist Injector
 * Scans the Gmail thread list and injects status checkmarks for tracked emails.
 */
export async function injectThreadlistStatus() {
    if (!chrome.runtime?.id) return;

    try {
        const rowElements = document.querySelectorAll(CONSTANTS.GMAIL_SELECTORS.THREAD_ROW);
        if (rowElements.length === 0) return;

        const cachedEmails = await LocalStorageService.getCachedEmails();
        if (cachedEmails.length === 0) return;

        // 1. Pre-process cache (Parsing once, not in loop)
        const threadIdMap = new Map<string, LocalEmailMetadata>();
        const subjectMap = new Map<string, LocalEmailMetadata>();

        cachedEmails.forEach(e => {
            const time = new Date(e.createdAt).getTime();
            
            if (e.threadId) {
                const existing = threadIdMap.get(e.threadId);
                if (!existing || time > new Date(existing.createdAt).getTime()) {
                    threadIdMap.set(e.threadId, e);
                }
            }
            
            const cleanSub = e.subject.replace(CONSTANTS.REGEX.SUBJECT_CLEANUP, '').trim().toLowerCase();
            const existingSub = subjectMap.get(cleanSub);
            if (!existingSub || time > new Date(existingSub.createdAt).getTime()) {
                subjectMap.set(cleanSub, e);
            }
        });

        // 2. Scan rows
        rowElements.forEach((row) => {
            const htmlRow = row as HTMLElement;
            const match = findMatchForRow(htmlRow, threadIdMap, subjectMap);

            if (match) {
                const status: 'sent' | 'opened' = (match.openCount && match.openCount > 0) ? 'opened' : 'sent';
                const existingStatus = htmlRow.getAttribute(CONSTANTS.DATA_ATTRS.ET_STATUS);

                if (existingStatus !== status) {
                    injectBadgeForRow(htmlRow, match, status);
                }
            }
        });
    } catch (e) {
        logger.error('[Threadlist] Injection loop failed:', e);
    }
}

/**
 * Pure utility to find a match for a given row element.
 */
function findMatchForRow(
    row: HTMLElement, 
    threadIdMap: Map<string, LocalEmailMetadata>, 
    subjectMap: Map<string, LocalEmailMetadata>
): LocalEmailMetadata | null {
    // 1. Match by Thread ID
    const threadId = row.getAttribute('data-thread-id');
    if (threadId && threadIdMap.has(threadId)) {
        return threadIdMap.get(threadId)!;
    }

    // 2. Fallback: Match by Subject (Case-insensitive)
    const subjectEl = row.querySelector(CONSTANTS.GMAIL_SELECTORS.THREAD_SUBJECT);
    const subject = subjectEl?.textContent?.trim();
    if (subject) {
        const cleanSub = subject.replace(CONSTANTS.REGEX.SUBJECT_CLEANUP, '').trim().toLowerCase();
        return subjectMap.get(cleanSub) || null;
    }

    return null;
}

function injectBadgeForRow(row: HTMLElement, email: LocalEmailMetadata, status: 'sent' | 'opened') {
    const anchor = row.querySelector(CONSTANTS.GMAIL_SELECTORS.THREAD_STATUS_CONTAINER);
    if (!anchor) return;

    // Remove existing if updating
    const existing = anchor.querySelector(`.${CONSTANTS.CSS_CLASSES.THREAD_BADGE_ROOT}`);
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = CONSTANTS.CSS_CLASSES.THREAD_BADGE_ROOT;
    
    // Checkmarks should not trigger row click
    container.onclick = (e) => e.stopPropagation();

    anchor.appendChild(container);
    row.setAttribute(CONSTANTS.DATA_ATTRS.ET_STATUS, status);

    createRoot(container).render(
        <I18nProvider>
            <StatusCheckmark status={status} lastOpenedAt={email.lastOpenedAt} compact={true} />
        </I18nProvider>
    );
}
