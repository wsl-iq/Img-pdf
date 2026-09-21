import { loadImage } from './utils.js';

const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const MARGINS = {
  '0': 0,
  small: 18,
  medium: 36,
};

const convertToJpeg = async (item, quality) => {
  const img = await loadImage(item.url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', parseFloat(quality))
  );
  if (!blob) throw new Error('Canvas toBlob failed');
  const arrayBuffer = await blob.arrayBuffer();
  // Free canvas memory
  canvas.width = 0;
  canvas.height = 0;
  return {
    data: new Uint8Array(arrayBuffer),
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
};

export const buildPdf = async (items, options) => {
  const { pageSize = 'a4', orientation = 'portrait', margin = 'small', quality = '0.85' } = options;
  const marginPts = MARGINS[margin] ?? MARGINS.small;

  // Convert all images to JPEG
  const jpegImages = [];
  for (const item of items) {
    jpegImages.push(await convertToJpeg(item, quality));
  }

  const baseSize =
    pageSize === 'auto'
      ? { width: jpegImages[0].width * 0.75, height: jpegImages[0].height * 0.75 }
      : { ...(PAGE_SIZES[pageSize] || PAGE_SIZES.a4) };

  const catalogId = 1;
  const pagesId = 2;
  let nextId = 3;

  const pageEntries = [];

  for (let i = 0; i < jpegImages.length; i++) {
    const jpeg = jpegImages[i];
    let pw = baseSize.width;
    let ph = baseSize.height;

    if (pageSize === 'auto') {
      pw = jpeg.width * 0.75;
      ph = jpeg.height * 0.75;
    }
    if (orientation === 'landscape') {
      [pw, ph] = [ph, pw];
    } else if (orientation === 'auto') {
      const imgLandscape = jpeg.width > jpeg.height;
      const pageIsLandscape = pw > ph;
      if (imgLandscape !== pageIsLandscape) [pw, ph] = [ph, pw];
    }

    const availW = pw - marginPts * 2;
    const availH = ph - marginPts * 2;
    const scale = Math.min(availW / jpeg.width, availH / jpeg.height);
    const drawW = jpeg.width * scale;
    const drawH = jpeg.height * scale;
    const offsetX = marginPts + (availW - drawW) / 2;
    const offsetY = marginPts + (availH - drawH) / 2;

    const pageObjId = nextId++;
    const contentObjId = nextId++;
    const imgObjId = nextId++;

    const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${offsetX.toFixed(2)} ${offsetY.toFixed(2)} cm\n/Im${i} Do\nQ`;

    pageEntries.push({
      pageObjId,
      contentObjId,
      imgObjId,
      pw,
      ph,
      contentStream,
      imgDict: `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.data.length} >>`,
      jpegData: jpeg.data,
      imgName: `Im${i}`,
    });
  }

  const chunks = [];
  const encoder = new TextEncoder();
  let offset = 0;
  const offsets = {};

  const addString = (str) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    offset += bytes.length;
  };

  const addBytes = (bytes) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  addString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  offsets[catalogId] = offset;
  addString(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj\n`);

  offsets[pagesId] = offset;
  const kids = pageEntries.map((p) => `${p.pageObjId} 0 R`).join(' ');
  addString(
    `${pagesId} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageEntries.length} >>\nendobj\n`
  );

  for (const entry of pageEntries) {
    offsets[entry.pageObjId] = offset;
    addString(
      `${entry.pageObjId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${entry.pw.toFixed(2)} ${entry.ph.toFixed(2)}] /Contents ${entry.contentObjId} 0 R /Resources << /XObject << /${entry.imgName} ${entry.imgObjId} 0 R >> >> >>\nendobj\n`
    );

    offsets[entry.contentObjId] = offset;
    const streamBytes = encoder.encode(entry.contentStream);
    addString(`${entry.contentObjId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    addBytes(streamBytes);
    addString(`\nendstream\nendobj\n`);

    offsets[entry.imgObjId] = offset;
    addString(`${entry.imgObjId} 0 obj\n${entry.imgDict}\nstream\n`);
    addBytes(entry.jpegData);
    addString(`\nendstream\nendobj\n`);
  }

  const xrefOffset = offset;
  const totalObjects = nextId;
  const xrefLines = [`xref\n0 ${totalObjects}\n`, `0000000000 65535 f \n`];
  for (let i = 1; i < totalObjects; i++) {
    xrefLines.push(`${(offsets[i] || 0).toString().padStart(10, '0')} 00000 n \n`);
  }
  addString(xrefLines.join(''));

  addString(
    `trailer\n<< /Size ${totalObjects} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  // Combine
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([result], { type: 'application/pdf' });
};