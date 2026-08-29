const WIDTH = 12;
const BASE = 36n;
const MAX_RANK = BASE ** BigInt(WIDTH) - 1n;

function decode(key: string) {
  if (!/^[0-9a-z]{12}$/.test(key)) return undefined;
  let rank = 0n;
  for (const digit of key) {
    const value = BigInt(parseInt(digit, 36));
    rank = rank * BASE + value;
  }
  return rank;
}

function encode(rank: bigint) {
  return rank.toString(36).padStart(WIDTH, '0');
}

export function initialIssueSortKey() {
  return encode(MAX_RANK / 2n);
}

/** Returns a fixed-width base-36 rank, or undefined when a rebalance is needed. */
export function sortKeyBetween(before?: string | null, after?: string | null) {
  const lower = before ? decode(before) : 0n;
  const upper = after ? decode(after) : MAX_RANK;
  if (lower === undefined || upper === undefined || upper - lower <= 1n) return undefined;
  return encode(lower + (upper - lower) / 2n);
}

export function rebalanceIssueSortKeys(ids: readonly string[]) {
  const step = MAX_RANK / BigInt(ids.length + 1);
  return new Map(ids.map((id, index) => [id, encode(step * BigInt(index + 1))]));
}
