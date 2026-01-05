/**
 * Sensitive keys to mask in logs
 */
const SENSITIVE_KEYS = ['subject', 'body', 'recipient', 'cc', 'bcc', 'token', 'authorization', 'password', 'user', 'owneremail'];

/**
 * Simple sanitizer to mask emails and sensitive data in logs
 */
function sanitize(arg: any): any {
    if (typeof arg === 'string') {
        // Simple email mask: a***b@c.com
        return arg.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, (_match, p1, p2) => {
            if (p1.length <= 2) return `***@${p2}`;
            return `${p1[0]}***${p1[p1.length - 1]}@${p2}`;
        });
    }

    if (arg && typeof arg === 'object') {
        // Handle Error objects specifically
        if (arg instanceof Error) {
            return {
                message: sanitize(arg.message),
                name: arg.name,
                stack: '[MASKED]' // Stacks often contain paths/internal info
            };
        }

        if (Array.isArray(arg)) {
            return arg.map(sanitize);
        }

        const sanitized: any = {};
        for (const key in arg) {
            if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
                sanitized[key] = '[MASKED]';
            } else {
                sanitized[key] = sanitize(arg[key]);
            }
        }
        return sanitized;
    }
    return arg;
}

export const logger = {
    log: (...args: any[]) => {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
            console.log(...args.map(sanitize));
        }
    },
    info: (...args: any[]) => {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
            console.info(...args.map(sanitize));
        }
    },
    warn: (...args: any[]) => {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
            console.warn(...args.map(sanitize));
        }
    },
    error: (...args: any[]) => {
        console.error(...args.map(sanitize));
    }
};

