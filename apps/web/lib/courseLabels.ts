export function courseCountLabel(count: number, singular: string, plural?: string) {
  const word = count === 1 ? singular : plural || `${singular}s`;
  return `${count} ${word}`;
}
