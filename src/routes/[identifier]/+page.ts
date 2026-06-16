import { nips } from '$lib/nips';

export const prerender = true;

export function entries() {
  return nips.map((nip) => ({ identifier: nip.slug }));
}
