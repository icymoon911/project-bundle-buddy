import * as pako from "pako";
import { ImportResolveState, ProcessedImportState } from "../types";

/**
 * Convert a Uint8Array to a base64 string for safe storage in sessionStorage.
 */
function uint8ToBase64(arr: Uint8Array): string {
  return btoa(
    Array.from(arr)
      .map((b) => String.fromCharCode(b))
      .join("")
  );
}

/**
 * Convert a base64 string back to a Uint8Array.
 */
function base64ToUint8(str: string): Uint8Array {
  const binary = atob(str);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Serialize, compress, and store a value in sessionStorage.
 * Uses pako deflate + base64 encoding to stay within the ~5MB
 * sessionStorage limit even for large ProcessedImportState payloads.
 */
function setItem(key: string, val: object): void {
  try {
    const json = JSON.stringify(val);
    const compressed = pako.deflate(json);
    const encoded = uint8ToBase64(compressed);
    sessionStorage.setItem(key, encoded);
  } catch (e) {
    console.error("Failed to store state in sessionStorage:", e);
  }
}

/**
 * Retrieve, decompress, and deserialize a value from sessionStorage.
 */
function getItem(key: string): any | undefined {
  try {
    const encoded = sessionStorage.getItem(key);
    if (encoded == null) {
      return undefined;
    }
    const compressed = base64ToUint8(encoded);
    const json = pako.inflate(compressed, { to: "string" });
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to retrieve state from sessionStorage:", e);
    return undefined;
  }
}

export function storeResolveState(state: ImportResolveState): { key: string } {
  const key = toResolveKey();
  setItem(key, state);
  return { key };
}

function toResolveKey(): string {
  return `/_/resolve`;
}

function toProcessedKey(): string {
  return `/bundle`;
}

export function storeProcessedState(
  state: ProcessedImportState
): { key: string } {
  const key = toProcessedKey();
  setItem(key, state);
  return { key };
}

export function stateFromResolveKey(
  key: string
): ImportResolveState | undefined {
  const state = getItem(key);
  if (state == null) {
    return undefined;
  }

  return state;
}

export function stateFromProcessedKey(
  key: string
): ProcessedImportState | undefined {
  const state = getItem(key);
  if (state == null) {
    return undefined;
  }

  return state;
}
