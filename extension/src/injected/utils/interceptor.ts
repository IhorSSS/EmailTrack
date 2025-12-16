
import { createPixel } from './pixel';
import { extractSenderEmail, getBodyPreviewLength } from './dom';
import { extractCleanBody, deepModify, type InjectionResult } from './extraction';

export interface InterceptionConfig {
    HOST: string;
    PIXEL_BASE: string;
}

export function handleSendInterceptor(
    config: InterceptionConfig,
    data: any,
    xhr: any,
    logger: any
): boolean {
    const trackId = crypto.randomUUID();
    const pixelTag = createPixel(trackId, config.HOST, config.PIXEL_BASE);

    let injectionResult: InjectionResult = { success: false, extractedBody: null };

    if (xhr && xhr.xhrParams && xhr.xhrParams.body_params) {
        injectionResult = deepModify(xhr.xhrParams.body_params, pixelTag);
    } else if (data) {
        injectionResult = deepModify(data, pixelTag);
    }

    if (injectionResult.success && trackId) {
        logger.log("EmailTrack: [Interceptor] 📧 SEND INTERCEPTED & INJECTED");

        let bodyPreview: string | null = null;
        const currentPreviewLength = getBodyPreviewLength();

        if (currentPreviewLength !== 0 && injectionResult.extractedBody) {
            try {
                let plainText = extractCleanBody(injectionResult.extractedBody);
                if (plainText.length === 0) {
                    plainText = injectionResult.extractedBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
                }

                if (currentPreviewLength === -1) {
                    bodyPreview = plainText;
                } else {
                    bodyPreview = plainText.length > currentPreviewLength
                        ? plainText.substring(0, currentPreviewLength) + '...'
                        : plainText;
                }
            } catch (e: any) { console.error(e); }
        }

        const senderEmail = extractSenderEmail();

        // Parse recipient - data.to can be array of objects {email, name} or strings
        const recipients = data.to || [];
        let recipientStr = 'Unknown';

        if (Array.isArray(recipients) && recipients.length > 0) {
            recipientStr = recipients.map((r: any) => {
                if (typeof r === 'string') return r;
                if (r && typeof r === 'object') {
                    // Gmail format: {email: "...", name: "..."}
                    return r.email || r.address || r.name || JSON.stringify(r);
                }
                return String(r);
            }).join(', ');
        }

        const eventData = {
            id: trackId,
            subject: data.subject || '(No Subject)',
            recipient: recipientStr,
            body: bodyPreview || null,
            sender: senderEmail || 'Unknown'
        };

        // SECURITY: Restrict postMessage to origin
        window.postMessage({
            type: 'EMAILTRACK_REGISTER',
            detail: eventData
        }, window.location.origin);
    }

    return true; // Allow send to proceed
}
