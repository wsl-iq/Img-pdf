let worker = null;
let taskId = 0;
const pending = new Map();

const ensureWorker = () => {
  if (worker) return worker;
  worker = new Worker('workers/imageWorker.js');
  worker.onmessage = (e) => {
    const { id } = e.data || {};
    const cb = pending.get(id);
    if (cb) {
      pending.delete(id);
      cb(e.data);
    }
  };
  worker.onerror = (err) => {
    console.error('worker error', err);
  };
  return worker;
};

export const processImage = (blob, options = {}) =>
  new Promise((resolve, reject) => {
    const w = ensureWorker();
    const id = ++taskId;
    pending.set(id, (data) => {
      if (data.ok) resolve(data);
      else reject(new Error(data.error || 'worker failed'));
    });
    w.postMessage({ id, blob, options });
  });

export const hashImage = async (blob) => {
  const slice = blob.slice(0, Math.min(blob.size, 65536));
  const buf = await slice.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};