export async function GET() {
  const sources = [
    'http://numbersapi.com/random/trivia?json',
    'https://catfact.ninja/fact',
    'https://en.wikipedia.org/api/rest_v1/page/random/summary',
  ];
  const src = sources[Math.floor(Math.random() * sources.length)];
  try {
    const r = await fetch(src, { cache: 'no-store' });
    const j = await r.json();
    const fact =
      j.text || j.fact || j.extract || (j.number != null ? String(j.text || j.number) : null);
    return Response.json({ fact: fact || 'Learning is fun!' });
  } catch {
    return Response.json({ fact: 'Books take you everywhere.' });
  }
}
