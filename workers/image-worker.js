self.onmessage = async (e) => {
  const { id, blob, options = {} } = e.data || {};
  try {
    const bitmap = await createImageBitmap(blob);
    let canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    let ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);

    if (options.rotate) {
      const rad = (options.rotate * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const nw = Math.round(canvas.width * cos + canvas.height * sin);
      const nh = Math.round(canvas.width * sin + canvas.height * cos);
      const rCanvas = new OffscreenCanvas(nw, nh);
      const rctx = rCanvas.getContext('2d');
      rctx.translate(nw / 2, nh / 2);
      rctx.rotate(rad);
      rctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      canvas = rCanvas;
      ctx = rctx;
    }

    if (options.brightness || options.contrast || options.removeWhite) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const b = options.brightness ?? 1;
      const c = options.contrast ?? 1;
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], bl = data[i + 2];
        if (options.removeWhite && r > 235 && g > 235 && bl > 235) {
          data[i + 3] = 0;
          continue;
        }
        r = Math.min(255, Math.max(0, ((r - 128) * c + 128) * b));
        g = Math.min(255, Math.max(0, ((g - 128) * c + 128) * b));
        bl = Math.min(255, Math.max(0, ((bl - 128) * c + 128) * b));
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = bl;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    if (options.maxDimension && Math.max(canvas.width, canvas.height) > options.maxDimension) {
      const scale = options.maxDimension / Math.max(canvas.width, canvas.height);
      const nw = Math.round(canvas.width * scale);
      const nh = Math.round(canvas.height * scale);
      const dCanvas = new OffscreenCanvas(nw, nh);
      const dctx = dCanvas.getContext('2d');
      dctx.imageSmoothingEnabled = true;
      dctx.imageSmoothingQuality = 'high';
      dctx.drawImage(canvas, 0, 0, nw, nh);
      canvas = dCanvas;
    }

    const quality = options.quality ?? 0.85;
    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });

    const thumbW = 200;
    const thumbH = Math.round(200 * canvas.height / canvas.width);
    const thumbCanvas = new OffscreenCanvas(thumbW, thumbH);
    const tctx = thumbCanvas.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(canvas, 0, 0, thumbW, thumbH);
    const thumbBlob = await thumbCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const thumbDataUrl = await blobToDataURL(thumbBlob);

    self.postMessage({
      id,
      ok: true,
      blob: outBlob,
      width: canvas.width,
      height: canvas.height,
      thumbDataUrl,
    });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};

const blobToDataURL = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });