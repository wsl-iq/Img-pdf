/**
 * pdf
 * Pure-JS PDF generator with JPEG embedding.
 */

(function () {
  'use strict';

  var App = window.App;
  var Utils = App.Utils;

  var PAGE_SIZES = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612, height: 792 }
  };

  var MARGINS = { '0': 0, small: 18, medium: 36 };

  var COMPRESSION = {
    small: { maxDimension: 1200, quality: 0.7 },
    balanced: { maxDimension: 2000, quality: 0.85 },
    max: { maxDimension: 0, quality: 1 }
  };

  function convertToJpeg(item, quality, maxDimension) {
    return Utils.loadImage(item.url).then(function (img) {
      var w = img.naturalWidth;
      var h = img.naturalHeight;

      var t = item.transforms || {};
      var rotation = t.rotation || 0;
      var brightness = t.brightness === undefined ? 1 : t.brightness;
      var contrast = t.contrast === undefined ? 1 : t.contrast;
      var removeWhite = t.removeWhite || false;

      if (maxDimension > 0 && Math.max(w, h) > maxDimension) {
        var scale = maxDimension / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      var rad = (rotation * Math.PI) / 180;
      var cos = Math.abs(Math.cos(rad));
      var sin = Math.abs(Math.sin(rad));
      var cw = Math.round(w * cos + h * sin);
      var ch = Math.round(w * sin + h * cos);

      var canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);

      if (brightness !== 1 || contrast !== 1 || removeWhite) {
        var imageData = ctx.getImageData(0, 0, cw, ch);
        var data = imageData.data;
        for (var i = 0; i < data.length; i += 4) {
          var r = data[i];
          var g = data[i + 1];
          var b = data[i + 2];
          if (removeWhite && r > 235 && g > 235 && b > 235) {
            data[i + 3] = 0;
            continue;
          }
          r = Math.min(255, Math.max(0, ((r - 128) * contrast + 128) * brightness));
          g = Math.min(255, Math.max(0, ((g - 128) * contrast + 128) * brightness));
          b = Math.min(255, Math.max(0, ((b - 128) * contrast + 128) * brightness));
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          canvas.width = 0;
          canvas.height = 0;
          if (!blob) {
            reject(new Error('encode failed'));
            return;
          }
          blob.arrayBuffer().then(function (ab) {
            resolve({
              data: new Uint8Array(ab),
              width: cw,
              height: ch
            });
          });
        }, 'image/jpeg', quality);
      });
    });
  }

  function escapeText(str) {
    return String(str).replace(/[\\()]/g, '\\$&');
  }

  function buildPdfBytes(jpegs, options) {
    var pageSize = options.pageSize || 'a4';
    var orientation = options.orientation || 'portrait';
    var margin = options.margin || 'small';
    var pageNumbers = options.pageNumbers || false;
    var marginPts = MARGINS[margin] === undefined ? MARGINS.small : MARGINS[margin];

    var baseSize;
    if (pageSize === 'auto') {
      baseSize = { width: jpegs[0].width * 0.75, height: jpegs[0].height * 0.75 };
    } else {
      baseSize = Object.assign({}, PAGE_SIZES[pageSize] || PAGE_SIZES.a4);
    }

    var catalogId = 1;
    var pagesId = 2;
    var fontId = 3;
    var nextId = 4;
    var pages = [];

    for (var i = 0; i < jpegs.length; i++) {
      var jpeg = jpegs[i];
      var pw = baseSize.width;
      var ph = baseSize.height;

      if (pageSize === 'auto') {
        pw = jpeg.width * 0.75;
        ph = jpeg.height * 0.75;
      }

      if (orientation === 'landscape') {
        var tmp1 = pw; pw = ph; ph = tmp1;
      } else if (orientation === 'auto') {
        var imgLand = jpeg.width > jpeg.height;
        var pageLand = pw > ph;
        if (imgLand !== pageLand) {
          var tmp2 = pw; pw = ph; ph = tmp2;
        }
      }

      var availW = pw - marginPts * 2;
      var availH = ph - marginPts * 2;
      var scale = Math.min(availW / jpeg.width, availH / jpeg.height);
      var drawW = jpeg.width * scale;
      var drawH = jpeg.height * scale;
      var offsetX = marginPts + (availW - drawW) / 2;
      var offsetY = marginPts + (availH - drawH) / 2;

      var pageObjId = nextId++;
      var contentObjId = nextId++;
      var imgObjId = nextId++;

      var extra = '';
      if (pageNumbers) {
        var text = 'Page ' + (i + 1) + ' of ' + jpegs.length;
        extra += 'BT /F1 10 Tf ' + (pw / 2 - 30).toFixed(2) + ' 20 Td (' + escapeText(text) + ') Tj ET\n';
      }

      var contentStream = extra +
        'q\n' + drawW.toFixed(2) + ' 0 0 ' + drawH.toFixed(2) + ' ' +
        offsetX.toFixed(2) + ' ' + offsetY.toFixed(2) + ' cm\n/Im' + i + ' Do\nQ';

      pages.push({
        pageObjId: pageObjId,
        contentObjId: contentObjId,
        imgObjId: imgObjId,
        pw: pw,
        ph: ph,
        contentStream: contentStream,
        imgDict: '<< /Type /XObject /Subtype /Image /Width ' + jpeg.width +
          ' /Height ' + jpeg.height +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
          jpeg.data.length + ' >>',
        jpegData: jpeg.data,
        imgName: 'Im' + i
      });
    }

    var chunks = [];
    var encoder = new TextEncoder();
    var offset = 0;
    var offsets = {};

    function addString(str) {
      var bytes = encoder.encode(str);
      chunks.push(bytes);
      offset += bytes.length;
    }

    function addBytes(bytes) {
      chunks.push(bytes);
      offset += bytes.length;
    }

    addString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    offsets[catalogId] = offset;
    addString(catalogId + ' 0 obj\n<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>\nendobj\n');

    offsets[pagesId] = offset;
    var kids = pages.map(function (p) { return p.pageObjId + ' 0 R'; }).join(' ');
    addString(pagesId + ' 0 obj\n<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>\nendobj\n');

    offsets[fontId] = offset;
    addString(fontId + ' 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

    for (var k = 0; k < pages.length; k++) {
      var entry = pages[k];

      offsets[entry.pageObjId] = offset;
      addString(entry.pageObjId + ' 0 obj\n<< /Type /Page /Parent ' + pagesId +
        ' 0 R /MediaBox [0 0 ' + entry.pw.toFixed(2) + ' ' + entry.ph.toFixed(2) +
        '] /Contents ' + entry.contentObjId + ' 0 R /Resources << /XObject << /' +
        entry.imgName + ' ' + entry.imgObjId + ' 0 R >> /Font << /F1 ' + fontId +
        ' 0 R >> >> >>\nendobj\n');

      offsets[entry.contentObjId] = offset;
      var streamBytes = encoder.encode(entry.contentStream);
      addString(entry.contentObjId + ' 0 obj\n<< /Length ' + streamBytes.length + ' >>\nstream\n');
      addBytes(streamBytes);
      addString('\nendstream\nendobj\n');

      offsets[entry.imgObjId] = offset;
      addString(entry.imgObjId + ' 0 obj\n' + entry.imgDict + '\nstream\n');
      addBytes(entry.jpegData);
      addString('\nendstream\nendobj\n');
    }

    var xrefOffset = offset;
    var totalObjects = nextId;
    var xref = 'xref\n0 ' + totalObjects + '\n0000000000 65535 f \n';
    for (var m = 1; m < totalObjects; m++) {
      xref += (offsets[m] || 0).toString().padStart(10, '0') + ' 00000 n \n';
    }
    addString(xref);

    addString('trailer\n<< /Size ' + totalObjects + ' /Root ' + catalogId +
      ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n');

    var total = chunks.reduce(function (sum, c) { return sum + c.length; }, 0);
    var result = new Uint8Array(total);
    var pos = 0;
    for (var n = 0; n < chunks.length; n++) {
      result.set(chunks[n], pos);
      pos += chunks[n].length;
    }

    return result;
  }

  App.PDF = {
    build: function (items, options) {
      options = options || {};
      var quality = options.quality || '0.85';
      var compression = options.compression || 'balanced';

      var comp = COMPRESSION[compression] || COMPRESSION.balanced;
      var effQuality = Math.min(parseFloat(quality), comp.quality);
      var maxDim = comp.maxDimension;

      var jpegs = [];
      var chain = Promise.resolve();

      items.forEach(function (item) {
        chain = chain.then(function () {
          return convertToJpeg(item, effQuality, maxDim).then(function (jpeg) {
            jpegs.push(jpeg);
          });
        });
      });

      return chain.then(function () {
        var bytes = buildPdfBytes(jpegs, {
          pageSize: options.pageSize,
          orientation: options.orientation,
          margin: options.margin,
          pageNumbers: options.pageNumbers
        });
        return new Blob([bytes], { type: 'application/pdf' });
      });
    }
  };

  console.log('[pdf] loaded');
})();