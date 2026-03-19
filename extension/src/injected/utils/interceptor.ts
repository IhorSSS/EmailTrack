
import { createPixel } from './pixel';
import { extractSenderEmail, getBodyPreviewLength } from './dom';
import { extractCleanBody, deepModify, type InjectionResult } from './extraction';
import { CONSTANTS } from '../../config/constants';

export interface InterceptionConfig {
    HOST: string;
    PIXEL_BASE: string;
}

export function handleSendInterceptor(
    config: InterceptionConfig,
    data: Record<string, unknown> | null,
    xhr: { xhrParams?: { body_params?: unknown } } | null,
    logger: { log: (...args: unknown[]) => void, error: (...args: unknown[]) => void, isDebug?: () => boolean },
    gmail?: { get: { email_id: () => string } }
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
            } catch (e: unknown) { logger.error(e); }
        }

        const senderEmail = extractSenderEmail();

        // Parse recipient - data.to can be array of objects {email, name} or strings
        const recipients = data?.to || [];
        const ccRecipients = data?.cc || [];
        const bccRecipients = data?.bcc || [];

        const formatRecipients = (list: unknown) => {
            if (!Array.isArray(list) || list.length === 0) return null;
            return list.map((r: unknown) => {
                if (typeof r === 'string') return r;
                if (r && typeof r === 'object') {
                    const record = r as Record<string, string>;
                    return record.email || record.address || record.name || JSON.stringify(r);
                }
                return String(r);
            }).join(', ');
        };

        const recipientStr = formatRecipients(recipients);
        const ccStr = formatRecipients(ccRecipients);
        const bccStr = formatRecipients(bccRecipients);

        const eventData = {
            id: trackId,
            subject: data?.subject,
            recipient: recipientStr,
            cc: ccStr,
            bcc: bccStr,
            body: bodyPreview || null,
            sender: senderEmail,
            threadId: gmail?.get?.email_id() || null
        };

        // SECURITY: Restrict postMessage to origin
        window.postMessage({
            type: CONSTANTS.MESSAGES.EMAILTRACK_REGISTER,
            detail: eventData
        }, window.location.origin);
    }

    return true; // Allow send to proceed
}
