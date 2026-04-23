/**
 * H.264 utilities for WebCodecs decoding.
 *
 * Handles Annex B ↔ AVC format conversion, SPS parsing for codec string,
 * and avcC description construction.
 */

// NAL unit type mask (lower 5 bits of the first byte after start code)
const NAL_TYPE_MASK = 0x1f;
const NAL_SPS = 7;
const NAL_PPS = 8;

/** Split an Annex B bitstream into individual NAL units (without start codes). */
export function splitNalUnits(data: Uint8Array): Uint8Array[] {
  const nals: Uint8Array[] = [];
  let i = 0;
  const len = data.length;

  while (i < len) {
    // Find start code: 00 00 01 or 00 00 00 01
    let scLen = 0;
    if (i + 2 < len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
      scLen = 3;
    } else if (i + 3 < len && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
      scLen = 4;
    } else {
      i++;
      continue;
    }

    const nalStart = i + scLen;
    // Find next start code or end
    let nalEnd = len;
    for (let j = nalStart + 1; j < len - 2; j++) {
      if (data[j] === 0 && data[j + 1] === 0 && (data[j + 2] === 1 || (j + 3 < len && data[j + 2] === 0 && data[j + 3] === 1))) {
        nalEnd = j;
        break;
      }
    }

    if (nalEnd > nalStart) {
      nals.push(data.subarray(nalStart, nalEnd));
    }
    i = nalEnd;
  }

  return nals;
}

/**
 * Parse SPS NAL to extract profile_idc, constraint_flags, level_idc.
 * Returns the codec string like "avc1.42001E".
 */
export function parseSPSCodecString(spsNal: Uint8Array): string {
  if (spsNal.length < 4) return 'avc1.42001E'; // fallback baseline
  const profileIdc = spsNal[1];
  const constraintFlags = spsNal[2];
  const levelIdc = spsNal[3];
  const hex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  return `avc1.${hex(profileIdc)}${hex(constraintFlags)}${hex(levelIdc)}`;
}

/**
 * Build avcC (AVC Decoder Configuration Record) from SPS and PPS NAL units.
 * This is the `description` field for VideoDecoder.configure().
 */
export function buildAvcC(spsNals: Uint8Array[], ppsNals: Uint8Array[]): Uint8Array {
  const sps = spsNals[0];
  if (!sps || sps.length < 4) throw new Error('Invalid SPS');

  // avcC structure:
  // configurationVersion(1) + profile(1) + compat(1) + level(1) +
  // lengthSizeMinusOne(1) + numSPS(1) + [spsLen(2) + sps]* +
  // numPPS(1) + [ppsLen(2) + pps]*
  let totalSize = 6; // fixed header
  for (const s of spsNals) totalSize += 2 + s.length;
  totalSize += 1; // numPPS
  for (const p of ppsNals) totalSize += 2 + p.length;

  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);
  let off = 0;

  buf[off++] = 1; // configurationVersion
  buf[off++] = sps[1]; // profile_idc
  buf[off++] = sps[2]; // constraint_set_flags
  buf[off++] = sps[3]; // level_idc
  buf[off++] = 0xff; // 6 bits reserved (111111) + 2 bits lengthSizeMinusOne (11 = 4 bytes)
  buf[off++] = 0xe0 | (spsNals.length & 0x1f); // 3 bits reserved (111) + 5 bits numSPS

  for (const s of spsNals) {
    view.setUint16(off, s.length, false); off += 2;
    buf.set(s, off); off += s.length;
  }

  buf[off++] = ppsNals.length & 0xff;
  for (const p of ppsNals) {
    view.setUint16(off, p.length, false); off += 2;
    buf.set(p, off); off += p.length;
  }

  return buf;
}

/**
 * Convert Annex B NAL units (start code prefixed) to AVC format
 * (4-byte big-endian length prefixed). Required by WebCodecs.
 */
export function annexBToAvc(data: Uint8Array): Uint8Array {
  const nals = splitNalUnits(data);
  if (nals.length === 0) return data;

  let totalLen = 0;
  for (const nal of nals) totalLen += 4 + nal.length;

  const out = new Uint8Array(totalLen);
  const view = new DataView(out.buffer);
  let off = 0;

  for (const nal of nals) {
    view.setUint32(off, nal.length, false); off += 4;
    out.set(nal, off); off += nal.length;
  }

  return out;
}

/**
 * Extract SPS and PPS NAL units from a config packet (Annex B).
 */
export function extractSPSPPS(data: Uint8Array): { sps: Uint8Array[]; pps: Uint8Array[] } {
  const nals = splitNalUnits(data);
  const sps: Uint8Array[] = [];
  const pps: Uint8Array[] = [];

  for (const nal of nals) {
    if (nal.length === 0) continue;
    const type = nal[0] & NAL_TYPE_MASK;
    if (type === NAL_SPS) sps.push(nal);
    else if (type === NAL_PPS) pps.push(nal);
  }

  return { sps, pps };
}
