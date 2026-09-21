import { generateId, loadImage } from './utils.js';

const SUPPORTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGES = 100;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

let items = [];

const validateFile = (file) => {
  if (!file || !file.type) {
    return { valid: false, reason: 'ملف غير صالح' };
  }
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return {
      valid: false,
      reason: `صيغة غير مدعومة: ${file.type.split('/')[1]?.toUpperCase() || 'غير معروفة'}`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      reason: `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} م.ب)`,
    };
  }
  return { valid: true };
};

export const addFiles = async (fileList) => {
  const files = Array.from(fileList);
  const results = { added: 0, rejected: [] };

  if (items.length >= MAX_IMAGES) {
    return {
      added: 0,
      rejected: [{ name: 'الحد الأقصى', reason: `لا يمكن إضافة أكثر من ${MAX_IMAGES} صورة` }],
    };
  }

  const remaining = MAX_IMAGES - items.length;
  const toProcess = files.slice(0, remaining);

  for (const file of toProcess) {
    const validation = validateFile(file);
    if (!validation.valid) {
      results.rejected.push({ name: file.name, reason: validation.reason });
      continue;
    }

    try {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      items.push({
        id: generateId(),
        file,
        url,
        name: file.name,
        size: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: file.type,
      });
      results.added++;
    } catch {
      results.rejected.push({ name: file.name, reason: 'فشل في قراءة الصورة' });
    }
  }

  if (files.length > remaining) {
    results.rejected.push({
      name: 'ملفات إضافية',
      reason: `تم تجاهل ${files.length - remaining} ملف بسبب حد الصور`,
    });
  }

  return results;
};

export const remove = (id) => {
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  URL.revokeObjectURL(items[idx].url);
  items.splice(idx, 1);
  return true;
};

export const clearAll = () => {
  items.forEach((item) => URL.revokeObjectURL(item.url));
  items = [];
};

export const move = (fromIndex, toIndex) => {
  if (fromIndex < 0 || fromIndex >= items.length) return false;
  if (toIndex < 0 || toIndex >= items.length) return false;
  if (fromIndex === toIndex) return false;
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return true;
};

export const moveUp = (id) => {
  const idx = items.findIndex((i) => i.id === id);
  return idx > 0 ? move(idx, idx - 1) : false;
};

export const moveDown = (id) => {
  const idx = items.findIndex((i) => i.id === id);
  return idx < items.length - 1 ? move(idx, idx + 1) : false;
};

export const getAll = () => [...items];
export const getById = (id) => items.find((i) => i.id === id);
export const count = () => items.length;
export const cleanup = () => items.forEach((item) => URL.revokeObjectURL(item.url));

export const SUPPORTED = SUPPORTED_TYPES;
export const MAX = MAX_IMAGES;