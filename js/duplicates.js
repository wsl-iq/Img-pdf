import { hashImage } from './cache.js';

const knownHashes = new Map();

export const register = async (item) => {
  const hash = await hashImage(item.file);
  const existing = knownHashes.get(hash);
  knownHashes.set(hash, item.id);
  return existing ? { duplicateOf: existing, hash } : { hash };
};

export const unregister = (id) => {
  for (const [hash, hid] of knownHashes) {
    if (hid === id) knownHashes.delete(hash);
  }
};

export const clearAll = () => knownHashes.clear();