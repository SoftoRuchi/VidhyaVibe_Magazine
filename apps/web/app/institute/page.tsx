'use client';

import { Empty, Spin } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useAuth } from '../../lib/authContext';
import {
  addInstituteStudent,
  bookAccessLabel,
  courseLoginHref,
  endInstituteReadingSession,
  exportInstituteActivity,
  fetchInstituteActivity,
  fetchInstituteCampuses,
  fetchInstitutePortal,
  importInstituteLotStudents,
  type InstituteAdminCampus,
  type InstitutePortalData,
} from '../../lib/coursesApi';
import { formatAppDateTime, formatDuration } from '../../lib/formatAppDateTime';
import { downloadStudentRosterSample, parseStudentRosterCsv } from '../../lib/studentRosterCsv';
import { isChildAudience } from '../../lib/viewingContext';

function fmtWhen(v?: string | null) {
  return formatAppDateTime(v);
}

function fmtMins(seconds?: number) {
  return formatDuration(seconds);
}

export default function InstitutePortalPage() {
  const router = useRouter();
  const { loggedIn, loading: authLoading } = useAuth();
  const [campuses, setCampuses] = React.useState<InstituteAdminCampus[]>([]);
  const [instituteId, setInstituteId] = React.useState<number | null>(null);
  const [data, setData] = React.useState<InstitutePortalData | null>(null);
  const [activity, setActivity] = React.useState<{ reading?: any[]; logins?: any[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [needLogin, setNeedLogin] = React.useState(false);
  const [forbidden, setForbidden] = React.useState(false);
  const [tab, setTab] = React.useState<'live' | 'licenses' | 'students' | 'activity'>('live');
  const [rosterLotId, setRosterLotId] = React.useState<number | null>(null);
  const [rosterText, setRosterText] = React.useState('');
  const [newStudent, setNewStudent] = React.useState({
    email: '',
    name: '',
    className: '',
    rollNumber: '',
    password: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [ending, setEnding] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');

  const loadCampuses = React.useCallback(async () => {
    const rows = await fetchInstituteCampuses();
    setCampuses(rows);
    setInstituteId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id || null;
    });
    return rows;
  }, []);

  const loadPortal = React.useCallback(async (id: number) => {
    const [portal, hist] = await Promise.all([
      fetchInstitutePortal(id),
      fetchInstituteActivity(id),
    ]);
    setData(portal);
    setActivity(hist);
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (isChildAudience()) {
      router.replace('/dashboard');
      return;
    }
    if (!loggedIn) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadCampuses()
      .then((rows) => {
        if (cancelled) return;
        if (!rows.length) {
          setForbidden(true);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 401) setNeedLogin(true);
        else setForbidden(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, loggedIn, router, loadCampuses]);

  React.useEffect(() => {
    if (!instituteId || needLogin || forbidden) return;
    let cancelled = false;
    setLoading(true);
    loadPortal(instituteId)
      .catch((e: any) => {
        if (cancelled) return;
        if (e?.response?.status === 401) setNeedLogin(true);
        if (e?.response?.status === 403) setForbidden(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [instituteId, needLogin, forbidden, loadPortal]);

  React.useEffect(() => {
    if (!instituteId || needLogin || forbidden || tab !== 'live') return;
    const timer = window.setInterval(() => {
      loadPortal(instituteId).catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, [instituteId, needLogin, forbidden, tab, loadPortal]);

  const refresh = () => {
    if (!instituteId) return;
    loadPortal(instituteId).catch(() => {});
  };

  const submitRoster = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instituteId || !rosterLotId) return;
    const students = parseStudentRosterCsv(rosterText);
    if (!students.length) {
      setNotice(
        'No valid student emails found. Upload the sample CSV or paste email, name, class, roll.',
      );
      return;
    }
    setSaving(true);
    try {
      const result = await importInstituteLotStudents(instituteId, rosterLotId, students);
      const assigned = result.assigned || 0;
      const emailed = result.emailed || 0;
      setNotice(
        emailed
          ? `Assigned ${assigned} students. Login details were emailed to ${emailed}.`
          : `Assigned ${assigned} students. Could not send login emails — ask VidhyaVibe to check email settings.`,
      );
      setRosterText('');
      setRosterLotId(null);
      refresh();
      setTab('students');
    } catch (e: any) {
      setNotice(e?.response?.data?.message || 'Could not assign students.');
    } finally {
      setSaving(false);
    }
  };

  const submitStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instituteId || !newStudent.email) return;
    setSaving(true);
    try {
      const result = await addInstituteStudent(instituteId, newStudent);
      setNotice(
        result.emailed
          ? `${result.email} is on the roster. Login details were emailed.`
          : `${result.email} is on the roster. Could not send the login email.`,
      );
      setNewStudent({ email: '', name: '', className: '', rollNumber: '', password: '' });
      refresh();
      setTab('students');
    } catch (e: any) {
      setNotice(e?.response?.data?.message || 'Could not add the student.');
    } finally {
      setSaving(false);
    }
  };

  const endSession = async (sessionId: number) => {
    if (!instituteId) return;
    setEnding(sessionId);
    try {
      await endInstituteReadingSession(instituteId, sessionId);
      setNotice('Seat released.');
      refresh();
    } catch (e: any) {
      setNotice(e?.response?.data?.message || 'Could not end the session.');
    } finally {
      setEnding(null);
    }
  };

  const exportCsv = async (kind: 'reading' | 'logins') => {
    if (!instituteId) return;
    setExporting(kind);
    try {
      await exportInstituteActivity(instituteId, kind);
    } catch (e: any) {
      setNotice(e?.response?.data?.message || 'Could not export CSV.');
    } finally {
      setExporting(null);
    }
  };

  if (loading || authLoading) {
    return (
      <main className="container" style={{ padding: 48, textAlign: 'center' }}>
        <Spin />
      </main>
    );
  }

  if (needLogin) {
    return (
      <main className="container" style={{ padding: 48 }}>
        <Link href={courseLoginHref('/institute')} className="course-note-save">
          Login to open the college portal
        </Link>
      </main>
    );
  }

  if (forbidden || !data) {
    return (
      <main className="course-notes-hub">
        <header className="course-notes-hub-head">
          <p className="course-card-kicker">College</p>
          <h1>College portal</h1>
          <p>
            This page is for institute admins. Ask VidhyaVibe to mark your account as Institute
            admin on your college.
          </p>
        </header>
        <Empty description="You are not an institute admin for any college." />
      </main>
    );
  }

  const bankLots = (data.lots || []).filter(
    (lot) => lot.accessModel === 'BOOK_BANK' && lot.status === 'ACTIVE',
  );

  return (
    <main className="course-notes-hub college-portal">
      <header className="course-notes-hub-head">
        <p className="course-card-kicker">College</p>
        <h1>{data.name}</h1>
        <p>
          Code {data.code}
          {data.city ? ` · ${data.city}` : ''}. See who is reading now, assign Book Bank students,
          and review login history for this college only.
        </p>
      </header>

      {campuses.length > 1 ? (
        <div className="course-notes-filters">
          <select
            value={instituteId || ''}
            onChange={(e) => setInstituteId(Number(e.target.value))}
            aria-label="College"
          >
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="college-stat-grid">
        <Stat label="Reading now" value={data.stats.liveCount} />
        <Stat label="Students" value={data.stats.students} />
        <Stat label="Licenses" value={data.stats.licenses} />
        <Stat label="Opened today" value={data.stats.todayOpens} />
      </div>

      {notice ? <pre className="college-notice">{notice}</pre> : null}

      <div className="college-tabs">
        {(
          [
            ['live', `Live now (${data.live.length})`],
            ['licenses', `Licenses (${data.lots.length})`],
            ['students', `Students (${data.members.length})`],
            ['activity', 'Activity'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'is-active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={refresh}>
          Refresh
        </button>
      </div>

      {tab === 'live' ? (
        <section>
          <p className="college-lead">
            Who has a college book open right now. Library lots show used seats vs purchased seats.
            Ending a session frees that seat immediately. This list refreshes every 15 seconds.
          </p>
          {data.lots.length ? (
            <div className="college-table-wrap" style={{ marginBottom: 16 }}>
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Model</th>
                    <th>Seats in use</th>
                    <th>Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lots.map((lot) => (
                    <tr key={lot.id} className={lot.full ? 'is-full' : undefined}>
                      <td>
                        <strong>{lot.subjectName}</strong>
                        <small>{lot.courseName}</small>
                      </td>
                      <td>{bookAccessLabel(lot.accessModel) || lot.accessModel}</td>
                      <td>
                        {lot.liveReaders || 0} / {lot.seatCount}
                      </td>
                      <td>
                        {lot.accessModel === 'LIBRARY' ? (
                          lot.full ? (
                            <span className="college-tag-full">Full</span>
                          ) : (
                            `${lot.remaining ?? Math.max(0, lot.seatCount - (lot.liveReaders || 0))} left`
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!data.live.length ? (
            <Empty description="Nobody is reading a college book right now." />
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Chapter</th>
                    <th>Time</th>
                    <th>Device</th>
                    <th>Last seen</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.live.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name || '—'}</strong>
                        <small>{row.email}</small>
                      </td>
                      <td>{row.subjectName}</td>
                      <td>
                        {row.chapterTitle || '—'}
                        {row.pageNumber ? ` · p.${row.pageNumber}` : ''}
                      </td>
                      <td>{fmtMins(row.secondsActive)}</td>
                      <td>{row.deviceName || '—'}</td>
                      <td>{fmtWhen(row.lastHeartbeatAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="college-end-btn"
                          disabled={ending === row.id}
                          onClick={() => {
                            if (!window.confirm('End this reading session and free the seat?'))
                              return;
                            endSession(row.id);
                          }}
                        >
                          {ending === row.id ? 'Ending…' : 'End session'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'licenses' ? (
        <section>
          {!data.lots.length ? (
            <Empty description="No licenses yet. VidhyaVibe creates Book Bank or Library lots for your college." />
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Model</th>
                    <th>Seats</th>
                    <th>Reading now</th>
                    <th>Remaining</th>
                    <th>Code</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.lots.map((lot) => (
                    <tr key={lot.id}>
                      <td>
                        <strong>{lot.subjectName}</strong>
                        <small>{lot.courseName}</small>
                      </td>
                      <td>{bookAccessLabel(lot.accessModel) || lot.accessModel}</td>
                      <td>
                        {lot.accessModel === 'BOOK_BANK'
                          ? `${lot.assignedSeats} / ${lot.seatCount}`
                          : lot.accessModel === 'LIBRARY'
                            ? `${lot.liveReaders || 0} / ${lot.seatCount}`
                            : lot.seatCount}
                      </td>
                      <td>{lot.liveReaders || 0}</td>
                      <td>
                        {lot.accessModel === 'LIBRARY' ? (
                          lot.full ? (
                            <span className="college-tag-full">Full</span>
                          ) : (
                            `${lot.remaining ?? Math.max(0, lot.seatCount - (lot.liveReaders || 0))} left`
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <code>{lot.purchaseCode}</code>
                      </td>
                      <td>
                        {lot.accessModel === 'BOOK_BANK' && lot.status === 'ACTIVE' ? (
                          <button type="button" onClick={() => setRosterLotId(lot.id)}>
                            Enter students
                          </button>
                        ) : (
                          'Shared pool'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {rosterLotId ? (
            <form className="college-form" onSubmit={submitRoster}>
              <h2>Enter students</h2>
              <p>
                Upload a CSV or paste students. Columns:{' '}
                <code>email, name, class, roll, password</code>. Password is optional. The first row
                can be a header. Login details are emailed to each student.
              </p>
              <div className="course-note-actions" style={{ marginBottom: 10 }}>
                <label className="course-note-save" style={{ cursor: 'pointer' }}>
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv"
                    hidden
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const text = await file.text();
                      setRosterText(text);
                    }}
                  />
                </label>
                <button type="button" onClick={() => downloadStudentRosterSample()}>
                  Download sample CSV
                </button>
              </div>
              <textarea
                rows={8}
                value={rosterText}
                onChange={(e) => setRosterText(e.target.value)}
                placeholder="anita.demo@vvcollege.edu, Anita Sharma, BCA-2, 21, Demo@123"
              />
              <div className="course-note-actions">
                <button type="submit" disabled={saving} className="course-note-save">
                  Assign seats
                </button>
                <button type="button" onClick={() => setRosterLotId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {tab === 'students' ? (
        <section>
          <form className="college-form" onSubmit={submitStudent}>
            <h2>Add student</h2>
            <div className="college-form-grid">
              <input
                type="email"
                required
                placeholder="Email"
                value={newStudent.email}
                onChange={(e) => setNewStudent((s) => ({ ...s, email: e.target.value }))}
              />
              <input
                placeholder="Name"
                value={newStudent.name}
                onChange={(e) => setNewStudent((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                placeholder="Class"
                value={newStudent.className}
                onChange={(e) => setNewStudent((s) => ({ ...s, className: e.target.value }))}
              />
              <input
                placeholder="Roll"
                value={newStudent.rollNumber}
                onChange={(e) => setNewStudent((s) => ({ ...s, rollNumber: e.target.value }))}
              />
              <input
                placeholder="Password (optional)"
                value={newStudent.password}
                onChange={(e) => setNewStudent((s) => ({ ...s, password: e.target.value }))}
              />
            </div>
            <button type="submit" disabled={saving} className="course-note-save">
              Add student
            </button>
          </form>

          {!data.members.length ? (
            <Empty description="No students yet." />
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Roll</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name || '—'}</strong>
                        <small>{row.email}</small>
                      </td>
                      <td>{row.className || '—'}</td>
                      <td>{row.rollNumber || '—'}</td>
                      <td>{row.role === 'INSTITUTE_ADMIN' ? 'Institute admin' : 'Student'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {bankLots.length ? (
            <p className="college-lead">
              To give a named Book Bank copy, open Licenses and use Enter students.
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === 'activity' ? (
        <section>
          <div className="college-section-head">
            <h2>Reading</h2>
            <button
              type="button"
              disabled={exporting === 'reading'}
              onClick={() => exportCsv('reading')}
            >
              {exporting === 'reading' ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
          {!(activity?.reading || []).length ? (
            <Empty description="No reading activity yet." />
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Book</th>
                    <th>Chapter</th>
                    <th>Opened</th>
                    <th>Time</th>
                    <th>Device</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {(activity?.reading || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name || '—'}</strong>
                        <small>{row.email}</small>
                      </td>
                      <td>{row.subjectName}</td>
                      <td>
                        {row.chapterTitle || '—'}
                        {row.pageNumber ? ` · p.${row.pageNumber}` : ''}
                      </td>
                      <td>{row.openCount || 0}</td>
                      <td>{fmtMins(row.secondsActive)}</td>
                      <td>{row.deviceName || '—'}</td>
                      <td>{row.live ? 'Active' : row.endReason || 'Ended'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="college-section-head">
            <h2>Logins</h2>
            <button
              type="button"
              disabled={exporting === 'logins'}
              onClick={() => exportCsv('logins')}
            >
              {exporting === 'logins' ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
          {!(activity?.logins || []).length ? (
            <Empty description="No login history yet." />
          ) : (
            <div className="college-table-wrap">
              <table className="college-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Login</th>
                    <th>Last seen</th>
                    <th>Logout</th>
                    <th>Duration</th>
                    <th>Device</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {(activity?.logins || []).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name || '—'}</strong>
                        <small>{row.email}</small>
                      </td>
                      <td>{fmtWhen(row.loggedInAt)}</td>
                      <td>{fmtWhen(row.lastSeenAt)}</td>
                      <td>{fmtWhen(row.loggedOutAt)}</td>
                      <td>{fmtMins(row.secondsActive)}</td>
                      <td>{row.deviceName || '—'}</td>
                      <td>{row.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="college-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
