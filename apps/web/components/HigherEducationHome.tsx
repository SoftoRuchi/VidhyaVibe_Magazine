'use client';

import Link from 'next/link';
import React from 'react';
import {
  fetchCourseBrowse,
  formatBookPrice,
  type BrowseBook,
  type BrowseCourse,
  type CourseContinue,
} from '../lib/coursesApi';
import { CourseContinueCard, CourseCover } from './CourseBrowse';

function bookSearchText(book: BrowseBook) {
  return `${book.search || ''} ${book.name} ${book.courseName} ${book.semesterTitle}`.toLowerCase();
}

function booksMatching(courses: BrowseCourse[], query: string) {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const all = courses.flatMap((course) => course.semesters.flatMap((sem) => sem.books));
  if (!tokens.length) return all;
  return all.filter((book) => {
    const hay = bookSearchText(book);
    return tokens.every((token) => hay.includes(token));
  });
}

function BookCard({ book }: { book: BrowseBook }) {
  const price = formatBookPrice(book.price);
  return (
    <article className="vv-he-book">
      <Link href={book.href} className="vv-he-book-cover" aria-label={book.name}>
        <CourseCover src={book.frontCoverUrl} title={book.name} seed={book.id} />
      </Link>
      <div className="vv-he-book-body">
        <p className="vv-he-book-path">
          {book.courseName} · {book.semesterTitle}
        </p>
        <Link href={book.href} className="vv-he-book-title">
          {book.name}
        </Link>
        {book.syllabusCode ? <small>{book.syllabusCode}</small> : null}
        <div className="vv-he-book-actions">
          <Link href={book.href} className="vv-course-btn is-ghost">
            View book
          </Link>
          {book.purchasable ? (
            <Link href={book.buyHref} className="vv-course-btn is-subscribe">
              Buy {price}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function HigherEducationHome({
  continueReading,
}: {
  courses?: unknown;
  continueReading: CourseContinue | null;
  loading?: boolean;
}) {
  const [catalog, setCatalog] = React.useState<BrowseCourse[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [openCourse, setOpenCourse] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchCourseBrowse()
      .then((rows) => {
        if (!cancelled) setCatalog(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setCatalog([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = catalog != null;
  const courses = catalog || [];
  const q = query.trim();
  const allBooks = ready
    ? courses.flatMap((course) => course.semesters.flatMap((sem) => sem.books))
    : [];
  const matches = q ? booksMatching(courses, q) : allBooks;

  return (
    <main className="vv-he">
      {ready && courses.length ? (
        <nav className="vv-he-tabbar" aria-label="Courses" onMouseLeave={() => setOpenCourse(null)}>
          <div className="vv-he-tabrow">
            {courses.map((course) => (
              <button
                key={course.id}
                type="button"
                className={`vv-he-tab-btn${openCourse === course.slug ? ' is-open' : ''}`}
                aria-expanded={openCourse === course.slug}
                onMouseEnter={() => setOpenCourse(course.slug)}
                onFocus={() => setOpenCourse(course.slug)}
                onClick={() => {
                  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
                  setOpenCourse((current) => (current === course.slug ? null : course.slug));
                }}
              >
                {course.name}
              </button>
            ))}
          </div>
          {courses
            .filter((course) => course.slug === openCourse)
            .map((course) => {
              const bookCount = course.semesters.reduce((sum, sem) => sum + sem.books.length, 0);
              return (
                <div
                  key={course.id}
                  className="vv-he-tabpanel"
                  role="region"
                  aria-label={`${course.name} books`}
                >
                  {bookCount ? (
                    course.semesters.map((semester) => (
                      <div key={semester.number} className="vv-he-tabcol">
                        <h3>{semester.title}</h3>
                        <ul>
                          {semester.books.map((book) => (
                            <li key={book.id}>
                              <Link href={book.href}>{book.name}</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p>Books for this programme are being added.</p>
                  )}
                </div>
              );
            })}
        </nav>
      ) : null}
      <section className="container">
        <div className="vv-he-hero">
          <div className="vv-he-brandline">
            <h1>University books you can find and buy in one step.</h1>
            <form
              className="vv-he-search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                document.getElementById('vv-book-results')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <label className="vv-he-search-label" htmlFor="vv-book-search">
                Search books
              </label>
              <input
                id="vv-book-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search book, subject, course, or keyword"
                autoComplete="off"
              />
            </form>
          </div>
          <div className="vv-he-hero-copy">
            <p className="vv-he-lead">
              VidhyaVibe publishes textbooks for higher-education programmes. Search for a book by
              its name, subject, course, or a keyword, open it directly, and buy it without creating
              an account first.
            </p>
            <div className="vv-he-formats">
              <article>
                <h2>Interactive e-book</h2>
                <p>
                  Transform passive reading into active learning. Includes instant keyword search,
                  in-chapter quizzes, smart flashcards, digital notes, and access anywhere without
                  heavy paper books.
                </p>
                <a href="#why-interactive" className="vv-he-format-link">
                  Why interactive is better ↓
                </a>
              </article>
              <article>
                <h2>Print-on-Demand</h2>
                <p>
                  Prefer a physical book? Order a printed copy at checkout and we print it for
                  delivery to your address.
                </p>
              </article>
            </div>
          </div>

          <aside className="vv-he-panel">
            {continueReading?.href ? (
              <CourseContinueCard
                href={continueReading.href}
                chapterTitle={continueReading.chapterTitle}
                courseName={continueReading.courseName}
                subjectName={continueReading.subjectName}
                percent={continueReading.percent}
              />
            ) : (
              <>
                <p className="vv-he-panel-kicker">How to get a book</p>
                <ol className="vv-he-steps">
                  <li>
                    <strong>Search or browse</strong>
                    <span>Every published book is listed here by course and semester.</span>
                  </li>
                  <li>
                    <strong>Explore the book</strong>
                    <span>Go straight to that textbook. No course-by-course path required.</span>
                  </li>
                  <li>
                    <strong>Buy the book</strong>
                    <span>
                      Choose the e-book or a printed copy and pay with your contact details.
                    </span>
                  </li>
                </ol>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="container vv-he-section" id="vv-book-results">
        {!ready ? (
          <div className="vv-he-card">
            <div className="vv-he-loading">Loading books…</div>
          </div>
        ) : failed ? (
          <div className="vv-he-card">
            <h2>Books</h2>
            <p className="vv-he-lead">The catalogue could not be loaded. Refresh and try again.</p>
          </div>
        ) : (
          <div className="vv-he-card">
            <div className="vv-he-section-head">
              <h2>
                {q
                  ? matches.length
                    ? `${matches.length} book${matches.length === 1 ? '' : 's'} for “${q}”`
                    : `No books for “${q}”`
                  : 'Books'}
              </h2>
            </div>
            {matches.length ? (
              <div className="vv-he-book-grid">
                {matches.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            ) : (
              <p className="vv-he-lead">
                {q
                  ? 'Try the book title, the subject, the programme name, or a word from the description.'
                  : 'Published books will appear here.'}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="container vv-he-section" id="why-interactive">
        <div className="vv-he-card vv-he-why-section">
          <div className="vv-he-why-header">
            <span className="vv-he-why-badge">Interactive Advantage</span>
            <h2>Why Interactive E-Books Are Better Than Printed Books</h2>
            <p className="vv-he-lead">
              Traditional paper textbooks are static, heavy, and quickly outdated. VidhyaVibe
              interactive e-books combine university curriculum with powerful digital study tools to
              help you learn faster, retain more, and score higher in exams.
            </p>
          </div>

          <div className="vv-he-why-grid">
            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">⚡</div>
              <h3>Active Practice vs. Passive Reading</h3>
              <p>
                Printed books only allow passive reading where it is easy to lose focus. Interactive
                e-books include end-of-chapter quizzes and instant knowledge checks so you can test
                your understanding immediately after reading.
              </p>
            </div>

            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">🔍</div>
              <h3>Instant Keyword & Concept Search</h3>
              <p>
                No more flipping through hundreds of paper pages or incomplete indices. Search any
                technical formula, term, definition, or code snippet across the entire textbook in
                milliseconds.
              </p>
            </div>

            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">🎴</div>
              <h3>Smart Chapter Flashcards</h3>
              <p>
                Master difficult definitions, theorems, and concepts with built-in digital
                flashcards. Ideal for quick self-testing on your commute or fast revision right
                before exam hall entry.
              </p>
            </div>

            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">📝</div>
              <h3>Searchable In-Context Notes</h3>
              <p>
                Jot down personal notes and bookmark key passages directly alongside textbook
                chapters. Your notes stay organized, searchable, and intact without ink bleed or
                damaging physical book pages.
              </p>
            </div>

            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">🎒</div>
              <h3>Zero Backpack Weight & Anywhere Access</h3>
              <p>
                Your entire multi-semester degree syllabus fits in your pocket. Read seamlessly on
                your laptop, tablet, or smartphone wherever you study—at home, in college, or on the
                move.
              </p>
            </div>

            <div className="vv-he-why-card">
              <div className="vv-he-why-icon">💡</div>
              <h3>Always Current & Fraction of the Cost</h3>
              <p>
                Whenever university syllabi change or errors are revised, digital editions update
                automatically. Get the latest textbook content at a fraction of the cost of printing
                and shipping physical paperbacks.
              </p>
            </div>
          </div>

          <div className="vv-he-compare-box">
            <h3>At a Glance: Interactive E-Book vs. Printed Book</h3>
            <div className="vv-he-compare-table-wrapper">
              <table className="vv-he-compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>VidhyaVibe Interactive E-Book</th>
                    <th>Traditional Printed Book</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Study Engagement</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>Active:</strong> Embedded quizzes,
                      practice checks & flashcards
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Passive:</strong> Text only,
                      self-testing requires external aids
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Finding Topics</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>Instant:</strong> Sub-second
                      search across the whole syllabus
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Slow:</strong> Manual flipping
                      through pages and indices
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Note-Taking</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>Organized:</strong> Digital,
                      searchable notes tied to chapters
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Cluttered:</strong> Margin
                      scribbles that wear out and can't be searched
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Portability</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>0 kg:</strong> Access all semester
                      books on mobile, tablet, or laptop
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Bulky:</strong> Heavy backpacks
                      carrying multiple thick books
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Curriculum Updates</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>Immediate:</strong> Real-time
                      syllabus updates and corrections
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Static:</strong> Outdated quickly;
                      requires buying new editions
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Affordability</strong>
                    </td>
                    <td>
                      <span className="vv-check">✓</span> <strong>Budget-friendly:</strong>{' '}
                      Accessible pricing starting from just ₹1
                    </td>
                    <td>
                      <span className="vv-cross">✕</span> <strong>Costly:</strong> High printing,
                      paper, and shipping fees
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
