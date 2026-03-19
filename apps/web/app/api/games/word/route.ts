function shuffle(s: string) {
  return [...s].sort(() => Math.random() - 0.5).join('');
}

export async function GET() {
  try {
    const r = await fetch('https://random-word-api.herokuapp.com/word?number=1', {
      cache: 'no-store',
    });
    const arr = await r.json();
    const raw = String((arr && arr[0]) || 'planet');
    const word = raw.toUpperCase();
    let scrambled = shuffle(word);
    if (scrambled === word) scrambled = shuffle(word);
    return Response.json({ word, scrambled });
  } catch {
    const word = 'PLANET';
    return Response.json({ word, scrambled: 'TALPEN' });
  }
}
