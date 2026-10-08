import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersLeanMedia, prefersReducedData } from './clientCapabilities';

vi.mock('$app/environment', () => ({ browser: true }));

function setClient({ connection, touch }: { connection?: { saveData?: boolean; effectiveType?: string }; touch: boolean }) {
  Object.defineProperty(navigator, 'connection', { value: connection, configurable: true });
  window.matchMedia = vi.fn().mockReturnValue({ matches: touch }) as unknown as typeof window.matchMedia;
}

describe('client capabilities', () => {
  afterEach(() => Reflect.deleteProperty(navigator, 'connection'));

  it('treats a touch device on a fast connection as lean but not data-constrained', () => {
    setClient({ connection: { saveData: false, effectiveType: '4g' }, touch: true });
    expect(prefersLeanMedia()).toBe(true);
    expect(prefersReducedData()).toBe(false);
  });

  it('treats Data Saver and slow connections as reduced data', () => {
    setClient({ connection: { saveData: true, effectiveType: '4g' }, touch: false });
    expect(prefersReducedData()).toBe(true);
    setClient({ connection: { saveData: false, effectiveType: '3g' }, touch: false });
    expect(prefersReducedData()).toBe(true);
    expect(prefersLeanMedia()).toBe(true);
  });

  it('leaves a desktop on a fast connection unrestricted', () => {
    setClient({ connection: { saveData: false, effectiveType: '4g' }, touch: false });
    expect(prefersLeanMedia()).toBe(false);
    expect(prefersReducedData()).toBe(false);
  });
});
