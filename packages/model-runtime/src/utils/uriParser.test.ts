import { describe, expect, it, vi } from 'vitest';

import { ssrfSafeFetch } from '@lobechat/ssrf-safe-fetch';

import { parseDataUri, validateExternalUrl } from './uriParser';

vi.mock('@lobechat/ssrf-safe-fetch', () => ({
  ssrfSafeFetch: vi.fn(),
}));

describe('parseDataUri', () => {
  it('should parse a valid data URI', () => {
    const dataUri = 'data:image/png;base64,abc';
    const result = parseDataUri(dataUri);
    expect(result).toEqual({ base64: 'abc', mimeType: 'image/png', type: 'base64' });
  });

  it('should parse a valid URL', () => {
    const url = 'https://example.com/image.jpg';
    const result = parseDataUri(url);
    expect(result).toEqual({ base64: null, mimeType: null, type: 'url' });
  });

  it('should return null for an invalid input', () => {
    const invalidInput = 'invalid-data';
    const result = parseDataUri(invalidInput);
    expect(result).toEqual({ base64: null, mimeType: null, type: null });
  });

  it('should handle an empty input', () => {
    const emptyInput = '';
    const result = parseDataUri(emptyInput);
    expect(result).toEqual({ base64: null, mimeType: null, type: null });
  });
});

describe('validateExternalUrl', () => {
  it('should mark oversized files as too large regardless of content type', async () => {
    vi.mocked(ssrfSafeFetch).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-length': String(120 * 1024 * 1024),
        'content-type': 'audio/mpeg',
      }),
      status: 200,
      statusText: 'OK',
    } as Response);

    const result = await validateExternalUrl('https://example.com/large-audio.mp3');

    expect(result.isValid).toBe(false);
    expect(result.isTooLarge).toBe(true);
  });
});
