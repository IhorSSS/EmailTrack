import { describe, it, expect } from 'vitest';
import { extractCleanBody, deepModify } from './extraction';
import { API_CONFIG } from '../../config/api';

describe('extraction utils', () => {
    describe('extractCleanBody', () => {
        it('should return empty string for null/undefined', () => {
            expect(extractCleanBody(null as any)).toBe('');
            expect(extractCleanBody(undefined as any)).toBe('');
        });

        it('should strip basic HTML tags', () => {
            const html = '<p>Hello <b>World</b></p>';
            expect(extractCleanBody(html)).toBe('Hello World');
        });

        it('should remove gmail quotes', () => {
            const html = '<div>New Content</div><div class="gmail_quote">Old Content</div>';
            expect(extractCleanBody(html)).toBe('New Content');
        });

        it('should remove blockquotes', () => {
            const html = '<div>Reply</div><blockquote>Original</blockquote>';
            expect(extractCleanBody(html)).toBe('Reply');
        });

        it('should handle complex nesting', () => {
            const html = `
                <div>
                    Hello
                    <br>
                    World
                </div>
                <div class="gmail_quote">
                    On Mon, Dec 12... wrote:
                    <blockquote>
                        Old msg
                    </blockquote>
                </div>
            `;
            const result = extractCleanBody(html);
            expect(result).toContain('Hello');
            expect(result).toContain('World');
            expect(result).not.toContain('Old msg');
        });
    });

    describe('deepModify', () => {
        const pixelTag = '<img src="pixel.gif" />';

        it('should inject pixel into the longest string body', () => {
            const obj = {
                subject: 'Test',
                body_params: {
                    html: '<div>This is a long body content that receives the pixel.</div>',
                    text: 'Short'
                }
            };

            const result = deepModify(obj, pixelTag);

            expect(result.success).toBe(true);
            expect(obj.body_params.html).toContain(pixelTag);
            expect(obj.body_params.text).not.toContain(pixelTag);
        });

        it('should remove old pixels before injecting new one', () => {
            const oldPixel = `<img src="${API_CONFIG.ENDPOINTS.PIXEL_PATH}?id=old" />`;
            const obj = {
                body: `<div>Content ${oldPixel}</div>`
            };

            const result = deepModify(obj, pixelTag);

            expect(result.success).toBe(true);
            expect(obj.body).toContain(pixelTag);
            expect(obj.body).not.toContain('id=old');
        });

        it('should handle nested objects', () => {
            const obj = {
                nested: {
                    deep: {
                        html: '<div>Deep content goes here.</div>'
                    }
                }
            };

            const result = deepModify(obj, pixelTag);

            expect(result.success).toBe(true);
            expect(obj.nested.deep.html).toContain(pixelTag);
        });
    });
});
