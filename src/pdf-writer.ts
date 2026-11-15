// Writes a PDF file of one page that shows one picture, from the pixels of the picture (compressed with the zlib format). No library: the file is made of five objects and a table of their
// places. The page has the size given in points (a point is 1/72 of an inch). Pure module, tested with the zlib of Node.
const encode = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

// Returns the bytes of a PDF with one page of `pageWidth` x `pageHeight` points that shows an RGB picture of `width` x `height` pixels. `rgbDeflated` holds the pixels (three bytes each,
// row after row) compressed in the zlib format. The title is plain text without parentheses and backslashes.
export function buildPdf(width: number, height: number, rgbDeflated: Uint8Array, pageWidth: number, pageHeight: number, title = `Sketchnote`): Uint8Array {
  const w = Math.round(width);
  const h = Math.round(height);
  const pw = Math.round(pageWidth * 100) / 100;
  const ph = Math.round(pageHeight * 100) / 100;
  const safeTitle = title.replace(/[^A-Za-z0-9 ._-]/g, ``).slice(0, 80);
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array): void => {
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, head: string, stream?: Uint8Array): void => {
    offsets[n] = length;
    push(encode(`${n} 0 obj\n${head}`));
    if (stream) {
      push(encode(`\nstream\n`));
      push(stream);
      push(encode(`\nendstream`));
    }
    push(encode(`\nendobj\n`));
  };
  push(encode(`%PDF-1.4\n%\xe2\xe3\xcf\xd3\n`));
  object(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  object(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  object(4, `<< /Length ${content.length} >>`, encode(content));
  object(5, `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${rgbDeflated.length} >>`, rgbDeflated);
  object(6, `<< /Title (${safeTitle}) /Producer (Sketchnote) >>`);
  const xref = length;
  let table = `xref\n0 7\n0000000000 65535 f \n`;
  for (let n = 1; n <= 6; n++) table += `${String(offsets[n]).padStart(10, `0`)} 00000 n \n`;
  push(encode(`${table}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
