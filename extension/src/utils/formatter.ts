
/**
 * Tries to parse the recipient field.
 * The backend might return a JSON string like:
 * '[{"name":"Example","address":"example@gmail.com"}]'
 * or just a plain string.
 */
export const formatRecipient = (recipientRaw: string): string => {
    if (!recipientRaw) return 'Unknown Recipient';

    try {
        // Check if it looks like JSON
        if (recipientRaw.trim().startsWith('[')) {
            const parsed = JSON.parse(recipientRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const first = parsed[0];
                if (first.name && first.name !== first.address) {
                    return `${first.name} <${first.address}>`;
                }
                return first.address || first.name || 'Unknown';
            }
        }
    } catch (e) {
        // If parse fails, fall back to returning raw string
        console.warn('Failed to parse recipient:', e);
    }

    // Fallback: remove any array brackets if they exist as string text but failed parse
    return recipientRaw.replace(/[\[\]"]/g, '');
};

export const formatDateTime = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const formatFullDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};
