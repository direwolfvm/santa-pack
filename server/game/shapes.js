/**
 * Cloaked names made of three random shapes, such as "🔺 🟦 💛". A present
 * gets one whenever its giver leaves the cloaked name blank, including
 * presents brought over from Framblywish. Shared by the server and app/.
 */

export const SHAPES = [
  ...['🔴', '🟠', '🟡', '🟢', '🔵', '🟣'],
  ...['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'],
  ...['🔺', '🔻', '🔶', '🔷', '⭐'],
  ...['🧡', '💛', '💚', '💙', '💜'],
];

/** A random whole number below `max`, from the platform's secure generator. @param {number} max */
function randomBelow(max) {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const value = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(value);
  while (value[0] >= limit);
  return value[0] % max;
}

/** Three different shapes. @param {(max: number) => number} [random] */
export function shapeName(random = randomBelow) {
  const pool = [...SHAPES];
  return Array.from({ length: 3 }, () => pool.splice(random(pool.length), 1)[0]).join(' ');
}

/**
 * Three shapes no other present in the round uses yet, when that's easy to
 * find. There are thousands of combinations, so a repeat is rare either way.
 * @param {Iterable<string>} taken cloaked names already in the round
 */
export function freshShapeName(taken) {
  const used = new Set(taken);
  let name = shapeName();
  for (let tries = 0; tries < 20 && used.has(name); tries += 1) name = shapeName();
  return name;
}
