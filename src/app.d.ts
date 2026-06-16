declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform(): boolean;
    };
    nostrDesktopSecureStorage?: {
      isAvailable(): Promise<boolean>;
      read(): Promise<string | null>;
      write(value: string): Promise<boolean>;
      clear(): Promise<void>;
    };
    nostr?: {
      getPublicKey(): Promise<string>;
      signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>;
      nip04?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
      nip44?: {
        encrypt(pubkey: string, plaintext: string): Promise<string>;
        decrypt(pubkey: string, ciphertext: string): Promise<string>;
      };
    };
  }
}

export {};
