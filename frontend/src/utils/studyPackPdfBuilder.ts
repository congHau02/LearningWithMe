export interface PdfPageImage {
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  pageWidthPt?: number;
  pageHeightPt?: number;
}

const DEFAULT_LANDSCAPE_W = 841.89;
const DEFAULT_LANDSCAPE_H = 595.28;
const DEFAULT_PORTRAIT_W = 595.28;
const DEFAULT_PORTRAIT_H = 841.89;

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Decode a base64 `data:image/jpeg;base64,...` URL into raw JPEG bytes. */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx === -1 ? dataUrl : dataUrl.slice(commaIdx + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Build a multi-page PDF 1.4 document embedding each rendered canvas JPEG page.
 * Zero external dependencies — runs purely in the browser.
 */
export function buildStudyPackPdf(pages: PdfPageImage[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error('Không có trang nào để xuất Study Pack PDF.');
  }

  const parts: Uint8Array[] = [asciiBytes('%PDF-1.4\n%\xff\xff\xff\xff\n')];
  const offsets: number[] = [0];
  let bytePos = parts[0].length;

  const pushObj = (objNum: number, bodyChunks: Uint8Array[]) => {
    offsets[objNum] = bytePos;
    const header = asciiBytes(`${objNum} 0 obj\n`);
    const footer = asciiBytes('\nendobj\n');
    const objChunks = [header, ...bodyChunks, footer];
    for (const chunk of objChunks) {
      parts.push(chunk);
      bytePos += chunk.length;
    }
  };

  // Object 1 = Catalog, Object 2 = Pages, then 3 objects per page (Page, Content, Image XObject)
  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);

  pushObj(1, [asciiBytes('<< /Type /Catalog /Pages 2 0 R >>')]);
  pushObj(2, [
    asciiBytes(`<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`),
  ]);

  pages.forEach((page, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const isLandscape = page.widthPx >= page.heightPx;
    const wPt = page.pageWidthPt ?? (isLandscape ? DEFAULT_LANDSCAPE_W : DEFAULT_PORTRAIT_W);
    const hPt = page.pageHeightPt ?? (isLandscape ? DEFAULT_LANDSCAPE_H : DEFAULT_PORTRAIT_H);

    pushObj(pageId, [
      asciiBytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] ` +
          `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    ]);

    const streamCmd = `q\n${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
    pushObj(contentId, [
      asciiBytes(`<< /Length ${streamCmd.length} >>\nstream\n${streamCmd}endstream`),
    ]);

    pushObj(imageId, [
      asciiBytes(
        `<< /Type /XObject /Subtype /Image /Width ${Math.max(1, Math.round(page.widthPx))} ` +
          `/Height ${Math.max(1, Math.round(page.heightPx))} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`,
      ),
      page.jpegBytes,
      asciiBytes('\nendstream'),
    ]);
  });

  const xrefOffset = bytePos;
  const totalObjects = 2 + pages.length * 3;
  const xrefLines = [`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i <= totalObjects; i += 1) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  xrefLines.push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  parts.push(asciiBytes(xrefLines.join('')));

  return concatBytes(parts);
}

/** Trigger a client-side file download from an in-memory Blob and revoke its object URL afterward. */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL?.(url), 1500);
}
