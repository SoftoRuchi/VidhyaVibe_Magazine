export async function GET() {
  try {
    const r = await fetch(
      'https://opentdb.com/api.php?amount=5&category=17&difficulty=easy&type=multiple',
      { cache: 'no-store' },
    );
    const json = await r.json();
    const items = (json.results || []).map((q: any) => {
      const opts = [...(q.incorrect_answers || []), q.correct_answer].sort(
        () => Math.random() - 0.5,
      );
      return {
        question: q.question,
        options: opts,
        answerIndex: opts.indexOf(q.correct_answer),
      };
    });
    return Response.json({ items });
  } catch {
    // Simple fallback set
    const items = [
      {
        question: 'Which planet is known as the Red Planet?',
        options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
        answerIndex: 1,
      },
      {
        question: 'How many days are there in a leap year?',
        options: ['365', '366', '364', '367'],
        answerIndex: 1,
      },
    ];
    return Response.json({ items });
  }
}
