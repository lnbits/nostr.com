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
    nostrDesktopUpload?: {
      uploadToNostrBuild(payload: {
        name: string;
        type: string;
        size: number;
        mediaType: 'avatar' | 'banner' | 'media';
        authorization: string;
        bytes: ArrayBuffer;
      }): Promise<{ ok: boolean; status: number; data?: unknown; location?: string; error?: string }>;
    };
    nostrDesktopNotifications?: {
      isAvailable(): Promise<boolean>;
      show(payload: { title: string; body: string; route: string }): Promise<boolean>;
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
