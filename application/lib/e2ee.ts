export type EncryptedPayload = {
  encryptedKey: string;
  iv: string;
  content: string;
};

const RSA_OAEP_ALGORITHM = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
} as const;
const AES_GCM_ALGORITHM = { name: "AES-GCM", length: 256 } as const;
const AES_GCM_IV_LENGTH = 12;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function base64ToBytes(encoded: string) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export async function generateRecipientKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    RSA_OAEP_ALGORITHM,
    true,
    ["encrypt", "decrypt"],
  )) as CryptoKeyPair;
}

export async function exportPublicKey(publicKey: CryptoKey) {
  const exported = await crypto.subtle.exportKey("spki", publicKey);
  return bytesToBase64(new Uint8Array(exported));
}

export async function exportPrivateKey(privateKey: CryptoKey) {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return bytesToBase64(new Uint8Array(exported));
}

export async function importPublicKey(encodedPublicKey: string) {
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(encodedPublicKey),
    RSA_OAEP_ALGORITHM,
    true,
    ["encrypt"],
  );
}

export async function importPrivateKey(encodedPrivateKey: string) {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(encodedPrivateKey),
    RSA_OAEP_ALGORITHM,
    true,
    ["decrypt"],
  );
}

export async function encryptTextForRecipient(
  publicKey: CryptoKey,
  plaintext: string,
) {
  const aesKey = await crypto.subtle.generateKey(AES_GCM_ALGORITHM, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const encodedText = new TextEncoder().encode(plaintext);

  const content = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedText,
  );

  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    RSA_OAEP_ALGORITHM,
    publicKey,
    rawAesKey,
  );

  return {
    encryptedKey: bytesToBase64(new Uint8Array(encryptedKey)),
    iv: bytesToBase64(iv),
    content: bytesToBase64(new Uint8Array(content)),
  } satisfies EncryptedPayload;
}

export async function decryptTextFromRecipient(
  privateKey: CryptoKey,
  payload: EncryptedPayload,
) {
  const aesKeyBytes = await crypto.subtle.decrypt(
    RSA_OAEP_ALGORITHM,
    privateKey,
    base64ToBytes(payload.encryptedKey),
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    aesKey,
    base64ToBytes(payload.content),
  );

  return new TextDecoder().decode(plaintext);
}