// A small zip writer and reader on node's own zlib, so packing the Playgama build needs nothing
// installed (it used to need Python, and Windows answered `python3` with "Python was not found").
// Entries are deflated files only, no directory entries, names with '/' and flagged UTF-8; every
// entry carries the same fixed date, so the same files always make the same archive.
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** 1980-01-01 00:00, the earliest date a zip can hold. */
const DOS_DATE = (1 << 5) | 1;
const DOS_TIME = 0;
const UTF8 = 0x0800;
const DEFLATE = 8;
const VERSION = 20;

/** @param {{ name: string, data: Buffer }[]} entries @returns {Buffer} */
export function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (name.includes('\\') || name.endsWith('/') || name.startsWith('/')) throw new Error(`bad zip entry name: ${name}`);
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(UTF8, 6);
    local.writeUInt16LE(DEFLATE, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, packed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(VERSION, 4);
    dir.writeUInt16LE(VERSION, 6);
    dir.writeUInt16LE(UTF8, 8);
    dir.writeUInt16LE(DEFLATE, 10);
    dir.writeUInt16LE(DOS_TIME, 12);
    dir.writeUInt16LE(DOS_DATE, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(packed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    // extra, comment, disk, internal and external attributes: all zero
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dirBuf, end]);
}

/** Reads back an archive `zip` wrote, checking every entry's checksum.
 *  @param {Buffer} buf @returns {{ name: string, data: Buffer }[]} */
export function unzip(buf) {
  const end = buf.length - 22;
  if (buf.readUInt32LE(end) !== 0x06054b50) throw new Error('no end of central directory');
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const data = inflateRawSync(buf.subarray(start, start + size));
    if (crc32(data) !== crc) throw new Error(`checksum mismatch: ${name}`);
    out.push({ name, data });
    p += 46 + nameLen + skip;
  }
  return out;
}
