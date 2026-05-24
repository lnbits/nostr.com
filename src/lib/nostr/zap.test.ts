import { describe, expect, it } from 'vitest';
import { decodeLnurl, encodeLnurl, lnurlPayUrlFromProfile } from './zap';

describe('NIP-57 zap helpers', () => {
  it('turns lud16 lightning addresses into LNURL-pay endpoints', () => {
    expect(lnurlPayUrlFromProfile({ pubkey: 'pubkey', lud16: 'Satoshi@GetAlby.com' })).toBe('https://getalby.com/.well-known/lnurlp/Satoshi');
  });

  it('round-trips LNURL bech32 values', () => {
    const payUrl = 'https://example.com/.well-known/lnurlp/alice';
    const encoded = encodeLnurl(payUrl);
    expect(encoded.startsWith('lnurl1')).toBe(true);
    expect(decodeLnurl(encoded)).toBe(payUrl);
    expect(lnurlPayUrlFromProfile({ pubkey: 'pubkey', lud06: encoded.toUpperCase() })).toBe(payUrl);
  });
});
