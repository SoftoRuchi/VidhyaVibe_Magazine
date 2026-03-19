export async function GET() {
  try {
    const r = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,flags,region', {
      cache: 'force-cache',
    });
    const all = await r.json();
    const pool = (all || []).filter((c: any) => Array.isArray(c.capital) && c.capital[0]);
    const item = pool[Math.floor(Math.random() * pool.length)];
    const correct = item.capital[0];
    const opts = new Set<string>([correct]);
    while (opts.size < 4) {
      const pick = pool[Math.floor(Math.random() * pool.length)].capital[0];
      opts.add(pick);
    }
    const options = [...opts].sort(() => Math.random() - 0.5);
    return Response.json({
      country: item.name.common,
      flag: item.flags?.svg || item.flags?.png,
      options,
      answerIndex: options.indexOf(correct),
      region: item.region,
    });
  } catch {
    return Response.json({
      country: 'India',
      flag: 'https://flagcdn.com/in.svg',
      options: ['New Delhi', 'Mumbai', 'Kolkata', 'Chennai'],
      answerIndex: 0,
      region: 'Asia',
    });
  }
}
