export function readGifLoopCount(bytes: Uint8Array): number | null {
  const sigs = [
    [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30],
    [0x41, 0x4e, 0x49, 0x4d, 0x45, 0x58, 0x54, 0x53, 0x31, 0x2e, 0x30]
  ];
  for (let i = 0; i < bytes.length - 18; i++) {
    if (bytes[i] !== 0x21 || bytes[i + 1] !== 0xff || bytes[i + 2] !== 0x0b) continue;
    const match = sigs.some((s) => s.every((b, k) => bytes[i + 3 + k] === b));
    if (!match) continue;
    const p = i + 14;
    if (bytes[p] >= 3 && bytes[p + 1] === 1) return bytes[p + 2] | (bytes[p + 3] << 8);
  }
  return null;
}

export function normalizeDelay(ms: number): number {
  if (!isFinite(ms) || ms <= 10) return 100;
  return Math.round(ms);
}
