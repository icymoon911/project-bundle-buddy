import * as pako from "pako";
import { ImportResolveState, ProcessedImportState } from "../types";

function setItem(key: string, val: object): void {
  try {
    const json = JSON.stringify(val);
    const compressed = pako.deflate(json);
    // Convert Uint8Array to base64 for safe sessionStorage storage
    let binary = "";
    for (let i = 0; i < compressed.length; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    sessionStorage.setItem(key, btoa(binary));
  } catch (e) {
    console.error("Failed to store state in sessionStorage", e);
  }
}

function getItem<T>(key: string): T | undefined {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored == null) {
      return undefined;
    }
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = pako.inflate(bytes);
    return JSON.parse(new TextDecoder().decode(decompressed)) as T;
  } catch (e) {
    console.error("Failed to retrieve state from sessionStorage", e);
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
  return getItem<ImportResolveState>(key);
}

export function stateFromProcessedKey(
  key: string
): ProcessedImportState | undefined {
  return getItem<ProcessedImportState>(key);
}
