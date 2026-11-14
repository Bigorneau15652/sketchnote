import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { fontKind, isPlainStyle, readFontNames } from "../src/font-file";
import { fontFilesOfZip } from "../src/zip";

// Builds a tiny TrueType file that holds only a name table, with the family (id 1) and the style (id 2) written in UTF-16 for the Windows platform.
function tinyFont(family: string, style: string, head = 0x00010000): Uint8Array {
  const strings = [family, style].map((s) => Buffer.from(s, `utf16le`).swap16());
  const records = Buffer.alloc(24);
  let offset = 0;
  [1, 2].forEach((id, i) => {
    records.writeUInt16BE(3, i * 12);
    records.writeUInt16BE(1, i * 12 + 2);
    records.writeUInt16BE(0x409, i * 12 + 4);
    records.writeUInt16BE(id, i * 12 + 6);
    records.writeUInt16BE(strings[i].length, i * 12 + 8);
    records.writeUInt16BE(offset, i * 12 + 10);
    offset += strings[i].length;
  });
  const nameHead = Buffer.alloc(6);
  nameHead.writeUInt16BE(2, 2);
  nameHead.writeUInt16BE(6 + 24, 4);
  const nameTable = Buffer.concat([nameHead, records, ...strings]);
  const header = Buffer.alloc(12 + 16);
  header.writeUInt32BE(head, 0);
  header.writeUInt16BE(1, 4);
  header.write(`name`, 12, `latin1`);
  header.writeUInt32BE(28, 20);
  header.writeUInt32BE(nameTable.length, 24);
  return new Uint8Array(Buffer.concat([header, nameTable]));
}

test(`la sorte d'un fichier se lit sur ses premiers octets`, () => {
  assert.equal(fontKind(tinyFont(`A`, `Regular`)), `font`);
  assert.equal(fontKind(tinyFont(`A`, `Regular`, 0x4f54544f)), `font`);
  assert.equal(fontKind(Buffer.from(`ttcf\0\0\0\0\0\0\0\0\0\0`)), `collection`);
  assert.equal(fontKind(Buffer.from(`wOFF\0\0\0\0\0\0\0\0\0\0`)), `woff`);
  assert.equal(fontKind(Buffer.from(`<html>pas une police</html>`)), `unknown`);
  assert.equal(fontKind(new Uint8Array(3)), `unknown`);
});

test(`la famille et le style d'une police sont lus dans sa table des noms`, () => {
  assert.deepEqual(readFontNames(tinyFont(`Ma Police`, `Bold Italic`)), { family: `Ma Police`, style: `Bold Italic` });
  assert.equal(readFontNames(new Uint8Array(40)), null);
  assert.equal(readFontNames(Buffer.from(`<html>pas une police</html>`)), null);
  // A table that announces more than the file holds is refused, not read beyond the end.
  const cut = tinyFont(`Ma Police`, `Regular`).slice(0, 40);
  assert.equal(readFontNames(cut), null);
});

test(`le style simple est reconnu`, () => {
  assert.equal(isPlainStyle(`Regular`), true);
  assert.equal(isPlainStyle(`Bold`), false);
});

// A zip file with one stored entry, built by hand: local header, central directory, end of the directory.
function zipOf(name: string, content: Uint8Array, method = 0, declared = content.length): Uint8Array {
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(content.length, 20);
  central.writeUInt32LE(declared, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  const body = Buffer.concat([local, nameBytes, Buffer.from(content)]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(body.length, 16);
  return new Uint8Array(Buffer.concat([body, central, nameBytes, end]));
}

const inflate = async (data: Uint8Array, limit: number): Promise<Uint8Array> => new Uint8Array((await import(`node:zlib`)).inflateRawSync(data, { maxOutputLength: limit }));

test(`les polices d'une archive zip sont extraites, stockees ou compressees`, async () => {
  const font = tinyFont(`Zip Police`, `Regular`);
  const stored = await fontFilesOfZip(zipOf(`dossier/Zip.ttf`, font), inflate);
  assert.deepEqual(stored.map((f) => f.name), [`Zip.ttf`]);
  assert.deepEqual(Buffer.from(stored[0].data), Buffer.from(font));
  const packed = await fontFilesOfZip(zipOf(`Zip.otf`, new Uint8Array(deflateRawSync(Buffer.from(font))), 8, font.length), inflate);
  assert.deepEqual(Buffer.from(packed[0].data), Buffer.from(font));
});

test(`une archive illisible, des fichiers caches ou trop gros ne donnent rien`, async () => {
  assert.deepEqual(await fontFilesOfZip(new Uint8Array(100), inflate), []);
  assert.deepEqual(await fontFilesOfZip(new Uint8Array(0), inflate), []);
  const refused: string[] = [];
  assert.deepEqual(await fontFilesOfZip(zipOf(`.cache.ttf`, new Uint8Array(10)), inflate, refused), []);
  assert.deepEqual(await fontFilesOfZip(zipOf(`__MACOSX/x.ttf`, new Uint8Array(10)), inflate, refused), []);
  assert.deepEqual(await fontFilesOfZip(zipOf(`notes.txt`, new Uint8Array(10)), inflate, refused), []);
  assert.deepEqual(await fontFilesOfZip(zipOf(`Enorme.ttf`, new Uint8Array(10), 0, 60 * 1024 * 1024), inflate, refused), []);
  assert.deepEqual(refused, [`Enorme.ttf`]);
});

test(`une archive dont l'en-tete ment sur la taille est arretee a la limite`, async () => {
  const packed = new Uint8Array(deflateRawSync(Buffer.alloc(60 * 1024 * 1024)));
  const refused: string[] = [];
  assert.deepEqual(await fontFilesOfZip(zipOf(`Piege.ttf`, packed, 8, 10), inflate, refused), []);
  assert.deepEqual(refused, [`Piege.ttf`]);
});
