declare global {
  interface Window {
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>;
      nip04?: unknown;
      nip44?: unknown;
    };
  }
}

export {};
