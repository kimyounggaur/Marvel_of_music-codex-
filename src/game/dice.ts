export function rollDice(random: () => number = Math.random): number {
  return Math.floor(random() * 6) + 1;
}
