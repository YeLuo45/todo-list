// Crypto utilities - encrypt/decrypt using Web Crypto API

// Generate random IV
function generateIV() {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

// Encrypt data with AES-GCM
export async function encrypt(data, key) {
  const iv = generateIV();
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt data with AES-GCM
export async function decrypt(encryptedBase64, key) {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  const decoded = new TextDecoder().decode(decrypted);
  return JSON.parse(decoded);
}