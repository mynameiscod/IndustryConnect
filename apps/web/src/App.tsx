import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Globe,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  X,
} from 'lucide-react';
import { formatMoney } from '@market/contracts';
import { api, checkout, loadScript, post } from './api.js';

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
function Alert({ children, kind = 'error' }: { children: ReactNode; kind?: string }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Compass size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Loader() {
  return (
    <div className="loading" role="status">
      Loading your next step…
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
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
    <div className="pager">
      <button className="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={16} /> Previous
      </button>
      <span>Page {page}</span>
      <button
        className="secondary"
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
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="beta-strip">
        <span className="live-dot" /> BUILDING BETTER CONNECTIONS{' '}
        <span className="beta-label">Private beta · November 2026</span>
      </div>
      <header className="header">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Compass size={24} />
          </span>
          expert<span className="brand-light">market</span>
          <span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/">Explore experts</NavLink>
          <NavLink to="/studio">
            Become an expert <ArrowUpRight size={14} />
          </NavLink>
          {user && <NavLink to="/dashboard">My bookings</NavLink>}
          {user?.roles.includes('admin') && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="hello">Hi, {user.name.split(' ')[0]}</span>
              <button
                className="text-button"
                onClick={async () => {
                  await post('/auth/logout');
                  await refresh();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link className="button small" to="/auth">
              Sign in <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Explore />} />
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
      <footer>
        <Link className="brand" to="/">
          expertmarket.
        </Link>
        <p>A little perspective. A meaningful next step.</p>
        <Link to="/guidelines">Beta booking guidelines</Link>
        <span>Independent marketplace · Controlled beta</span>
      </footer>
    </Auth.Provider>
  );
}

function Explore() {
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [mode, setMode] = useState(''),
    [language, setLanguage] = useState(''),
    [price, setPrice] = useState(''),
    [page, setPage] = useState(1),
    [catPage, setCatPage] = useState(1);
  const categories = useData(`/categories?limit=12&page=${catPage}`);
  const params = new URLSearchParams({
    page: String(page),
    ...(query ? { q: query } : {}),
    ...(category ? { category } : {}),
    ...(mode ? { mode } : {}),
    ...(language ? { language } : {}),
    ...(price ? { maxPrice: String(Number(price) * 100) } : {}),
  });
  const experts = useData(`/experts?${params}`);
  function filter(set: (v: string) => void, value: string) {
    set(value);
    setPage(1);
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> GOOD PEOPLE. REAL PERSPECTIVE.
          </div>
          <h1>
            Your next chapter.
            <br />
            <em>The right expert.</em>
          </h1>
          <p>
            Big questions are easier with the right person.
            <br className="desktop" /> Find thoughtful guidance for your career, business, and
            beyond.
          </p>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              setPage(1);
            }}
          >
            <Search size={22} />
            <input
              aria-label="Search experts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="What would you like help with?"
            />
            <button type="submit">
              Find an expert <ArrowRight size={18} />
            </button>
          </form>
          <div className="hero-assurances">
            <span>
              <ShieldCheck size={17} /> Verified professionals
            </span>
            <span>
              <CalendarDays size={17} /> Time that works for you
            </span>
            <span>
              <CheckCircle2 size={17} /> Transparent pricing
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-note note-top">
            <span className="tiny-icon">
              <Sparkles size={18} />
            </span>
            A fresh perspective
          </div>
          <div className="art-card">
            <div className="art-top">
              <span className="art-compass">
                <Compass size={68} strokeWidth={1} />
              </span>
              <span className="art-star">✳</span>
            </div>
            <p>
              One conversation.
              <br />A clearer direction.
            </p>
            <div className="art-line" />
            <div className="art-bottom">
              <span>MAKE YOUR NEXT MOVE</span>
              <ArrowUpRight size={26} />
            </div>
          </div>
          <div className="art-note note-bottom">
            <span className="tiny-icon">
              <Check size={18} />
            </span>
            Your next step starts here
          </div>
        </div>
      </section>
      <div className="section-rule">
        <span>EXPLORE POSSIBILITIES</span>
        <ArrowDown size={17} />
      </div>
      <section className="explore-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">PEOPLE WHO CAN HELP</div>
            <h2>
              Find your kind of expert<span>.</span>
            </h2>
          </div>
          <p>Choose a conversation that moves you forward.</p>
        </div>
        <div className="category-row">
          <button
            className={`chip ${!category ? 'selected' : ''}`}
            onClick={() => filter(setCategory, '')}
          >
            All expertise
          </button>
          {categories.data?.items.map((cat: any) => (
            <button
              key={cat._id}
              className={`chip ${category === cat._id ? 'selected' : ''}`}
              onClick={() => filter(setCategory, cat._id)}
            >
              {cat.name}
            </button>
          ))}
          {categories.data?.total > 12 && (
            <button
              className="chip"
              onClick={() => setCatPage((p) => (p * 12 >= categories.data.total ? 1 : p + 1))}
            >
              More categories <ChevronRight size={14} />
            </button>
          )}
        </div>
        <div className="filter-row">
          <div className="filter-controls">
            <select
              aria-label="Session format"
              value={mode}
              onChange={(e) => filter(setMode, e.target.value)}
            >
              <option value="">Any format</option>
              <option value="online">Online sessions</option>
              <option value="in_person">In person</option>
            </select>
            <select
              aria-label="Language"
              value={language}
              onChange={(e) => filter(setLanguage, e.target.value)}
            >
              <option value="">Any language</option>
              <option>English</option>
              <option>Telugu</option>
              <option>Hindi</option>
            </select>
            <select
              aria-label="Maximum price"
              value={price}
              onChange={(e) => filter(setPrice, e.target.value)}
            >
              <option value="">Any price</option>
              <option value="1000">Under ₹1,000</option>
              <option value="2500">Under ₹2,500</option>
              <option value="5000">Under ₹5,000</option>
            </select>
          </div>
          <span>
            {experts.data ? `${experts.data.total} experts to explore` : 'Find a good fit'}
          </span>
        </div>
        {experts.loading ? (
          <Loader />
        ) : experts.error ? (
          <Alert>
            {experts.error}{' '}
            <button className="text-button" onClick={experts.reload}>
              Try again
            </button>
          </Alert>
        ) : experts.data?.items.length ? (
          <div className="expert-grid">
            {experts.data.items.map((expert: any, i: number) => (
              <ExpertCard key={expert.id} expert={expert} index={i} />
            ))}
          </div>
        ) : (
          <Empty title="A good match is worth finding">
            Try another category or clear your filters. New verified experts will appear here as the
            beta opens.
          </Empty>
        )}
        <Pager page={page} setPage={setPage} total={experts.data?.total ?? 0} />
      </section>
      <section className="how">
        <div>
          <span className="eyebrow">LESS FRICTION. MORE CLARITY.</span>
          <h2>
            From a question
            <br />
            to a conversation.
          </h2>
          <Link className="inline-link" to="/guidelines">
            How booking works <ArrowUpRight size={18} />
          </Link>
        </div>
        {[
          ['01', 'Find your person', 'Explore expertise, services and real customer reviews.'],
          ['02', 'Make a little time', 'Choose a session and a time that fits your schedule.'],
          ['03', 'Take your next step', 'Meet your expert and leave with a clearer direction.'],
        ].map(([number, title, text]) => (
          <article key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <section className="expert-cta">
        <div>
          <span className="eyebrow">YOUR EXPERIENCE HAS VALUE</span>
          <h2>Someone needs what you know.</h2>
          <p>Share your expertise, on your terms.</p>
        </div>
        <Link className="button cream" to="/studio">
          Become an expert <ArrowUpRight size={20} />
        </Link>
      </section>
    </>
  );
}
function ExpertCard({ expert: e, index }: { expert: any; index: number }) {
  const lowest = Math.min(...e.services.map((s: any) => s.pricePaise));
  return (
    <article className="expert-card">
      <div className={`card-cover color-${index % 4}`}>
        <span className="cover-grid" />
        <div className="avatar">
          {e.name
            .split(' ')
            .map((x: string) => x[0])
            .slice(0, 2)
            .join('')}
        </div>
        <span className="verified">
          <ShieldCheck size={13} /> Verified
        </span>
        <span className="cover-symbol">{['✳', '↗', '◈', '✦'][index % 4]}</span>
      </div>
      <div className="card-body">
        <div className="name-line">
          <h3>
            <Link to={`/experts/${e.slug}`}>{e.name}</Link>
          </h3>
          {e.reviewCount > 0 ? (
            <span className="rating">
              <Star size={13} />
              {e.rating.toFixed(1)} <small>({e.reviewCount})</small>
            </span>
          ) : (
            <span className="new-expert">New expert</span>
          )}
        </div>
        <p className="headline">{e.headline}</p>
        <div className="expert-meta">
          <span>
            <MapPin size={13} />
            {e.city ?? 'Online'}
          </span>
          <span>{e.experienceYears ?? 0}+ years experience</span>
        </div>
        <div className="tags">
          {e.languages?.slice(0, 2).map((l: string) => (
            <span key={l}>{l}</span>
          ))}
          <span>
            {e.services.some((s: any) => s.mode === 'online') ? 'Online sessions' : 'In person'}
          </span>
        </div>
        <div className="card-bottom">
          <div>
            <small>Sessions from</small>
            <strong>{formatMoney(lowest)}</strong>
          </div>
          <Link to={`/experts/${e.slug}`} className="round-link" aria-label={`View ${e.name}`}>
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </div>
    </article>
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
      <div className="page">
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
    <div className="page">
      <Link className="inline-link" to="/">
        <ChevronLeft size={16} /> Back to experts
      </Link>
      <div className="profile-layout">
        <section>
          <div className="profile-intro">
            <div className="avatar large">
              {e.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')}
            </div>
            <div>
              <span className="verified inline">
                <ShieldCheck size={14} /> Verified expert
              </span>
              <h1>{e.name}</h1>
              <h3>{e.headline}</h3>
              <div className="expert-meta">
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
          <div className="panel">
            <h2>A little about me</h2>
            <p className="preserve">{e.bio}</p>
          </div>
          <div className="panel">
            <h2>Ways we can work together</h2>
            {e.services.map((s: any) => (
              <button
                className={`service-option ${selected?.id === s.id ? 'active' : ''}`}
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
          <div className="panel">
            <h2>Verified customer reviews</h2>
            {e.reviews.length ? (
              e.reviews.map((r: any) => (
                <article className="review" key={r._id}>
                  <span className="rating">
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
        <aside className="booking-panel panel">
          <span className="eyebrow">MAKE SOME TIME</span>
          <h2>{selected.title}</h2>
          <p>
            <Clock size={16} /> {selected.durationMinutes} minutes{' '}
            <span className="price">{formatMoney(selected.pricePaise)}</span>
          </p>
          <hr />
          <h3>Choose your time</h3>
          <p className="muted">Shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
          {slots.loading ? (
            <Loader />
          ) : slots.error ? (
            <Alert>{slots.error}</Alert>
          ) : slots.data?.items.length ? (
            <div className="slot-list">
              {slots.data.items.map((s: any) => (
                <button
                  key={s._id}
                  className={`chip ${slotId === s._id ? 'selected' : ''}`}
                  onClick={() => setSlotId(s._id)}
                >
                  {date(s.startsAt)}
                </button>
              ))}
            </div>
          ) : (
            <p>No upcoming slots. Check back soon.</p>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I accept the <Link to="/guidelines">beta booking and cancellation guidelines</Link>.
            </span>
          </label>
          {error && <Alert>{error}</Alert>}
          <button className="button full" disabled={!slotId || !accepted || busy} onClick={book}>
            {busy ? 'Reserving…' : 'Reserve this session'}
            <ArrowRight size={16} />
          </button>
          <p className="fine">
            Your time is held for 10 minutes while you complete payment. Confirmation follows the
            expert’s current policy.
          </p>
        </aside>
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
    <div className="auth-layout">
      <section className="auth-story">
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
        <span className="eyebrow">WELCOME TO EXPERT MARKET</span>
      </section>
      <section className="auth-form panel">
        <div className="eyebrow">{user ? 'ACCOUNT CONNECTIONS' : 'YOUR NEXT STEP'}</div>
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
        <p className="muted">
          {config.data?.betaAccess === 'invite'
            ? 'Our controlled beta is invitation-only.'
            : 'Sign in to manage your appointments.'}
        </p>
        <div className="tabs">
          {[
            ['login', 'Email'],
            ['register', 'Create account'],
            ['phone', 'Phone OTP'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={mode === value ? 'active' : ''}
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
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'login' ? 1 : 12}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </Field>
          )}
          <button className="button full" disabled={busy}>
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
          <div className="auth-links">
            <button
              className="text-button"
              onClick={() => {
                setMode('reset');
                setSent(false);
              }}
            >
              Forgot password?
            </button>
            <button className="text-button" onClick={() => setMode('verify')}>
              Verify email
            </button>
          </div>
        )}
        {mode === 'verify' && (
          <button
            className="text-button"
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
        <div className="google-signin" ref={googleRef} />
        {!config.data?.googleClientId && (
          <p className="fine">
            Google sign-in will be available when the beta integration is connected.
          </p>
        )}
        {mode === 'phone' && (
          <p className="fine">
            Invited beta members: sign in by email first, then use this page to link your phone.
          </p>
        )}
      </section>
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
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>Good to see you, {user?.name.split(' ')[0]}.</h1>
          <p>Keep your conversations and next steps in one place.</p>
        </div>
        <Link className="button" to="/">
          Find an expert <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="tabs">
        <button
          className={scope === 'customer' ? 'active' : ''}
          onClick={() => {
            setScope('customer');
            setPage(1);
          }}
        >
          My bookings
        </button>
        {user?.roles.includes('expert') && (
          <button
            className={scope === 'expert' ? 'active' : ''}
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
        <div className="booking-list">
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
    <article className="panel booking-card">
      <div className="booking-icon">
        <CalendarDays size={25} />
      </div>
      <div className="booking-main">
        <div className="status-row">
          <span className={`status ${b.status}`}>{b.status.replaceAll('_', ' ')}</span>
          <span className="muted">{b.paymentStatus.replaceAll('_', ' ')}</span>
        </div>
        <h3>{b.title}</h3>
        <p>
          {date(b.startsAt)} · {b.mode === 'online' ? 'Online' : b.location}
        </p>
        <small className="muted">Booking {b._id}</small>
        {b.status === 'confirmed' &&
          b.mode === 'online' &&
          (b.meetingUrl ? (
            <a className="inline-link" href={b.meetingUrl} target="_blank" rel="noreferrer">
              <Video size={15} /> Join Google Meet
            </a>
          ) : (
            <p className="fine">
              Meeting link: {b.meetingStatus}. Contact the marketplace team if it remains
              unavailable.
            </p>
          ))}
        {b.paymentStatus === 'refund_required' && (
          <p className="fine">
            A refund needs operator processing. Your dashboard will update after reconciliation.
          </p>
        )}
        {notice && <Alert kind="success">{notice}</Alert>}
        {review && (
          <form
            className="review-form"
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
              <select value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your experience">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                minLength={10}
                maxLength={2000}
                required
              />
            </Field>
            <button className="button small" disabled={busy}>
              Publish verified review
            </button>
          </form>
        )}
      </div>
      <div className="booking-actions">
        <strong>{formatMoney(b.grossPaise)}</strong>
        {b.status === 'held' && scope === 'customer' && (
          <button
            className="button small"
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
            <button className="button small" onClick={() => action(b._id, 'accept')}>
              Accept
            </button>
            <button className="secondary small" onClick={() => action(b._id, 'reject')}>
              Decline & refund
            </button>
          </>
        )}
        {scope === 'expert' && b.status === 'confirmed' && new Date(b.endsAt) < new Date() && (
          <button className="button small" onClick={() => action(b._id, 'complete')}>
            Mark completed
          </button>
        )}
        {['held', 'pending_confirmation', 'confirmed'].includes(b.status) &&
          new Date(b.startsAt) > new Date() && (
            <button
              className="text-button"
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
            <button className="secondary small" onClick={() => setReview(!review)}>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
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
          className="text-button"
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
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EXPERT STUDIO</span>
          <h1>Make your experience count.</h1>
          <p>Your profile, your services, your schedule.</p>
        </div>
        {d && <span className={`status ${d.verification}`}>{d.verification}</span>}
      </div>
      <div className="tabs">
        {['profile', 'services', 'availability', 'earnings'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'active' : ''}
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
          <form className="panel form-panel" key={d?.updatedAt ?? 'new'} onSubmit={save}>
            <h2>{d ? 'Your public profile' : 'Introduce yourself'}</h2>
            <p className="muted">
              Your profile goes live after admin verification. Updates to professional claims
              require a new review.
            </p>
            {d?.reviewReason && <Alert kind="info">Review note: {d.reviewReason}</Alert>}
            <div className="form-grid">
              <Field label="Public profile slug">
                <input
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
                  name="headline"
                  defaultValue={d?.headline}
                  minLength={10}
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Experience in years">
                <input
                  name="experienceYears"
                  type="number"
                  defaultValue={d?.experienceYears ?? 0}
                  min={0}
                  max={70}
                  required
                />
              </Field>
              <Field label="City">
                <input name="city" defaultValue={d?.city} required minLength={2} />
              </Field>
              <Field label="Languages · comma separated">
                <input
                  name="languages"
                  defaultValue={d?.languages?.join(', ') ?? 'English'}
                  required
                />
              </Field>
              <Field label="Timezone">
                <input name="timezone" defaultValue={d?.timezone ?? 'Asia/Kolkata'} required />
              </Field>
              <Field label="Booking confirmation preference">
                <select name="confirmationPolicy" defaultValue={d?.confirmationPolicy ?? 'manual'}>
                  <option value="manual">I approve each paid request</option>
                  <option value="auto">Confirm automatically after payment</option>
                </select>
              </Field>
            </div>
            <Field label="About your experience">
              <textarea
                name="bio"
                defaultValue={d?.bio}
                rows={6}
                minLength={30}
                maxLength={3000}
                required
              />
            </Field>
            <button className="button" disabled={busy}>
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
    <div className="split-layout">
      <section className="panel">
        <h2>Your services</h2>
        {services.error && <Alert>{services.error}</Alert>}
        {services.loading ? (
          <Loader />
        ) : services.data?.items.length ? (
          services.data.items.map((s: any) => (
            <button
              className="service-option"
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
          className="text-button"
          onClick={() => {
            setEditing(null);
            setCategory('');
          }}
        >
          + Add a new service
        </button>
      </section>
      <form key={editing?._id ?? 'new'} className="panel" onSubmit={submit}>
        <h2>{editing ? 'Edit service' : 'Create a service'}</h2>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <Field label="Service title">
          <input
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
            name="description"
            defaultValue={editing?.description}
            minLength={20}
            maxLength={2000}
            rows={4}
            required
          />
        </Field>
        <div className="form-grid">
          <Field label="Duration (minutes)">
            <input
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
            <select name="mode" defaultValue={editing?.mode ?? 'online'}>
              <option value="online">Online · Google Meet</option>
              <option value="in_person">In person</option>
            </select>
          </Field>
          <Field label="Confirmation">
            <select name="confirmationPolicy" defaultValue={editing?.confirmationPolicy ?? ''}>
              <option value="">Use profile preference</option>
              <option value="auto">Automatic</option>
              <option value="manual">Manual approval</option>
            </select>
          </Field>
        </div>
        <Field label="Location · required for in-person sessions">
          <input name="location" defaultValue={editing?.location ?? ''} maxLength={300} />
        </Field>
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Publish
          this service
        </label>
        <button className="button" disabled={busy}>
          Save service <Check size={16} />
        </button>
      </form>
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
    <div className="split-layout">
      <form
        className="panel"
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
        <p className="muted">
          Choose a date in your device’s timezone:{' '}
          {Intl.DateTimeFormat().resolvedOptions().timeZone}. Start times must be on a 15-minute
          boundary and at least an hour away.
        </p>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <Field label="Service">
          <select name="serviceId" required>
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
          <input type="datetime-local" name="startsAt" step={900} required />
        </Field>
        <button className="button" disabled={busy}>
          Add availability <CalendarDays size={16} />
        </button>
      </form>
      <section className="panel">
        <h2>Upcoming availability</h2>
        {slots.loading ? (
          <Loader />
        ) : slots.error ? (
          <Alert>{slots.error}</Alert>
        ) : slots.data?.items.length ? (
          slots.data.items.map((s: any) => (
            <div className="list-row" key={s._id}>
              <div>
                <strong>{date(s.startsAt)}</strong>
                <p>{s.status}</p>
              </div>
              {s.status === 'open' && (
                <button
                  aria-label={`Close slot ${date(s.startsAt)}`}
                  className="icon-button"
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
  );
}
function Earnings() {
  const data = useData('/expert/earnings');
  return (
    <>
      <div className="panel">
        <h2>Your earnings</h2>
        <p className="muted">
          Captured payments are shown by booking status. Earnings become eligible for payout only
          after completion, reconciliation and the payout delay.
        </p>
        {data.loading ? (
          <Loader />
        ) : data.error ? (
          <Alert>{data.error}</Alert>
        ) : (
          <div className="metrics">
            {data.data?.totals.map((t: any) => (
              <article key={t._id}>
                <span>{t._id}</span>
                <strong>{formatMoney(t.netPaise)}</strong>
                <small>
                  {t.count} sessions · {formatMoney(t.grossPaise)} gross
                </small>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <h2>Payout history</h2>
        {data.data?.payouts.length ? (
          data.data.payouts.map((p: any) => (
            <div className="list-row" key={p._id}>
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
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">MARKETPLACE OPERATIONS</span>
          <h1>Keep good connections running.</h1>
          <p>Verification, policies and every detail that builds trust.</p>
        </div>
        <span className="status held">Controlled beta</span>
      </div>
      <div className="tabs">
        {['overview', 'experts', 'categories', 'policies', 'payments', 'invitations'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
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
            <div className="metrics">
              {[
                ['Experts awaiting review', o.data.pendingExperts],
                ['Total bookings', o.data.bookings],
                ['Refunds to process', o.data.refundsRequired],
                ['Failed notification jobs', o.data.failedJobs],
              ].map(([label, value]) => (
                <article key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <div className="panel">
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
              <div className="integration-status">
                {Object.entries(o.data.providerStatus).map(([key, value]) => (
                  <span key={key}>
                    <span className={`dot ${value ? 'connected' : ''}`} />
                    {key}: {value ? 'configured' : 'not connected'}
                  </span>
                ))}
              </div>
              <p className="fine">Configured does not mean externally tested or approved.</p>
            </div>
            <div className="panel">
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
    <div className="panel">
      <h2>Expert verification</h2>
      {error && <Alert>{error}</Alert>}
      {experts.error && <Alert>{experts.error}</Alert>}
      {experts.loading ? (
        <Loader />
      ) : (
        experts.data?.items.map((e: any) => (
          <article className="verification-card" key={e._id}>
            <div>
              <span className={`status ${e.verification}`}>{e.verification}</span>
              <h3>{e.userId.name}</h3>
              <p>{e.headline}</p>
              <p>{e.bio}</p>
              <small>
                {e.userId.email} · {e.city} · {e.experienceYears} years
              </small>
            </div>
            <div className="button-row">
              <button className="button small" onClick={() => verify(e, 'approved')}>
                Approve
              </button>
              <button className="secondary small" onClick={() => verify(e, 'rejected')}>
                Reject
              </button>
              <button className="text-button" onClick={() => verify(e, 'suspended')}>
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
    <div className="split-layout">
      <section className="panel">
        <h2>Professional categories</h2>
        <p className="muted">
          Create as many categories as the marketplace needs. Archiving hides their services from
          discovery.
        </p>
        {categories.error && <Alert>{categories.error}</Alert>}
        {categories.data?.items.map((c: any) => (
          <button className="list-row row-button" key={c._id} onClick={() => setEditing(c)}>
            <span>{c.name}</span>
            <span className="muted">
              {c.active ? 'Active' : 'Archived'} <ChevronRight size={15} />
            </span>
          </button>
        ))}
        <Pager page={page} setPage={setPage} total={categories.data?.total ?? 0} />
      </section>
      <form
        key={editing?._id ?? 'new'}
        className="panel"
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
          <input name="name" defaultValue={editing?.name} minLength={2} required />
        </Field>
        <Field label="Unique slug">
          <input
            name="slug"
            defaultValue={editing?.slug}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            required
          />
        </Field>
        <label className="checkbox">
          <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active
          category
        </label>
        <div className="button-row">
          <button className="button" disabled={busy}>
            Save category
          </button>
          <button className="text-button" type="button" onClick={() => setEditing(null)}>
            New category
          </button>
        </div>
      </form>
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
      className="panel form-panel"
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
      <div className="form-grid">
        <Field label="Platform commission (%)">
          <input
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
          <select name="policy" defaultValue={s.confirmationPolicy}>
            <option value="expert_choice">Let experts choose</option>
            <option value="force_auto">Always automatic after capture</option>
            <option value="force_manual">Always require manual approval</option>
          </select>
        </Field>
        <Field label="Expert payout mode">
          <select name="payoutMode" defaultValue={s.payoutMode}>
            <option value="manual">Manual · record external payment</option>
            <option value="automatic">Automatic · conditional Razorpay Route</option>
          </select>
        </Field>
        <Field label="Payout delay after session (hours)">
          <input
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
      <button className="button" disabled={busy}>
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
    <div className="panel">
      <h2>Bookings, reconciliation & payouts</h2>
      <p className="muted">
        Refunds are processed by an operator in Razorpay during this implementation stage, then
        reconciled here. Never mark a provider transfer as settled without evidence.
      </p>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      {bookings.error && <Alert>{bookings.error}</Alert>}
      <div className="table-scroll">
        <table>
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
                  <div className="button-row">
                    <button
                      className="secondary small"
                      disabled={!b.orderId}
                      onClick={() => run(b, 'reconcile')}
                    >
                      Reconcile
                    </button>
                    <button
                      className="secondary small"
                      disabled={
                        b.status !== 'completed' || b.paymentStatus !== 'captured' || b.dispute
                      }
                      onClick={() => run(b, 'payout')}
                    >
                      Payout
                    </button>
                    {b.status === 'pending_confirmation' && (
                      <button
                        className="text-button"
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
      className="panel form-panel"
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
        <input type="email" name="email" required />
      </Field>
      <label className="checkbox">
        <input type="checkbox" name="active" defaultChecked /> Allow beta access
      </label>
      <button className="button">Save access</button>
    </form>
  );
}
function Guidelines() {
  return (
    <div className="page narrow">
      <span className="eyebrow">CONTROLLED BETA</span>
      <h1>Before your conversation.</h1>
      <div className="panel">
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
