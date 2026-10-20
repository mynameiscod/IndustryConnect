import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Globe,
  MapPin,
  ShieldCheck,
  Star,
  Video,
  X,
} from 'lucide-react';
import { formatMoney } from '@market/contracts';
import { api, checkout, loadScript, post } from './api.js';
import { HomePage } from './HomePage.js';
import { SiteHeader, SiteFooter } from './SiteShell.js';

type User = { id: string; name: string; email?: string; emailVerified: boolean; roles: string[] };
const Auth = createContext<{ user: User | null; loading: boolean; refresh: () => Promise<void> }>({
  user: null,
  loading: true,
  refresh: async () => {},
});
const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const msg = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong. Please try again.';
function useData<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    api<T>(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) {
          setData(null);
          setError(msg(e));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
function statusColor(status: string) {
  if (['confirmed', 'approved', 'completed'].includes(status)) return 'text-bg-success';
  if (['held', 'pending', 'pending_confirmation'].includes(status)) return 'text-bg-warning';
  if (['cancelled', 'rejected', 'suspended'].includes(status)) return 'text-bg-danger';
  return 'text-bg-secondary';
}
function Alert({ children, kind = 'error' }: { children: ReactNode; kind?: string }) {
  return (
    <div
      className={`alert alert-${kind === 'error' ? 'danger' : kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="text-center bg-body-tertiary border rounded p-5 my-4">
      <Compass size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Loader() {
  return (
    <div className="text-center text-body-secondary py-5" role="status">
      Loading your next step…
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="form-label d-block mb-3">
      <span className="d-block mb-2 fw-medium">{label}</span>
      {children}
    </label>
  );
}
function Pager({
  page,
  setPage,
  total,
  limit = 24,
}: {
  page: number;
  setPage: (n: number) => void;
  total: number;
  limit?: number;
}) {
  return total > limit ? (
    <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 mt-4">
      <button
        className="btn btn-outline-secondary"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span>Page {page}</span>
      <button
        className="btn btn-outline-secondary"
        disabled={page * limit >= total}
        onClick={() => setPage(page + 1)}
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  ) : null;
}
function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useContext(Auth);
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (admin && !user.roles.includes('admin')) return <Empty title="Admin access required" />;
  return children;
}
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      setUser(await api<User>('/me'));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <Auth.Provider value={{ user, loading, refresh }}>
      <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
        <a
          className="visually-hidden-focusable position-absolute top-0 start-0 btn btn-primary m-2 z-3"
          href="#main"
        >
          Skip to content
        </a>
        <SiteHeader
          user={user}
          onSignOut={async () => {
            await post('/auth/logout');
            await refresh();
          }}
        />
        <main id="main" className="flex-grow-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/experts/:slug" element={<ExpertDetail />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <Dashboard />
                </Protected>
              }
            />
            <Route
              path="/studio"
              element={
                <Protected>
                  <Studio />
                </Protected>
              }
            />
            <Route
              path="/admin"
              element={
                <Protected admin>
                  <Admin />
                </Protected>
              }
            />
            <Route path="/guidelines" element={<Guidelines />} />
            <Route
              path="*"
              element={
                <Empty title="This page isn't here">
                  <Link to="/">Explore experts</Link>
                </Empty>
              }
            />
          </Routes>
        </main>
        <SiteFooter />
      </div>
    </Auth.Provider>
  );
}

function ExpertDetail() {
  const { slug } = useParams();
  const info = useData(`/experts/${slug}`),
    [serviceId, setServiceId] = useState(''),
    [slotId, setSlotId] = useState(''),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const selected =
    info.data?.services.find((s: any) => s.id === serviceId) ?? info.data?.services[0];
  const slots = useData(selected ? `/services/${selected.id}/slots` : null);
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  if (info.loading) return <Loader />;
  if (info.error)
    return (
      <div className="container py-4 py-lg-5">
        <Alert>{info.error}</Alert>
      </div>
    );
  const e = info.data;
  async function book() {
    if (!user) {
      navigate('/auth');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ slotId, termsAccepted: accepted }),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container py-4 py-lg-5">
      <Link className="icon-link" to="/">
        <ChevronLeft size={16} /> Back to experts
      </Link>
      <div className="row g-4 mt-3">
        <div className="col-lg-7">
          <section>
            <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
              <div className="avatar avatar-lg bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold">
                {e.name
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')}
              </div>
              <div>
                <span className="badge text-bg-success d-inline-flex align-items-center gap-1 mb-2">
                  <ShieldCheck size={14} /> Verified expert
                </span>
                <h1>{e.name}</h1>
                <h3>{e.headline}</h3>
                <div className="d-flex flex-wrap align-items-center gap-3 small text-body-secondary">
                  <span>
                    <MapPin size={15} />
                    {e.city}
                  </span>
                  <span>
                    <Globe size={15} />
                    {e.languages.join(', ')}
                  </span>
                </div>
              </div>
            </div>
            <div className="card p-3 p-lg-4 mb-4 shadow-sm">
              <h2>A little about me</h2>
              <p className="text-break preserve">{e.bio}</p>
            </div>
            <div className="card p-3 p-lg-4 mb-4 shadow-sm">
              <h2>Ways we can work together</h2>
              {e.services.map((s: any) => (
                <button
                  className={`btn btn-outline-primary w-100 text-start d-flex flex-wrap justify-content-between gap-3 mb-3 p-3 ${selected?.id === s.id ? 'active' : ''}`}
                  key={s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setSlotId('');
                  }}
                >
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                    <span>
                      <Clock size={14} /> {s.durationMinutes} min ·{' '}
                      {s.mode === 'online' ? 'Google Meet' : s.location}
                    </span>
                  </div>
                  <strong>{formatMoney(s.pricePaise)}</strong>
                </button>
              ))}
            </div>
            <div className="card p-3 p-lg-4 mb-4 shadow-sm">
              <h2>Verified customer reviews</h2>
              {e.reviews.length ? (
                e.reviews.map((r: any) => (
                  <article className="border-top pt-3 mt-3" key={r._id}>
                    <span className="d-inline-flex align-items-center gap-1 small text-warning-emphasis">
                      <Star size={15} />
                      {r.rating}/5 · Verified booking
                    </span>
                    <p>{r.text}</p>
                  </article>
                ))
              ) : (
                <p>No reviews yet. Only customers with completed paid bookings can review.</p>
              )}
            </div>
          </section>
        </div>
        <div className="col-lg-5">
          <aside className="card p-3 p-lg-4 mb-4 shadow-sm">
            <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
              MAKE SOME TIME
            </span>
            <h2>{selected.title}</h2>
            <p>
              <Clock size={16} /> {selected.durationMinutes} minutes{' '}
              <span className="fs-3 fw-bold">{formatMoney(selected.pricePaise)}</span>
            </p>
            <hr />
            <h3>Choose your time</h3>
            <p className="text-body-secondary small">
              Shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
            {slots.loading ? (
              <Loader />
            ) : slots.error ? (
              <Alert>{slots.error}</Alert>
            ) : slots.data?.items.length ? (
              <div className="d-flex flex-wrap gap-2 mb-3">
                {slots.data.items.map((s: any) => (
                  <button
                    key={s._id}
                    className={`btn btn-outline-primary btn-sm ${slotId === s._id ? 'active' : ''}`}
                    onClick={() => setSlotId(s._id)}
                  >
                    {date(s.startsAt)}
                  </button>
                ))}
              </div>
            ) : (
              <p>No upcoming slots. Check back soon.</p>
            )}
            <label className="d-flex align-items-start gap-2 form-check-label mb-3">
              <input
                className="form-check-input flex-shrink-0"
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I accept the <Link to="/guidelines">beta booking and cancellation guidelines</Link>.
              </span>
            </label>
            {error && <Alert>{error}</Alert>}
            <button
              className="btn btn-primary w-100"
              disabled={!slotId || !accepted || busy}
              onClick={book}
            >
              {busy ? 'Reserving…' : 'Reserve this session'}
              <ArrowRight size={16} />
            </button>
            <p className="small text-body-secondary mt-3">
              Your time is held for 10 minutes while you complete payment. Confirmation follows the
              expert’s current policy.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const { user, refresh } = useContext(Auth);
  const config = useData('/config');
  const [mode, setMode] = useState('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [phone, setPhone] = useState(''),
    [sent, setSent] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!config.data?.googleClientId) return;
    let active = true;
    Promise.all([loadScript('https://accounts.google.com/gsi/client'), api('/auth/google/nonce')])
      .then(([, nonce]) => {
        if (!active || !googleRef.current) return;
        window.google.accounts.id.initialize({
          client_id: config.data.googleClientId,
          nonce: nonce.nonce,
          callback: async (response: any) => {
            try {
              await post('/auth/google', { credential: response.credential });
              await refresh();
              navigate('/dashboard');
            } catch (e) {
              setError(msg(e));
            }
          },
        });
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: 'outline',
          size: 'large',
          width: 300,
        });
      })
      .catch((e) => setError(msg(e)));
    return () => {
      active = false;
    };
  }, [config.data?.googleClientId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await post('/auth/register', { name, email, password });
        setMode('verify');
        setNotice('Check your email for a verification code.');
      } else if (mode === 'verify') {
        await post('/auth/email/verify', { email, code });
        await refresh();
        navigate('/dashboard');
      } else if (mode === 'phone') {
        if (!sent) {
          await post('/auth/phone/request', { phone });
          setSent(true);
          setNotice('Enter the code sent to your phone.');
        } else {
          await post('/auth/phone/verify', { phone, code });
          await refresh();
          navigate('/dashboard');
        }
      } else if (mode === 'reset') {
        if (!sent) {
          await post('/auth/password/request', { email });
          setSent(true);
          setNotice('If eligible, a reset code has been sent.');
        } else {
          await post('/auth/password/reset', { email, code, password });
          setMode('login');
          setNotice('Password updated. You can now sign in.');
        }
      } else {
        await post('/auth/login', { email, password });
        await refresh();
        navigate('/dashboard');
      }
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container py-4 py-lg-5">
      <div className="row g-4 align-items-center">
        <div className="col-lg-5 d-none d-lg-block">
          <section className="bg-primary text-white rounded p-4 p-xl-5">
            <Compass size={48} strokeWidth={1} />
            <h1>
              A good conversation
              <br />
              can change
              <br />
              <em>what comes next.</em>
            </h1>
            <p>
              Find perspective. Share experience.
              <br />
              Make room for your next chapter.
            </p>
            <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
              WELCOME TO EXPERT MARKET
            </span>
          </section>
        </div>
        <div className="col-lg-7">
          <section className="card p-3 p-lg-4 shadow-sm">
            <div className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
              {user ? 'ACCOUNT CONNECTIONS' : 'YOUR NEXT STEP'}
            </div>
            <h2>
              {mode === 'register'
                ? 'Join the conversation'
                : mode === 'verify'
                  ? 'Verify your email'
                  : mode === 'phone'
                    ? 'Sign in with your phone'
                    : mode === 'reset'
                      ? 'Reset your password'
                      : 'Welcome back'}
            </h2>
            <p className="text-body-secondary small">
              {config.data?.betaAccess === 'invite'
                ? 'Our controlled beta is invitation-only.'
                : 'Sign in to manage your appointments.'}
            </p>
            <div className="nav nav-pills flex-wrap gap-2 mb-4">
              {[
                ['login', 'Email'],
                ['register', 'Create account'],
                ['phone', 'Phone OTP'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={mode === value ? 'nav-link active' : 'nav-link'}
                  onClick={() => {
                    setMode(value);
                    setSent(false);
                    setError('');
                    setNotice('');
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {error && <Alert>{error}</Alert>}
            {notice && <Alert kind="success">{notice}</Alert>}
            <form onSubmit={submit}>
              {mode === 'register' && (
                <Field label="Your name">
                  <input
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                  />
                </Field>
              )}
              {mode === 'phone' ? (
                <Field label="Phone number with country code">
                  <input
                    className="form-control"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91…"
                    required
                  />
                </Field>
              ) : (
                <Field label="Email address">
                  <input
                    className="form-control"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </Field>
              )}
              {(mode === 'verify' || sent) && (
                <Field label="Verification code">
                  <input
                    className="form-control"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                  />
                </Field>
              )}
              {(['login', 'register'].includes(mode) || (mode === 'reset' && sent)) && (
                <Field label={mode === 'login' ? 'Password' : 'Password · at least 12 characters'}>
                  <input
                    className="form-control"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={mode === 'login' ? 1 : 12}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                  />
                </Field>
              )}
              <button className="btn btn-primary w-100" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'register'
                    ? 'Create account'
                    : mode === 'verify'
                      ? 'Verify email'
                      : mode === 'phone' && !sent
                        ? 'Send OTP'
                        : mode === 'reset'
                          ? sent
                            ? 'Update password'
                            : 'Send reset code'
                          : 'Continue'}
                <ArrowRight size={16} />
              </button>
            </form>
            {mode === 'login' && (
              <div className="d-flex flex-wrap justify-content-between gap-3 mt-3">
                <button
                  className="btn btn-link p-0"
                  onClick={() => {
                    setMode('reset');
                    setSent(false);
                  }}
                >
                  Forgot password?
                </button>
                <button className="btn btn-link p-0" onClick={() => setMode('verify')}>
                  Verify email
                </button>
              </div>
            )}
            {mode === 'verify' && (
              <button
                className="btn btn-link p-0"
                onClick={async () => {
                  try {
                    await post('/auth/email/request', { email });
                    setNotice('If eligible, a new code has been sent.');
                  } catch (e) {
                    setError(msg(e));
                  }
                }}
              >
                Resend code
              </button>
            )}
            <div className="mt-4" ref={googleRef} />
            {!config.data?.googleClientId && (
              <p className="small text-body-secondary mt-3">
                Google sign-in will be available when the beta integration is connected.
              </p>
            )}
            {mode === 'phone' && (
              <p className="small text-body-secondary mt-3">
                Invited beta members: sign in by email first, then use this page to link your phone.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useContext(Auth);
  const [scope, setScope] = useState('customer'),
    [page, setPage] = useState(1),
    [error, setError] = useState('');
  const bookings = useData(`/bookings?scope=${scope}&page=${page}`),
    config = useData('/config');
  async function action(id: string, action: string) {
    setError('');
    try {
      await post(`/bookings/${id}/action`, { action });
      bookings.reload();
    } catch (e) {
      setError(msg(e));
    }
  }
  return (
    <div className="container py-4 py-lg-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
            YOUR PERSONAL SPACE
          </span>
          <h1>Good to see you, {user?.name.split(' ')[0]}.</h1>
          <p>Keep your conversations and next steps in one place.</p>
        </div>
        <Link className="btn btn-primary" to="/">
          Find an expert <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="nav nav-pills flex-wrap gap-2 mb-4">
        <button
          className={scope === 'customer' ? 'nav-link active' : 'nav-link'}
          onClick={() => {
            setScope('customer');
            setPage(1);
          }}
        >
          My bookings
        </button>
        {user?.roles.includes('expert') && (
          <button
            className={scope === 'expert' ? 'nav-link active' : 'nav-link'}
            onClick={() => {
              setScope('expert');
              setPage(1);
            }}
          >
            Expert appointments
          </button>
        )}
        <Link to="/studio">
          Expert studio <ArrowUpRight size={14} />
        </Link>
        <Link to="/auth">Link Google / phone</Link>
      </div>
      {!config.data?.checkoutEnabled && (
        <Alert kind="info">
          Payments are disabled in this build. Reserved slots expire automatically after 10 minutes.
          No money will be collected.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {bookings.loading ? (
        <Loader />
      ) : bookings.error ? (
        <Alert>{bookings.error}</Alert>
      ) : !bookings.data?.items.length ? (
        <Empty title="Your next conversation is waiting">
          <Link to="/">Explore experts and find your first session.</Link>
        </Empty>
      ) : (
        <div className="vstack gap-3">
          {bookings.data.items.map((b: any) => (
            <BookingCard
              key={b._id}
              b={b}
              scope={scope}
              action={action}
              reload={bookings.reload}
              checkoutEnabled={!!config.data?.checkoutEnabled}
              onError={setError}
            />
          ))}
        </div>
      )}
      <Pager page={page} setPage={setPage} total={bookings.data?.total ?? 0} />
    </div>
  );
}
function BookingCard({
  b,
  scope,
  action,
  reload,
  checkoutEnabled,
  onError,
}: {
  b: any;
  scope: string;
  action: (id: string, action: string) => void;
  reload: () => void;
  checkoutEnabled: boolean;
  onError: (s: string) => void;
}) {
  const [review, setReview] = useState(false),
    [rating, setRating] = useState('5'),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  return (
    <article className="card p-3 p-lg-4 flex-lg-row gap-3">
      <div className="text-primary bg-primary-subtle rounded p-3 align-self-start">
        <CalendarDays size={25} />
      </div>
      <div className="flex-grow-1 text-break">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className={`badge ${statusColor(b.status)}`}>{b.status.replaceAll('_', ' ')}</span>
          <span className="text-body-secondary small">{b.paymentStatus.replaceAll('_', ' ')}</span>
        </div>
        <h3>{b.title}</h3>
        <p>
          {date(b.startsAt)} · {b.mode === 'online' ? 'Online' : b.location}
        </p>
        <small className="text-body-secondary small">Booking {b._id}</small>
        {b.status === 'confirmed' &&
          b.mode === 'online' &&
          (b.meetingUrl ? (
            <a className="icon-link" href={b.meetingUrl} target="_blank" rel="noreferrer">
              <Video size={15} /> Join Google Meet
            </a>
          ) : (
            <p className="small text-body-secondary mt-3">
              Meeting link: {b.meetingStatus}. Contact the marketplace team if it remains
              unavailable.
            </p>
          ))}
        {b.paymentStatus === 'refund_required' && (
          <p className="small text-body-secondary mt-3">
            A refund needs operator processing. Your dashboard will update after reconciliation.
          </p>
        )}
        {notice && <Alert kind="success">{notice}</Alert>}
        {review && (
          <form
            className="mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await post(`/bookings/${b._id}/review`, { rating: Number(rating), text });
                setReview(false);
                setNotice('Your verified review has been published.');
                reload();
              } catch (err) {
                onError(msg(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Rating">
              <select
                className="form-select"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your experience">
              <textarea
                className="form-control"
                value={text}
                onChange={(e) => setText(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
              />
            </Field>
            <button className="btn btn-primary btn-sm" disabled={busy}>
              Publish verified review
            </button>
          </form>
        )}
      </div>
      <div className="d-flex flex-wrap flex-lg-column align-items-lg-end gap-2">
        <strong>{formatMoney(b.grossPaise)}</strong>
        {b.status === 'held' && scope === 'customer' && (
          <button
            className="btn btn-primary btn-sm"
            disabled={!checkoutEnabled || busy || new Date(b.holdUntil) <= new Date()}
            onClick={async () => {
              setBusy(true);
              try {
                await checkout(b._id, reload, onError);
              } catch (e) {
                onError(msg(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Complete payment
          </button>
        )}
        {scope === 'expert' && b.status === 'pending_confirmation' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={() => action(b._id, 'accept')}>
              Accept
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => action(b._id, 'reject')}
            >
              Decline & refund
            </button>
          </>
        )}
        {scope === 'expert' && b.status === 'confirmed' && new Date(b.endsAt) < new Date() && (
          <button className="btn btn-primary btn-sm" onClick={() => action(b._id, 'complete')}>
            Mark completed
          </button>
        )}
        {['held', 'pending_confirmation', 'confirmed'].includes(b.status) &&
          new Date(b.startsAt) > new Date() && (
            <button
              className="btn btn-link p-0"
              onClick={() => {
                if (
                  window.confirm(
                    'Cancel this booking? A captured payment will enter the refund queue.',
                  )
                )
                  action(b._id, 'cancel');
              }}
            >
              Cancel booking
            </button>
          )}
        {scope === 'customer' &&
          b.status === 'completed' &&
          b.paymentStatus === 'captured' &&
          !notice && (
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setReview(!review)}>
              Leave a review
            </button>
          )}
      </div>
    </article>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [page, setPage] = useState(1);
  const categories = useData(`/categories?limit=100&page=${page}`);
  return (
    <>
      <select
        className="form-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      >
        <option value="">Select expertise</option>
        {value && !categories.data?.items.some((c: any) => c._id === value) && (
          <option value={value}>Current category</option>
        )}
        {categories.data?.items.map((c: any) => (
          <option value={c._id} key={c._id}>
            {c.name}
          </option>
        ))}
      </select>
      {categories.error && <small role="alert">{categories.error}</small>}
      {categories.data?.total > 100 && (
        <button
          type="button"
          className="btn btn-link p-0"
          onClick={() => setPage((p) => (p * 100 >= categories.data.total ? 1 : p + 1))}
        >
          Next category page
        </button>
      )}
    </>
  );
}
function Studio() {
  const { refresh } = useContext(Auth),
    profile = useData('/expert/profile');
  const [tab, setTab] = useState('profile'),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [category, setCategory] = useState('');
  useEffect(() => {
    if (profile.data) setCategory(String(profile.data.categories[0] ?? ''));
  }, [profile.data]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await post(
        '/expert/profile',
        {
          slug: f.get('slug'),
          headline: f.get('headline'),
          bio: f.get('bio'),
          categories: [category],
          languages: String(f.get('languages'))
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          city: f.get('city'),
          timezone: f.get('timezone'),
          experienceYears: Number(f.get('experienceYears')),
          confirmationPolicy: f.get('confirmationPolicy'),
        },
        'PUT',
      );
      await refresh();
      profile.reload();
      setNotice('Profile submitted for admin review.');
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  const d = profile.data;
  return (
    <div className="container py-4 py-lg-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
            EXPERT STUDIO
          </span>
          <h1>Make your experience count.</h1>
          <p>Your profile, your services, your schedule.</p>
        </div>
        {d && <span className={`badge ${statusColor(d.verification)}`}>{d.verification}</span>}
      </div>
      <div className="nav nav-pills flex-wrap gap-2 mb-4">
        {['profile', 'services', 'availability', 'earnings'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'nav-link active' : 'nav-link'}
            disabled={!d && t !== 'profile'}
          >
            {t}
          </button>
        ))}
        <Link to="/dashboard">
          Manage appointments <ArrowUpRight size={14} />
        </Link>
      </div>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      {tab === 'profile' &&
        (profile.loading ? (
          <Loader />
        ) : profile.error ? (
          <Alert>{profile.error}</Alert>
        ) : (
          <form
            className="card p-3 p-lg-4 mb-4 shadow-sm"
            key={d?.updatedAt ?? 'new'}
            onSubmit={save}
          >
            <h2>{d ? 'Your public profile' : 'Introduce yourself'}</h2>
            <p className="text-body-secondary small">
              Your profile goes live after admin verification. Updates to professional claims
              require a new review.
            </p>
            {d?.reviewReason && <Alert kind="info">Review note: {d.reviewReason}</Alert>}
            <div className="row row-cols-1 row-cols-md-2 gx-4">
              <Field label="Public profile slug">
                <input
                  className="form-control"
                  name="slug"
                  defaultValue={d?.slug}
                  placeholder="your-name"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={60}
                  required
                />
              </Field>
              <Field label="Primary expertise">
                <CategorySelect value={category} onChange={setCategory} />
              </Field>
              <Field label="Headline">
                <input
                  className="form-control"
                  name="headline"
                  defaultValue={d?.headline}
                  minLength={10}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Experience in years">
                <input
                  className="form-control"
                  name="experienceYears"
                  type="number"
                  defaultValue={d?.experienceYears ?? 0}
                  min={0}
                  max={70}
                  required
                />
              </Field>
              <Field label="City">
                <input
                  className="form-control"
                  name="city"
                  defaultValue={d?.city}
                  required
                  minLength={2}
                />
              </Field>
              <Field label="Languages · comma separated">
                <input
                  className="form-control"
                  name="languages"
                  defaultValue={d?.languages?.join(', ') ?? 'English'}
                  required
                />
              </Field>
              <Field label="Timezone">
                <input
                  className="form-control"
                  name="timezone"
                  defaultValue={d?.timezone ?? 'Asia/Kolkata'}
                  required
                />
              </Field>
              <Field label="Booking confirmation preference">
                <select
                  className="form-select"
                  name="confirmationPolicy"
                  defaultValue={d?.confirmationPolicy ?? 'manual'}
                >
                  <option value="manual">I approve each paid request</option>
                  <option value="auto">Confirm automatically after payment</option>
                </select>
              </Field>
            </div>
            <Field label="About your experience">
              <textarea
                className="form-control"
                name="bio"
                defaultValue={d?.bio}
                rows={6}
                minLength={30}
                maxLength={3000}
                required
              />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Submit for verification'}
              <ArrowRight size={16} />
            </button>
          </form>
        ))}
      {d && tab === 'services' && <ServicesEditor />}
      {d && tab === 'availability' && <Availability />}
      {d && tab === 'earnings' && <Earnings />}
    </div>
  );
}
function ServicesEditor() {
  const services = useData('/expert/services');
  const [editing, setEditing] = useState<any>(null),
    [category, setCategory] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await post(
        `/expert/services${editing ? `/${editing._id}` : ''}`,
        {
          title: f.get('title'),
          description: f.get('description'),
          categoryId: category,
          durationMinutes: Number(f.get('durationMinutes')),
          pricePaise: Math.round(Number(f.get('price')) * 100),
          mode: f.get('mode'),
          location: f.get('location'),
          ...(f.get('confirmationPolicy')
            ? { confirmationPolicy: f.get('confirmationPolicy') }
            : {}),
          active: f.get('active') === 'on',
        },
        editing ? 'PUT' : 'POST',
      );
      setEditing(null);
      setCategory('');
      form.reset();
      services.reload();
      setNotice('Service saved. Approved profiles and active services are discoverable.');
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <section className="card p-3 p-lg-4 mb-4 shadow-sm">
          <h2>Your services</h2>
          {services.error && <Alert>{services.error}</Alert>}
          {services.loading ? (
            <Loader />
          ) : services.data?.items.length ? (
            services.data.items.map((s: any) => (
              <button
                className="btn btn-outline-primary w-100 text-start d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3 p-3"
                key={s._id}
                onClick={() => {
                  setEditing(s);
                  setCategory(String(s.categoryId));
                }}
              >
                <div>
                  <h3>{s.title}</h3>
                  <p>
                    {s.durationMinutes} min · {s.active ? 'Published' : 'Archived'}
                  </p>
                </div>
                <strong>{formatMoney(s.pricePaise)}</strong>
              </button>
            ))
          ) : (
            <p>Add your first service to start accepting appointments.</p>
          )}
          <button
            className="btn btn-link p-0"
            onClick={() => {
              setEditing(null);
              setCategory('');
            }}
          >
            + Add a new service
          </button>
        </section>
      </div>
      <div className="col-lg-6">
        <form
          key={editing?._id ?? 'new'}
          className="card p-3 p-lg-4 mb-4 shadow-sm"
          onSubmit={submit}
        >
          <h2>{editing ? 'Edit service' : 'Create a service'}</h2>
          {error && <Alert>{error}</Alert>}
          {notice && <Alert kind="success">{notice}</Alert>}
          <Field label="Service title">
            <input
              className="form-control"
              name="title"
              defaultValue={editing?.title}
              minLength={4}
              maxLength={120}
              required
            />
          </Field>
          <Field label="Category">
            <CategorySelect value={category} onChange={setCategory} />
          </Field>
          <Field label="What will the customer get?">
            <textarea
              className="form-control"
              name="description"
              defaultValue={editing?.description}
              minLength={20}
              maxLength={2000}
              rows={4}
              required
            />
          </Field>
          <div className="row row-cols-1 row-cols-md-2 gx-4">
            <Field label="Duration (minutes)">
              <input
                className="form-control"
                type="number"
                name="durationMinutes"
                defaultValue={editing?.durationMinutes ?? 45}
                min={15}
                max={240}
                step={15}
                required
              />
            </Field>
            <Field label="Total price (INR)">
              <input
                className="form-control"
                type="number"
                name="price"
                defaultValue={editing ? editing.pricePaise / 100 : 1499}
                min={1}
                max={100000}
                step="0.01"
                required
              />
            </Field>
            <Field label="Session format">
              <select className="form-select" name="mode" defaultValue={editing?.mode ?? 'online'}>
                <option value="online">Online · Google Meet</option>
                <option value="in_person">In person</option>
              </select>
            </Field>
            <Field label="Confirmation">
              <select
                className="form-select"
                name="confirmationPolicy"
                defaultValue={editing?.confirmationPolicy ?? ''}
              >
                <option value="">Use profile preference</option>
                <option value="auto">Automatic</option>
                <option value="manual">Manual approval</option>
              </select>
            </Field>
          </div>
          <Field label="Location · required for in-person sessions">
            <input
              className="form-control"
              name="location"
              defaultValue={editing?.location ?? ''}
              maxLength={300}
            />
          </Field>
          <label className="d-flex align-items-start gap-2 form-check-label mb-3">
            <input
              className="form-check-input flex-shrink-0"
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />{' '}
            Publish this service
          </label>
          <button className="btn btn-primary" disabled={busy}>
            Save service <Check size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
function Availability() {
  const services = useData('/expert/services'),
    slots = useData('/expert/slots?limit=100');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <form
          className="card p-3 p-lg-4 mb-4 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              await post('/expert/slots', {
                serviceId: f.get('serviceId'),
                startsAt: new Date(String(f.get('startsAt'))).toISOString(),
              });
              slots.reload();
              setNotice('Availability added.');
            } catch (err) {
              setError(msg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Open time for a conversation</h2>
          <p className="text-body-secondary small">
            Choose a date in your device’s timezone:{' '}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}. Start times must be on a 15-minute
            boundary and at least an hour away.
          </p>
          {error && <Alert>{error}</Alert>}
          {notice && <Alert kind="success">{notice}</Alert>}
          <Field label="Service">
            <select className="form-select" name="serviceId" required>
              <option value="">Choose a service</option>
              {services.data?.items
                .filter((s: any) => s.active)
                .map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.title} · {s.durationMinutes} min
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Date and start time">
            <input
              className="form-control"
              type="datetime-local"
              name="startsAt"
              step={900}
              required
            />
          </Field>
          <button className="btn btn-primary" disabled={busy}>
            Add availability <CalendarDays size={16} />
          </button>
        </form>
      </div>
      <div className="col-lg-6">
        <section className="card p-3 p-lg-4 mb-4 shadow-sm">
          <h2>Upcoming availability</h2>
          {slots.loading ? (
            <Loader />
          ) : slots.error ? (
            <Alert>{slots.error}</Alert>
          ) : slots.data?.items.length ? (
            slots.data.items.map((s: any) => (
              <div
                className="d-flex flex-wrap justify-content-between align-items-center gap-3 border-bottom py-3"
                key={s._id}
              >
                <div>
                  <strong>{date(s.startsAt)}</strong>
                  <p>{s.status}</p>
                </div>
                {s.status === 'open' && (
                  <button
                    aria-label={`Close slot ${date(s.startsAt)}`}
                    className="btn btn-outline-danger btn-sm"
                    onClick={async () => {
                      try {
                        await api(`/expert/slots/${s._id}`, { method: 'DELETE' });
                        slots.reload();
                      } catch (e) {
                        setError(msg(e));
                      }
                    }}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No availability added yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
function Earnings() {
  const data = useData('/expert/earnings');
  return (
    <>
      <div className="card p-3 p-lg-4 mb-4 shadow-sm">
        <h2>Your earnings</h2>
        <p className="text-body-secondary small">
          Captured payments are shown by booking status. Earnings become eligible for payout only
          after completion, reconciliation and the payout delay.
        </p>
        {data.loading ? (
          <Loader />
        ) : data.error ? (
          <Alert>{data.error}</Alert>
        ) : (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-4">
            {data.data?.totals.map((t: any) => (
              <article key={t._id}>
                <div className="card card-body h-100 gap-2">
                  <span>{t._id}</span>
                  <strong className="fs-2 fw-semibold">{formatMoney(t.netPaise)}</strong>
                  <small>
                    {t.count} sessions · {formatMoney(t.grossPaise)} gross
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="card p-3 p-lg-4 mb-4 shadow-sm">
        <h2>Payout history</h2>
        {data.data?.payouts.length ? (
          data.data.payouts.map((p: any) => (
            <div
              className="d-flex flex-wrap justify-content-between align-items-center gap-3 border-bottom py-3"
              key={p._id}
            >
              <span>
                {p.mode} · {p.status}
              </span>
              <strong>{formatMoney(p.amountPaise)}</strong>
              <span>{p.reference ?? p.providerId ?? 'Reconciliation pending'}</span>
            </div>
          ))
        ) : (
          <p>No payouts recorded.</p>
        )}
      </div>
    </>
  );
}

function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="container py-4 py-lg-5">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
            MARKETPLACE OPERATIONS
          </span>
          <h1>Keep good connections running.</h1>
          <p>Verification, policies and every detail that builds trust.</p>
        </div>
        <span className="badge text-bg-warning align-self-start">Controlled beta</span>
      </div>
      <div className="nav nav-pills flex-wrap gap-2 mb-4">
        {['overview', 'experts', 'categories', 'policies', 'payments', 'invitations'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'nav-link active' : 'nav-link'}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'overview' && <AdminOverview />}
      {tab === 'experts' && <AdminExperts />}
      {tab === 'categories' && <AdminCategories />}
      {tab === 'policies' && <AdminPolicies />}
      {tab === 'payments' && <AdminPayments />}
      {tab === 'invitations' && <Invitations />}
    </div>
  );
}
function AdminOverview() {
  const o = useData('/admin/overview'),
    exceptions = useData('/admin/exceptions');
  return (
    <>
      {o.error && <Alert>{o.error}</Alert>}
      {o.loading ? (
        <Loader />
      ) : (
        o.data && (
          <>
            <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-4">
              {[
                ['Experts awaiting review', o.data.pendingExperts],
                ['Total bookings', o.data.bookings],
                ['Refunds to process', o.data.refundsRequired],
                ['Failed notification jobs', o.data.failedJobs],
              ].map(([label, value]) => (
                <article key={label}>
                  <div className="card card-body h-100 gap-2">
                    <span>{label}</span>
                    <strong className="fs-2 fw-semibold">{value}</strong>
                  </div>
                </article>
              ))}
            </div>
            <div className="card p-3 p-lg-4 mb-4 shadow-sm">
              <h2>Payment readiness</h2>
              {o.data.paymentBlockers.length ? (
                o.data.paymentBlockers.map((b: string) => (
                  <Alert key={b} kind="info">
                    {b}
                  </Alert>
                ))
              ) : (
                <p>
                  Test checkout is configured. Live launch still requires the complete release
                  review.
                </p>
              )}
              <div className="d-flex flex-wrap gap-3 my-4">
                {Object.entries(o.data.providerStatus).map(([key, value]) => (
                  <span key={key}>
                    <span
                      className={`badge rounded-pill ${value ? 'text-bg-success' : 'text-bg-secondary'}`}
                    />
                    {key}: {value ? 'configured' : 'not connected'}
                  </span>
                ))}
              </div>
              <p className="small text-body-secondary mt-3">
                Configured does not mean externally tested or approved.
              </p>
            </div>
            <div className="card p-3 p-lg-4 mb-4 shadow-sm">
              <h2>Exception queue</h2>
              {exceptions.error && <Alert>{exceptions.error}</Alert>}
              <p>
                {exceptions.data?.bookings.length ?? 0} booking exceptions ·{' '}
                {exceptions.data?.payouts.length ?? 0} payouts awaiting reconciliation ·{' '}
                {exceptions.data?.jobs.length ?? 0} failed jobs
              </p>
              <p>
                Use Payments to reconcile captured/refunded payments. Ambiguous provider orders and
                transfers must be reviewed before retrying.
              </p>
            </div>
          </>
        )
      )}
    </>
  );
}
function AdminExperts() {
  const [page, setPage] = useState(1),
    [error, setError] = useState('');
  const experts = useData(`/admin/experts?page=${page}`);
  async function verify(e: any, status: string) {
    const reason = window.prompt(`Reason for ${status} (at least 5 characters):`);
    if (!reason) return;
    try {
      await post(`/admin/experts/${e._id}/verification`, { status, reason }, 'PATCH');
      experts.reload();
    } catch (err) {
      setError(msg(err));
    }
  }
  return (
    <div className="card p-3 p-lg-4 mb-4 shadow-sm">
      <h2>Expert verification</h2>
      {error && <Alert>{error}</Alert>}
      {experts.error && <Alert>{experts.error}</Alert>}
      {experts.loading ? (
        <Loader />
      ) : (
        experts.data?.items.map((e: any) => (
          <article
            className="d-flex flex-column flex-lg-row justify-content-between gap-3 border-top py-4"
            key={e._id}
          >
            <div>
              <span className={`badge ${statusColor(e.verification)}`}>{e.verification}</span>
              <h3>{e.userId.name}</h3>
              <p>{e.headline}</p>
              <p>{e.bio}</p>
              <small>
                {e.userId.email} · {e.city} · {e.experienceYears} years
              </small>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => verify(e, 'approved')}>
                Approve
              </button>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => verify(e, 'rejected')}
              >
                Reject
              </button>
              <button className="btn btn-link p-0" onClick={() => verify(e, 'suspended')}>
                Suspend
              </button>
            </div>
          </article>
        ))
      )}
      <Pager page={page} setPage={setPage} total={experts.data?.total ?? 0} />
    </div>
  );
}
function AdminCategories() {
  const [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const categories = useData(`/admin/categories?page=${page}`);
  return (
    <div className="row g-4">
      <div className="col-lg-6">
        <section className="card p-3 p-lg-4 mb-4 shadow-sm">
          <h2>Professional categories</h2>
          <p className="text-body-secondary small">
            Create as many categories as the marketplace needs. Archiving hides their services from
            discovery.
          </p>
          {categories.error && <Alert>{categories.error}</Alert>}
          {categories.data?.items.map((c: any) => (
            <button
              className="btn btn-outline-secondary w-100 text-start d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"
              key={c._id}
              onClick={() => setEditing(c)}
            >
              <span>{c.name}</span>
              <span className="text-body-secondary small">
                {c.active ? 'Active' : 'Archived'} <ChevronRight size={15} />
              </span>
            </button>
          ))}
          <Pager page={page} setPage={setPage} total={categories.data?.total ?? 0} />
        </section>
      </div>
      <div className="col-lg-6">
        <form
          key={editing?._id ?? 'new'}
          className="card p-3 p-lg-4 mb-4 shadow-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError('');
            setBusy(true);
            try {
              await post(
                `/admin/categories${editing ? `/${editing._id}` : ''}`,
                { name: f.get('name'), slug: f.get('slug'), active: f.get('active') === 'on' },
                editing ? 'PUT' : 'POST',
              );
              setEditing(null);
              categories.reload();
            } catch (err) {
              setError(msg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{editing ? 'Edit category' : 'Add a category'}</h2>
          {error && <Alert>{error}</Alert>}
          <Field label="Category name">
            <input
              className="form-control"
              name="name"
              defaultValue={editing?.name}
              minLength={2}
              required
            />
          </Field>
          <Field label="Unique slug">
            <input
              className="form-control"
              name="slug"
              defaultValue={editing?.slug}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
          </Field>
          <label className="d-flex align-items-start gap-2 form-check-label mb-3">
            <input
              className="form-check-input flex-shrink-0"
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />{' '}
            Active category
          </label>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-primary" disabled={busy}>
              Save category
            </button>
            <button className="btn btn-link p-0" type="button" onClick={() => setEditing(null)}>
              New category
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function AdminPolicies() {
  const settings = useData('/admin/settings');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  if (settings.loading) return <Loader />;
  if (settings.error) return <Alert>{settings.error}</Alert>;
  const s = settings.data;
  return (
    <form
      className="card p-3 p-lg-4 mb-4 shadow-sm"
      key={s.updatedAt}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        try {
          await post(
            '/admin/settings',
            {
              commissionBps: Math.round(Number(f.get('commission')) * 100),
              confirmationPolicy: f.get('policy'),
              payoutMode: f.get('payoutMode'),
              payoutDelayHours: Number(f.get('delay')),
            },
            'PUT',
          );
          setNotice(
            'Policies saved. Existing bookings keep their original price, commission and confirmation policy.',
          );
          settings.reload();
        } catch (err) {
          setError(msg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Marketplace policies</h2>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <div className="row row-cols-1 row-cols-md-2 gx-4">
        <Field label="Platform commission (%)">
          <input
            className="form-control"
            type="number"
            name="commission"
            defaultValue={s.commissionBps / 100}
            min={0}
            max={100}
            step="0.01"
            required
          />
        </Field>
        <Field label="Booking confirmation">
          <select className="form-select" name="policy" defaultValue={s.confirmationPolicy}>
            <option value="expert_choice">Let experts choose</option>
            <option value="force_auto">Always automatic after capture</option>
            <option value="force_manual">Always require manual approval</option>
          </select>
        </Field>
        <Field label="Expert payout mode">
          <select className="form-select" name="payoutMode" defaultValue={s.payoutMode}>
            <option value="manual">Manual · record external payment</option>
            <option value="automatic">Automatic · conditional Razorpay Route</option>
          </select>
        </Field>
        <Field label="Payout delay after session (hours)">
          <input
            className="form-control"
            type="number"
            name="delay"
            defaultValue={s.payoutDelayHours}
            min={24}
            max={720}
            required
          />
        </Field>
      </div>
      <Alert kind="info">
        Automatic payouts require Route approval, a ready linked account and reconciliation. This
        setting cannot enable live transactions.
      </Alert>
      <button className="btn btn-primary" disabled={busy}>
        Save policies <Check size={17} />
      </button>
    </form>
  );
}
function AdminPayments() {
  const [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const bookings = useData(`/bookings?scope=admin&page=${page}`);
  async function run(b: any, kind: string) {
    setError('');
    setNotice('');
    try {
      let data = {};
      if (kind === 'payout') {
        const reference = window.prompt(
          'Manual payout: enter the completed external payment reference. For configured Route mode, enter ROUTE.',
        );
        if (!reference) return;
        data = reference === 'ROUTE' ? {} : { reference };
        if (
          !window.confirm(
            'Record or submit this payout? Only reconciled eligible bookings are accepted.',
          )
        )
          return;
      }
      await post(`/admin/bookings/${b._id}/${kind}`, data);
      bookings.reload();
      setNotice(
        `${kind === 'payout' ? 'Payout operation recorded' : 'Reconciliation completed'}. Review the updated status.`,
      );
    } catch (err) {
      setError(msg(err));
    }
  }
  return (
    <div className="card p-3 p-lg-4 mb-4 shadow-sm">
      <h2>Bookings, reconciliation & payouts</h2>
      <p className="text-body-secondary small">
        Refunds are processed by an operator in Razorpay during this implementation stage, then
        reconciled here. Never mark a provider transfer as settled without evidence.
      </p>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      {bookings.error && <Alert>{bookings.error}</Alert>}
      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Status</th>
              <th>Gross / expert net</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.data?.items.map((b: any) => (
              <tr key={b._id}>
                <td>
                  <strong>{b.title}</strong>
                  <small>{b._id}</small>
                  <small>{date(b.startsAt)}</small>
                </td>
                <td>
                  {b.status}
                  <small>
                    {b.paymentStatus}
                    {b.dispute ? ' · dispute' : ''}
                  </small>
                </td>
                <td>
                  {formatMoney(b.grossPaise)}
                  <small>{formatMoney(b.expertPaise)} net</small>
                </td>
                <td>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={!b.orderId}
                      onClick={() => run(b, 'reconcile')}
                    >
                      Reconcile
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={
                        b.status !== 'completed' || b.paymentStatus !== 'captured' || b.dispute
                      }
                      onClick={() => run(b, 'payout')}
                    >
                      Payout
                    </button>
                    {b.status === 'pending_confirmation' && (
                      <button
                        className="btn btn-link p-0"
                        onClick={async () => {
                          try {
                            await post(`/bookings/${b._id}/action`, { action: 'accept' });
                            bookings.reload();
                          } catch (e) {
                            setError(msg(e));
                          }
                        }}
                      >
                        Accept booking
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={bookings.data?.total ?? 0} />
    </div>
  );
}
function Invitations() {
  const [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="card p-3 p-lg-4 mb-4 shadow-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          await post('/admin/invites', { email: f.get('email'), active: f.get('active') === 'on' });
          setNotice('Beta access updated. This does not send an invitation email.');
          setError('');
        } catch (err) {
          setError(msg(err));
        }
      }}
    >
      <h2>Control beta access</h2>
      <p>
        Allow an email address to register or sign in. Share the beta link with that person
        separately.
      </p>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <Field label="Invited email">
        <input className="form-control" type="email" name="email" required />
      </Field>
      <label className="d-flex align-items-start gap-2 form-check-label mb-3">
        <input
          className="form-check-input flex-shrink-0"
          type="checkbox"
          name="active"
          defaultChecked
        />{' '}
        Allow beta access
      </label>
      <button className="btn btn-primary">Save access</button>
    </form>
  );
}
function Guidelines() {
  return (
    <div className="container py-4 py-lg-5">
      <span className="d-block small fw-semibold text-uppercase text-body-secondary mb-3">
        CONTROLLED BETA
      </span>
      <h1>Before your conversation.</h1>
      <div className="card p-3 p-lg-4 mb-4 shadow-sm">
        <h2>Booking and payment</h2>
        <p>
          Reserving a session holds its slot for 10 minutes. A booking is paid only after the
          payment provider confirms capture. Depending on the marketplace and expert’s policy,
          confirmation is automatic or requires approval.
        </p>
        <h2>Confirmation and meeting links</h2>
        <p>
          Manual requests expire after 24 hours or 30 minutes before the appointment, whichever
          comes first. Confirmed online sessions receive a Google Meet link in the private dashboard
          and by email. In-person sessions use the service’s stated location.
        </p>
        <h2>Cancellation and refunds</h2>
        <p>
          You may request a full refund by cancelling before the session starts. Declined, expired
          or late-paid bookings also enter the refund queue. Refund processing is handled by the
          marketplace team and reflected after payment reconciliation. After the session starts,
          contact the team for an individual review. Payouts remain on hold for unresolved disputes.
        </p>
        <h2>Reviews and verification</h2>
        <p>
          Only customers with a completed paid booking can leave one verified review. Professional
          verification is an admin review of the expert’s profile; it is not a guarantee of results
          or a substitute for professional licensing.
        </p>
        <h2>Beta availability</h2>
        <p>
          This is an invitation-only development beta. Payment, email, SMS and meeting availability
          depends on completed integration setup and release checks. Final terms, privacy policy,
          support contact and tax treatment must be published before external live bookings.
        </p>
      </div>
    </div>
  );
}
