// Key Manager - AES-256 key generation and storage
const KEY_STORAGE_KEY = 'hermes_enc_key_v1';

export const keyManager = {
  // Generate a new AES-256 key
  async generateKey() {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true, // extractable
      ['encrypt', 'decrypt']
    );
    return key;
  },
  
  // Export key to Base64 string
  async exportKey(key) {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  },
  
  // Import key from Base64 string
  async importKey(base64Key) {
    const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  },
  
  // Get existing key or create new one
  async getOrCreateKey() {
    const stored = localStorage.getItem(KEY_STORAGE_KEY);
    if (stored) {
      return await this.importKey(stored);
    }
    const key = await this.generateKey();
    const exported = await this.exportKey(key);
    localStorage.setItem(KEY_STORAGE_KEY, exported);
    return key;
  },
  
  // Check if key exists
  hasKey() {
    return !!localStorage.getItem(KEY_STORAGE_KEY);
  },
  
  // Delete key (dangerous!)
  deleteKey() {
    localStorage.removeItem(KEY_STORAGE_KEY);
  }
};