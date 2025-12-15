
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

    // Reset time to midnight for comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) {
        return `Today, ${timeStr}`;
    } else if (diffDays === 1) {
        return `Yesterday, ${timeStr}`;
    } else {
        const dateStr = date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
        return `${dateStr}, ${timeStr}`;
    }
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
