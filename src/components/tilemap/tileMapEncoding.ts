// Binary encodings from MAP_TILEMAP_CONTRACT.md, browser-side.
//
// - "u16le-base64": width*height uint16 little-endian values, x-fastest.
// - "u8rle-base64": (count 1..255, value) byte pairs, then base64.

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(offset, offset + chunkSize))
    );
  }

  return window.btoa(binary);
}

export function base64ToBytes(base64Value: string): Uint8Array | null {
  try {
    const binary = window.atob(base64Value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

export function encodeTileLayer(layer: Uint16Array) {
  const bytes = new Uint8Array(layer.length * 2);

  for (let index = 0; index < layer.length; index += 1) {
    bytes[index * 2] = layer[index] & 0xff;
    bytes[index * 2 + 1] = (layer[index] >> 8) & 0xff;
  }

  return bytesToBase64(bytes);
}

export function decodeTileLayer(base64Value: string, expectedCells: number): Uint16Array | null {
  const bytes = base64ToBytes(base64Value);

  if (!bytes || bytes.length !== expectedCells * 2) {
    return null;
  }

  const layer = new Uint16Array(expectedCells);

  for (let index = 0; index < expectedCells; index += 1) {
    layer[index] = bytes[index * 2] | (bytes[index * 2 + 1] << 8);
  }

  return layer;
}

export function encodeRleBytes(bytes: Uint8Array) {
  const packed: number[] = [];
  let index = 0;

  while (index < bytes.length) {
    const value = bytes[index];
    let count = 1;

    while (count < 255 && index + count < bytes.length && bytes[index + count] === value) {
      count += 1;
    }

    packed.push(count, value);
    index += count;
  }

  return bytesToBase64(Uint8Array.from(packed));
}

export function decodeRleBytes(base64Value: string): Uint8Array | null {
  const packed = base64ToBytes(base64Value);

  if (!packed || packed.length === 0 || packed.length % 2 !== 0) {
    return null;
  }

  let totalLength = 0;

  for (let index = 0; index < packed.length; index += 2) {
    if (packed[index] === 0) {
      return null;
    }

    totalLength += packed[index];
  }

  const bytes = new Uint8Array(totalLength);
  let cursor = 0;

  for (let index = 0; index < packed.length; index += 2) {
    bytes.fill(packed[index + 1], cursor, cursor + packed[index]);
    cursor += packed[index];
  }

  return bytes;
}
