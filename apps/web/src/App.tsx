import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Download,
  SlidersHorizontal,
  Menu,
  House,
  Settings,
  Bell,
  RefreshCw,
  TriangleAlert,
  FolderOpen,
  Phone,
  LayoutGrid,
  CreditCard,
  Mail,
  LockKeyhole,
  EyeOff,
  FileText,
  Landmark,
  Trash2,
  Plus,
  MoreHorizontal,
  Pencil,
  Archive,
  RotateCcw,
  ClipboardList,
  IndianRupee,
  UserRound,
  Layers,
  BadgeCheck,
  Link2,
  Hexagon,
  Lightbulb,
  CircleCheck,
  Eye,
  Languages,
  CircleHelp,
  ChevronDown,
  Laptop,
  BriefcaseBusiness,
  ChartNoAxesColumnIncreasing,
  Palette,
  GraduationCap,
  WalletCards,
  UsersRound,
  Shield,
  MessageSquareQuote,
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
  Search,
  ShieldCheck,
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
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
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
      <div className="d-flex flex-column min-vh-100 bg-white industry-app">
        <a
          className="visually-hidden-focusable position-absolute top-0 start-0 btn btn-primary m-2 z-3"
          href="#main"
        >
          Skip to content
        </a>
        <header className="navbar navbar-expand-lg bg-white border-bottom px-3 px-lg-5 py-3 gap-3 industry-navbar">
          <Link to="/" className="navbar-brand d-inline-flex align-items-center fw-bold m-0">
            <span className="industry-mark d-inline-flex align-items-center justify-content-center me-2">
              <Compass size={24} />
            </span>
            industryconnect
            <span>.</span>
          </Link>
          <button
            className="navbar-toggler ms-auto"
            type="button"
            aria-controls="main-navigation"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(!navOpen)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div
            id="main-navigation"
            className={`collapse navbar-collapse gap-3 ${navOpen ? 'show' : ''}`}
          >
            <nav
              onClick={() => setNavOpen(false)}
              className="navbar-nav flex-column flex-lg-row flex-wrap gap-2 align-items-lg-center py-2 py-lg-0"
              aria-label="Main navigation"
            >
              <NavLink className="nav-link" to="/" aria-label="Explore experts">
                Find Experts
              </NavLink>
              <a className="nav-link" href="/#categories">
                Categories
              </a>
              <a className="nav-link" href="/#how-it-works">
                How it works
              </a>
              <a className="nav-link" href="/#expert-community">
                For Businesses
              </a>

              {user && (
                <NavLink className="nav-link" to="/dashboard">
                  My bookings
                </NavLink>
              )}
              {user?.roles.includes('admin') && (
                <NavLink className="nav-link" to="/admin">
                  Admin
                </NavLink>
              )}
            </nav>
            <div className="d-flex align-items-center gap-3 ms-lg-auto">
              <Link
                className="btn btn-outline-secondary btn-sm"
                to={location.pathname === '/admin' ? '/' : '/studio'}
              >
                {location.pathname === '/admin' ? (
                  <>
                    Go to Website <ArrowUpRight size={13} />
                  </>
                ) : (
                  'Become an Expert'
                )}
              </Link>
              {user ? (
                <details className="account-menu">
                  <summary aria-label={`Account menu for ${user.name}`}>
                    <span className="account-avatar">
                      {user.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <ChevronDown size={13} aria-hidden="true" />
                  </summary>
                  <div
                    className="account-menu-panel"
                    onClick={(event) =>
                      event.currentTarget.closest('details')?.removeAttribute('open')
                    }
                  >
                    <strong>{user.name}</strong>
                    <Link to="/studio">Expert Studio</Link>
                    <Link to="/dashboard">My Bookings</Link>
                    <button
                      className="btn btn-link p-0 text-start"
                      onClick={async () => {
                        await post('/auth/logout');
                        await refresh();
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </details>
              ) : (
                <Link className="btn btn-primary btn-sm" to="/auth">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="flex-grow-1">
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
        <footer className="industry-footer mt-0">
          <div className="container py-4">
            <div className="row g-4">
              <div className="col-md-4">
                <Link className="footer-brand" to="/">
                  <Compass size={20} /> industryconnect.
                </Link>
                <p>
                  Connecting learners and industry experts for
                  <br />
                  better decisions and brighter futures.
                </p>
                <span className="small">Independent marketplace ? Invitation-only beta</span>
              </div>
              <div className="col-6 col-md-2">
                <h2>Explore</h2>
                <a href="/#experts">Find Experts</a>
                <a href="/#categories">Categories</a>
                <a href="/#how-it-works">How it works</a>
                <Link to="/studio">For Professionals</Link>
              </div>
              <div className="col-6 col-md-2">
                <h2>Support</h2>
                <Link to="/guidelines">Booking Guidelines</Link>
                <Link to="/guidelines">Cancellations & Refunds</Link>
                <Link to="/dashboard">My Bookings</Link>
                <Link to="/auth">Account Help</Link>
              </div>
              <div className="col-md-4">
                <h2>Your next step</h2>
                <p>Sign in to find your next conversation.</p>
                <form
                  className="footer-email d-flex"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const email = new FormData(e.currentTarget).get('email');
                    navigate('/auth?email=' + encodeURIComponent(String(email)));
                  }}
                >
                  <label className="visually-hidden" htmlFor="footer-email">
                    Your email address
                  </label>
                  <input
                    id="footer-email"
                    name="email"
                    type="email"
                    className="form-control form-control-sm"
                    placeholder="Enter your email"
                    required
                  />
                  <button
                    className="btn btn-light btn-sm"
                    type="submit"
                    aria-label="Continue with email"
                  >
                    <ArrowRight size={16} />
                  </button>
                </form>
                <small>Continue to sign in. No mailing list subscription.</small>
              </div>
            </div>
            <div className="footer-bottom d-flex flex-wrap justify-content-between gap-2 mt-4 pt-3">
              <span>? 2026 IndustryConnect. All rights reserved.</span>
              <span>Private beta ? Live transactions disabled</span>
            </div>
          </div>
        </footer>
      </div>
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
  function showExperts() {
    document.getElementById('experts')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
  const categoryLooks = [
    { Icon: Laptop, tone: 'blue', description: 'Software, data & emerging technology' },
    { Icon: BriefcaseBusiness, tone: 'peach', description: 'Jobs, interviews & your next chapter' },
    {
      Icon: ChartNoAxesColumnIncreasing,
      tone: 'green',
      description: 'Strategy, growth & building a business',
    },
    { Icon: Palette, tone: 'pink', description: 'Creative thinking, portfolios & design' },
    { Icon: GraduationCap, tone: 'purple', description: 'Skills, learning & a clearer path' },
    { Icon: WalletCards, tone: 'yellow', description: 'Explore professional expertise' },
  ];
  return (
    <div className="market-home">
      <section className="container market-hero">
        <div className="row align-items-center g-5">
          <div className="col-lg-7">
            <p className="section-kicker">Learn. Discuss. Get expert advice.</p>
            <h1>
              Real Conversations
              <br />
              with Real Experts.
            </h1>
            <p className="hero-description">
              Book 1:1 sessions with verified industry professionals for
              <br className="d-none d-xl-block" /> career guidance, skills, business, and more.
            </p>
            <form
              className="hero-search d-flex align-items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search);
                setPage(1);
                showExperts();
              }}
            >
              <Search size={19} className="text-body-secondary flex-shrink-0" aria-hidden="true" />
              <input
                className="form-control border-0 shadow-none"
                aria-label="Search experts"
                placeholder="What do you want help with?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="btn btn-primary flex-shrink-0"
                aria-label="Find an expert"
                type="submit"
              >
                Find Experts <ArrowRight size={15} />
              </button>
            </form>
            <div className="d-flex flex-wrap gap-2 mt-3">
              {categories.data?.items.slice(0, 5).map((c: any) => (
                <button
                  key={c._id}
                  className={`btn topic-chip ${category === c._id ? 'active' : ''}`}
                  aria-pressed={category === c._id}
                  onClick={() => {
                    filter(setCategory, c._id);
                    showExperts();
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="row g-3 hero-trust">
              {[
                [ShieldCheck, 'Verified Experts', 'Quality professionals only', 'green'],
                [CalendarDays, 'Easy Scheduling', 'Book at your convenience', 'blue'],
                [Shield, 'Private & Secure', 'Your privacy is our priority', 'pink'],
              ].map(([Icon, title, body, tone]) => {
                const TrustIcon = Icon as typeof ShieldCheck;
                return (
                  <div className="col-12 col-sm-4" key={String(title)}>
                    <div className="d-flex gap-2 align-items-center">
                      <span className={`trust-icon tone-${tone}`}>
                        <TrustIcon size={21} />
                      </span>
                      <div>
                        <strong>{String(title)}</strong>
                        <small>{String(body)}</small>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="col-lg-5">
            <div className="hero-photo-wrap">
              <span className="hero-rays" aria-hidden="true">
                ╲│╱
              </span>
              <img
                className="hero-photo"
                src="/images/mentoring-conversation.png"
                alt="Two professionals sharing ideas over a laptop in a bright workspace"
                width="1448"
                height="1086"
                fetchPriority="high"
              />
              <div className="growth-note">
                <ArrowUpRight size={25} />
                <span>
                  Grow your
                  <br />
                  career, faster
                </span>
              </div>
              <div className="conversation-note d-flex align-items-center gap-3">
                <span className="trust-icon tone-peach">
                  <UsersRound size={22} />
                </span>
                <strong>
                  One conversation.
                  <br />A wider perspective.
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="container home-section" id="categories">
        <div className="section-heading d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <p className="section-kicker">Explore top categories</p>
            <h2>What’s your next move?</h2>
            <p>Find experts across different domains and get personalized guidance.</p>
          </div>
          <button
            className="btn btn-link section-link"
            onClick={() => {
              filter(setCategory, '');
              showExperts();
            }}
          >
            View all experts <ArrowRight size={15} />
          </button>
        </div>
        {categories.loading ? (
          <Loader />
        ) : categories.error ? (
          <Alert>
            {categories.error}{' '}
            <button className="btn btn-link p-0" onClick={categories.reload}>
              Try again
            </button>
          </Alert>
        ) : categories.data?.items.length ? (
          <>
            <div
              className={`row row-cols-1 row-cols-sm-2 row-cols-lg-4 ${categories.data.items.length > 4 ? 'row-cols-xl-6' : 'row-cols-xl-4'} g-3`}
            >
              {categories.data.items.map((c: any) => {
                const name = c.name.toLowerCase();
                const look = /tech|software/.test(name)
                  ? 0
                  : /career|leadership/.test(name)
                    ? 1
                    : /business|startup/.test(name)
                      ? 2
                      : /design|creativ/.test(name)
                        ? 3
                        : /educat|learn/.test(name)
                          ? 4
                          : 5;
                const { Icon, tone, description } = categoryLooks[look];
                return (
                  <div className="col" key={c._id}>
                    <button
                      className={`category-tile tone-${tone} ${category === c._id ? 'selected' : ''}`}
                      aria-pressed={category === c._id}
                      onClick={() => {
                        filter(setCategory, c._id);
                        showExperts();
                      }}
                    >
                      <Icon size={27} />
                      <strong>{c.name}</strong>
                      <small>{description}</small>
                      <span className="tile-arrow">
                        <ArrowRight size={14} />
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <Pager page={catPage} setPage={setCatPage} total={categories.data.total} limit={12} />
          </>
        ) : (
          <p className="text-body-secondary small">
            Categories will appear as experts join the beta.
          </p>
        )}
      </section>
      <section className="container home-section" id="how-it-works">
        <div className="section-heading">
          <p className="section-kicker">How it works</p>
          <h2>Get expert advice in 3 simple steps</h2>
        </div>
        <div className="row g-4">
          {[
            [
              Search,
              '1. Find an Expert',
              'Search by skill, category or goal to find the right expert.',
              'blue',
            ],
            [
              CalendarDays,
              '2. Book a Session',
              'Choose a time slot and complete payment when checkout is available.',
              'peach',
            ],
            [
              Video,
              '3. Join & Get Advice',
              'Join your confirmed session and make the most of expert advice.',
              'green',
            ],
          ].map(([Icon, title, body, tone], i) => {
            const StepIcon = Icon as typeof Search;
            return (
              <article className="col-md-4" key={String(title)}>
                <div className="d-flex gap-3 align-items-start position-relative">
                  <span className={`step-icon tone-${tone}`}>
                    <StepIcon size={24} />
                  </span>
                  <div>
                    <h3>{String(title)}</h3>
                    <p className="step-copy">{String(body)}</p>
                  </div>
                  {i < 2 && (
                    <ArrowRight
                      className="step-arrow d-none d-xl-block"
                      size={21}
                      aria-hidden="true"
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="container home-section" id="experts">
        <div className="section-heading d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <p className="section-kicker">Featured experts</p>
            <h2>Learn from industry professionals</h2>
          </div>
          <span className="small text-body-secondary">
            {experts.data
              ? `${experts.data.total} experts to explore`
              : 'Find your next conversation'}
          </span>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3 discovery-filters">
          <button
            className={`btn topic-chip ${!category ? 'active' : ''}`}
            onClick={() => filter(setCategory, '')}
          >
            All expertise
          </button>
          <select
            className="form-select form-select-sm w-auto"
            aria-label="Session format"
            value={mode}
            onChange={(e) => filter(setMode, e.target.value)}
          >
            <option value="">Any format</option>
            <option value="online">Online sessions</option>
            <option value="in_person">In person</option>
          </select>
          <select
            className="form-select form-select-sm w-auto"
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
            className="form-select form-select-sm w-auto"
            aria-label="Maximum price"
            value={price}
            onChange={(e) => filter(setPrice, e.target.value)}
          >
            <option value="">Any price</option>
            <option value="1000">Under ₹1,000</option>
            <option value="2500">Under ₹2,500</option>
            <option value="5000">Under ₹5,000</option>
          </select>
          {(query || category || mode || language || price) && (
            <button
              className="btn btn-link btn-sm"
              onClick={() => {
                setQuery('');
                setSearch('');
                setCategory('');
                setMode('');
                setLanguage('');
                setPrice('');
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {experts.loading ? (
          <Loader />
        ) : experts.error ? (
          <Alert>
            {experts.error}{' '}
            <button className="btn btn-link p-0" onClick={experts.reload}>
              Try again
            </button>
          </Alert>
        ) : experts.data?.items.length ? (
          <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-3">
            {experts.data.items.map((e: any, i: number) => (
              <ExpertCard key={e.id} expert={e} index={i} />
            ))}
          </div>
        ) : (
          <Empty title="A good match is worth finding">
            Try another category or clear your filters. Verified experts will appear here as the
            beta opens.
          </Empty>
        )}
        <Pager page={page} setPage={setPage} total={experts.data?.total ?? 0} />
      </section>
      <CustomerStories experts={experts.data?.items ?? []} />
      <section className="container pb-2" id="expert-community">
        <div className="expert-banner d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <p className="section-kicker">Are you an industry expert?</p>
            <h2>Share your knowledge. Make an impact.</h2>
            <p>Join our community of professionals, set your own schedule, and help people grow.</p>
          </div>
          <Link className="btn btn-primary flex-shrink-0" to="/studio">
            Become an Expert <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
function ExpertCard({ expert: e, index }: { expert: any; index: number }) {
  const lowest = Math.min(...e.services.map((s: any) => s.pricePaise));
  return (
    <div className="col">
      <article className="card expert-listing h-100">
        <div className="card-body d-flex flex-column">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div
              className={`avatar expert-avatar tone-${['blue', 'peach', 'green', 'purple'][index % 4]}`}
            >
              {e.name
                .split(' ')
                .map((x: string) => x[0])
                .slice(0, 2)
                .join('')}
            </div>
            {e.reviewCount > 0 ? (
              <span className="expert-rating">
                <Star size={13} fill="currentColor" />
                {e.rating.toFixed(1)}
              </span>
            ) : (
              <span className="new-expert-label">New expert</span>
            )}
          </div>
          <h3>
            <Link to={`/experts/${e.slug}`}>{e.name}</Link>{' '}
            <ShieldCheck size={14} className="verified-icon" aria-label="Verified expert" />
          </h3>
          <p className="expert-headline">{e.headline}</p>
          <p className="expert-experience">
            {e.experienceYears ?? 0}+ years experience · {e.city ?? 'Online'}
          </p>
          <div className="d-flex flex-wrap gap-1 mb-3">
            {e.languages?.slice(0, 2).map((l: string) => (
              <span className="skill-tag" key={l}>
                {l}
              </span>
            ))}
            <span className="skill-tag">
              {e.services.some((s: any) => s.mode === 'online') ? 'Online sessions' : 'In person'}
            </span>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-auto pt-3 border-top">
            <div className="session-price">
              <strong>{formatMoney(lowest)}</strong>
              <span> / session</span>
            </div>
            <Link
              className="btn btn-primary btn-sm"
              to={`/experts/${e.slug}`}
              aria-label={`View ${e.name}`}
            >
              View Profile <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
type PublicStory = { _id: string; rating: number; text: string; expertName: string };
function CustomerStories({ experts }: { experts: any[] }) {
  const [stories, setStories] = useState<PublicStory[]>([]),
    [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(false),
    [offset, setOffset] = useState(0);
  const slugs = experts
    .filter((e) => e.reviewCount > 0)
    .slice(0, 4)
    .map((e) => e.slug)
    .join(',');
  useEffect(() => {
    let active = true;
    setStories([]);
    setFailed(false);
    setOffset(0);
    if (!slugs) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(slugs.split(',').map((slug) => api<any>(`/experts/${encodeURIComponent(slug)}`)))
      .then((profiles) => {
        if (active)
          setStories(
            profiles.flatMap((e) =>
              (e.reviews ?? []).map((r: any) => ({ ...r, expertName: e.name })),
            ),
          );
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slugs]);
  return (
    <section className="container home-section">
      <div className="stories-panel">
        <div className="section-heading d-flex justify-content-between align-items-end gap-3">
          <div>
            <p className="section-kicker">Stories that inspire</p>
            <h2>What learners say</h2>
            <p>Real experiences from people who found the right guidance.</p>
          </div>
          {stories.length > 3 && (
            <div className="d-flex gap-2">
              <button
                className="btn story-arrow"
                aria-label="Previous reviews"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 3))}
              >
                <ArrowRight size={15} className="rotate-arrow" />
              </button>
              <button
                className="btn story-arrow"
                aria-label="Next reviews"
                disabled={offset + 3 >= stories.length}
                onClick={() => setOffset(offset + 3)}
              >
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <Loader />
        ) : failed ? (
          <p className="small text-body-secondary mb-0" role="status">
            Reviews are unavailable right now. Visit an expert’s profile to try again.
          </p>
        ) : stories.length ? (
          <div className="row g-3">
            {stories.slice(offset, offset + 3).map((r) => (
              <div className="col-md-4" key={r._id}>
                <figure className="card border-0 h-100 p-3 mb-0">
                  <blockquote className="story-quote">“{r.text}”</blockquote>
                  <figcaption className="d-flex justify-content-between align-items-center gap-2 mt-auto">
                    <div>
                      <strong className="small">Verified customer</strong>
                      <small className="d-block text-body-secondary">
                        Session with {r.expertName}
                      </small>
                    </div>
                    <span className="expert-rating">
                      <Star size={13} fill="currentColor" />
                      {r.rating}/5
                    </span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        ) : (
          <div className="review-empty d-flex flex-column flex-md-row align-items-md-center gap-3">
            <span className="trust-icon tone-blue">
              <MessageSquareQuote size={25} />
            </span>
            <div>
              <h3>Your next conversation could inspire someone.</h3>
              <p>
                Customer stories will appear after completed, paid sessions. Every published review
                comes from a verified booking.
              </p>
            </div>
            <Link
              className="btn btn-outline-primary btn-sm ms-md-auto flex-shrink-0"
              to="/guidelines"
            >
              How reviews work <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ExpertDetail() {
  const { slug } = useParams();
  const info = useData(`/experts/${slug}`),
    config = useData('/config'),
    categories = useData('/categories?limit=100');
  const [serviceId, setServiceId] = useState(''),
    [slotId, setSlotId] = useState(''),
    [day, setDay] = useState(''),
    [accepted, setAccepted] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const reservationKey = useRef<{ slotId: string; key: string } | null>(null);
  const selected =
    info.data?.services.find((s: any) => s.id === serviceId) ?? info.data?.services[0];
  const slots = useData(selected ? `/services/${selected.id}/slots` : null);
  const { user } = useContext(Auth);
  const navigate = useNavigate();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dayKey = (value: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    return ['year', 'month', 'day']
      .map((key) => parts.find((p) => p.type === key)?.value)
      .join('-');
  };
  const groups = new Map<string, any[]>();
  for (const slot of slots.data?.items ?? []) {
    const key = dayKey(slot.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), slot]);
  }
  const days = [...groups.keys()].sort();
  const activeDay = day || days[0] || '';
  const chosenSlot = (slots.data?.items ?? []).find(
    (slot: any) => slot._id === slotId && dayKey(slot.startsAt) === activeDay,
  );
  useEffect(() => {
    setServiceId('');
    setSlotId('');
    setDay('');
    setAccepted(false);
    setError('');
    reservationKey.current = null;
  }, [slug]);
  if (info.loading) return <Loader />;
  if (info.error)
    return (
      <div className="container py-5">
        <Alert>{info.error}</Alert>
        <Link to="/">Back to experts</Link>
      </div>
    );
  const e = info.data;
  if (!e || !selected)
    return (
      <Empty title="No published services available">
        <Link to="/">Back to experts</Link>
      </Empty>
    );
  const categoryNames = (e.categories ?? [])
    .map((c: any) =>
      typeof c === 'object'
        ? c.name
        : categories.data?.items?.find((item: any) => (item.id || item._id) === c)?.name,
    )
    .filter(Boolean);
  async function book() {
    if (!chosenSlot || !accepted || busy) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    setBusy(true);
    setError('');
    if (reservationKey.current?.slotId !== slotId)
      reservationKey.current = { slotId, key: crypto.randomUUID() };
    try {
      await api('/bookings', {
        method: 'POST',
        headers: { 'Idempotency-Key': reservationKey.current.key },
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
    <div className="expert-detail-page">
      <div className="container expert-detail-shell">
        <Link className="expert-back" to="/#experts">
          <ChevronLeft size={17} /> Back to experts
        </Link>
        <div className="expert-detail-layout">
          <section className="expert-detail-profile">
            <header className="expert-detail-identity">
              <span className="expert-detail-avatar">
                {e.name
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part: string) => part[0])
                  .join('')}
              </span>
              <div>
                {e.verified && (
                  <span className="expert-verified">
                    <CircleCheck size={14} /> Verified expert
                  </span>
                )}
                <h1>{e.name}</h1>
                <p>{e.headline}</p>
              </div>
            </header>
            <div className="expert-detail-facts">
              {e.city && (
                <span>
                  <MapPin size={18} />
                  {e.city}
                </span>
              )}
              {e.languages?.length > 0 && (
                <span>
                  <Languages size={18} />
                  {e.languages.join(', ')}
                </span>
              )}
              {e.experienceYears != null && (
                <span>
                  <CalendarDays size={18} />
                  {e.experienceYears} years experience
                </span>
              )}
            </div>
            {!!categoryNames.length && (
              <div className="expert-detail-tags">
                {categoryNames.map((name: string) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            )}
            <section className="expert-profile-panel">
              <span className="expert-panel-icon peach">
                <UserRound size={25} />
              </span>
              <div>
                <h2>A little about me</h2>
                <p className="preserve">{e.bio}</p>
              </div>
            </section>
            <section className="expert-profile-panel expert-services-panel">
              <span className="expert-panel-icon green">
                <UsersRound size={25} />
              </span>
              <div className="flex-grow-1">
                <h2>Ways we can work together</h2>
                <div className="expert-detail-services">
                  {e.services.map((service: any) => (
                    <button
                      key={service.id}
                      className={selected.id === service.id ? 'selected' : ''}
                      aria-pressed={selected.id === service.id}
                      disabled={busy}
                      onClick={() => {
                        setServiceId(service.id);
                        setSlotId('');
                        setDay('');
                        setError('');
                      }}
                    >
                      <CircleCheck size={18} />
                      <span>
                        <strong>{service.title}</strong>
                        <span>{service.description}</span>
                        <small>
                          {service.durationMinutes} minutes /{' '}
                          {service.mode === 'online' ? 'Online' : service.location} /{' '}
                          {formatMoney(service.pricePaise)}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="expert-profile-panel">
              <span className="expert-panel-icon neutral">
                <Star size={25} fill="currentColor" />
              </span>
              <div className="flex-grow-1">
                <h2>Verified customer reviews</h2>
                {e.reviews?.length ? (
                  e.reviews.map((r: any) => (
                    <article className="expert-detail-review" key={r._id}>
                      <span>
                        <Star size={14} />
                        {r.rating}/5 / Verified booking
                      </span>
                      <p>{r.text}</p>
                    </article>
                  ))
                ) : (
                  <p>No reviews yet. Only customers with completed paid bookings can review.</p>
                )}
              </div>
            </section>
          </section>
          <aside className="expert-reservation" aria-label="Reserve a session">
            <span className="expert-reservation-kicker">MAKE SOME TIME</span>
            <h2>{selected.title}</h2>
            <p className="expert-reservation-description">{selected.description}</p>
            <div className="expert-session-price">
              <span>
                <Clock size={18} />
                {selected.durationMinutes} minutes
              </span>
              <strong>{formatMoney(selected.pricePaise)}</strong>
            </div>
            {selected.mode === 'in_person' && (
              <p className="expert-reservation-location">
                <MapPin size={15} />
                {selected.location}
              </p>
            )}
            <hr />
            <h3>Choose your time</h3>
            <p className="expert-slot-timezone">Times shown in {timezone}</p>
            {slots.loading ? (
              <Loader />
            ) : slots.error ? (
              <Alert>{slots.error}</Alert>
            ) : !days.length ? (
              <div className="expert-no-slots">
                <CalendarDays size={25} />
                <p>No upcoming slots. Check back soon.</p>
              </div>
            ) : (
              <>
                <div className="expert-day-picker" aria-label="Available dates">
                  {days.map((key) => {
                    const first = groups.get(key)![0];
                    return (
                      <button
                        key={key}
                        disabled={busy}
                        aria-pressed={activeDay === key}
                        className={activeDay === key ? 'active' : ''}
                        onClick={() => {
                          setDay(key);
                          setSlotId('');
                          setError('');
                        }}
                      >
                        <span>
                          {new Intl.DateTimeFormat('en-IN', {
                            weekday: 'short',
                            timeZone: timezone,
                          }).format(new Date(first.startsAt))}
                        </span>
                        <strong>
                          {new Intl.DateTimeFormat('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            timeZone: timezone,
                          }).format(new Date(first.startsAt))}
                        </strong>
                      </button>
                    );
                  })}
                </div>
                <label className="expert-calendar-filter">
                  Choose a date
                  <input
                    className="form-control"
                    aria-label="Choose availability date"
                    type="date"
                    value={activeDay}
                    min={days[0]}
                    max={days[days.length - 1]}
                    disabled={busy}
                    onChange={(event) => {
                      setDay(event.target.value);
                      setSlotId('');
                    }}
                  />
                </label>
                <div className="expert-time-picker" aria-label="Available times">
                  {(groups.get(activeDay) ?? []).map((slot) => (
                    <button
                      key={slot._id}
                      className={slotId === slot._id ? 'active' : ''}
                      aria-pressed={slotId === slot._id}
                      disabled={busy}
                      onClick={() => {
                        setSlotId(slot._id);
                        setError('');
                      }}
                    >
                      {new Intl.DateTimeFormat('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: timezone,
                      }).format(new Date(slot.startsAt))}
                    </button>
                  ))}
                </div>
                {!groups.has(activeDay) && (
                  <p className="expert-slot-timezone">
                    No available times on this date. Choose one of the available dates above.
                  </p>
                )}
              </>
            )}
            <label className="expert-booking-terms">
              <input
                className="form-check-input"
                type="checkbox"
                checked={accepted}
                disabled={busy}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                I accept the <Link to="/guidelines">beta booking and cancellation guidelines</Link>.
              </span>
            </label>
            {error && <Alert>{error}</Alert>}
            <button
              className="btn btn-primary expert-reserve-button"
              disabled={!chosenSlot || !accepted || busy || slots.loading || !!slots.error}
              onClick={book}
            >
              {busy ? 'Reserving...' : 'Reserve this session'}
              <ArrowRight size={18} />
            </button>
            {config.data?.checkoutEnabled === false ? (
              <p className="expert-reservation-note">
                <ShieldCheck size={18} />
                <span>
                  Payments are disabled. This reservation is a temporary 10-minute hold; no money
                  will be collected.
                </span>
              </p>
            ) : (
              <p className="expert-reservation-note">
                <ShieldCheck size={18} />
                <span>
                  Your time is held for 10 minutes while you complete payment. Confirmation follows
                  the booking policy.
                </span>
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const [searchParams] = useSearchParams();
  const { user, refresh } = useContext(Auth);
  const config = useData('/config');
  const [mode, setMode] = useState('login'),
    [email, setEmail] = useState(searchParams.get('email') ?? ''),
    [password, setPassword] = useState(''),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [phone, setPhone] = useState(''),
    [sent, setSent] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
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
    <div className="auth-page">
      <div className="container auth-shell">
        <div className="auth-layout">
          <section className="auth-story" aria-label="Conversations that move you forward">
            <div className="auth-story-copy">
              <span className="auth-accent" />
              <h1>
                A good
                <br />
                conversation
                <br />
                can change
                <br />
                what comes next.
              </h1>
              <p className="auth-story-intro">
                Connect with industry experts,
                <br />
                get personalized guidance and
                <br />
                make more for your next chapter.
              </p>
              <div className="auth-benefits">
                <div>
                  <span className="auth-feature green">
                    <UsersRound size={25} />
                  </span>
                  <div>
                    <h3>Learn from real experts</h3>
                    <p>Get guidance from industry professionals with hands-on experience.</p>
                  </div>
                </div>
                <div>
                  <span className="auth-feature blue">
                    <CalendarDays size={25} />
                  </span>
                  <div>
                    <h3>Book at your convenience</h3>
                    <p>Choose a time that works for you.</p>
                  </div>
                </div>
                <div>
                  <span className="auth-feature orange">
                    <Star size={25} />
                  </span>
                  <div>
                    <h3>Grow with confidence</h3>
                    <p>Gain clarity, build skills and take the next step in your career.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="auth-story-photo">
              <img
                src="/images/mentoring-conversation.png"
                alt="An illustrative conversation over a laptop"
              />
            </div>
            <div className="auth-story-note">
              <span>
                <GraduationCap size={26} />
              </span>
              <p>
                Better conversations
                <br />
                Brighter futures
              </p>
            </div>
          </section>
          <div className="auth-form-column">
            <section className="auth-form-panel">
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
              <p className="auth-subtitle">
                Sign in to your IndustryConnect account
                <br />
                to manage your bookings, appointments and more.
              </p>
              <p className="auth-beta-note">
                {config.data?.betaAccess === 'invite'
                  ? 'Our controlled beta is invitation-only.'
                  : 'Find your next conversation.'}
              </p>
              <div className="auth-tabs" aria-label="Sign-in options">
                {[
                  ['login', 'Email'],
                  ['phone', 'Phone OTP'],
                  ['register', 'Create account'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={mode === value ? 'active' : ''}
                    aria-pressed={mode === value}
                    disabled={busy}
                    onClick={() => {
                      setMode(value);
                      setSent(false);
                      setError('');
                      setNotice('');
                      setCode('');
                      setShowPassword(false);
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
                    <span className="auth-input-wrap">
                      <Mail size={17} aria-hidden="true" />
                      <input
                        className="form-control"
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </span>
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
                  <Field
                    label={mode === 'login' ? 'Password' : 'Password · at least 12 characters'}
                  >
                    <span className="auth-input-wrap">
                      <LockKeyhole size={17} aria-hidden="true" />
                      <input
                        className="form-control"
                        placeholder={
                          mode === 'login' ? 'Enter your password' : 'Create a strong password'
                        }
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={mode === 'login' ? 1 : 12}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        required
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                  </Field>
                )}
                {mode === 'login' && (
                  <div className="auth-forgot">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setSent(false);
                        setError('');
                        setNotice('');
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                <button className="btn btn-primary w-100 auth-continue" disabled={busy}>
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
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="auth-google" ref={googleRef} />
              {!config.data?.googleClientId && (
                <div className="auth-google-unavailable">
                  <button className="btn btn-outline-secondary w-100" disabled>
                    <Globe size={18} /> Continue with Google
                  </button>
                  <p>Google sign-in is not connected yet.</p>
                </div>
              )}
              {mode === 'login' && (
                <div className="auth-create">
                  Need an account?{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setSent(false);
                      setError('');
                      setNotice('');
                    }}
                  >
                    Create an account <ArrowRight size={14} />
                  </button>
                  <button
                    className="auth-verify-link"
                    onClick={() => {
                      setMode('verify');
                      setError('');
                      setNotice('');
                    }}
                  >
                    Verify email
                  </button>
                </div>
              )}
              {mode === 'phone' && (
                <p className="small text-body-secondary mt-3">
                  Invited beta members: sign in by email first, then use this page to link your
                  phone.
                </p>
              )}
            </section>
          </div>
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
    <div className="booking-dashboard">
      <section className="booking-welcome">
        <div className="container d-flex align-items-center gap-4 flex-wrap flex-lg-nowrap">
          <div className="booking-greeting flex-grow-1">
            <span className="booking-kicker">YOUR PERSONAL SPACE</span>
            <h1>Good to see you, {user?.name.split(' ')[0]}.</h1>
            <p>Keep track of your bookings, appointments and next steps in one place.</p>
          </div>
          <CalendarIllustration />
          <aside className="booking-discover d-flex align-items-start gap-3">
            <span className="booking-discover-icon">
              <CalendarDays size={30} />
            </span>
            <div>
              <h2>Find an expert</h2>
              <p>Explore our experts and book your next session.</p>
              <Link className="btn btn-primary btn-sm" to="/#experts">
                Find an expert <ArrowRight size={15} />
              </Link>
            </div>
          </aside>
        </div>
      </section>
      <div className="booking-tabs-wrap">
        <nav className="container booking-tabs" aria-label="Booking views">
          <button
            className={scope === 'customer' ? 'active' : ''}
            aria-pressed={scope === 'customer'}
            onClick={() => {
              setScope('customer');
              setPage(1);
            }}
          >
            <CalendarDays size={21} /> My bookings
          </button>
          {user?.roles.includes('expert') && (
            <button
              className={scope === 'expert' ? 'active' : ''}
              aria-pressed={scope === 'expert'}
              onClick={() => {
                setScope('expert');
                setPage(1);
              }}
            >
              <CalendarDays size={21} /> Expert appointments
            </button>
          )}
          <Link to="/studio">
            <UserRound size={21} /> Expert studio <ArrowUpRight size={13} />
          </Link>
          <Link to="/auth">
            <Link2 size={21} /> Link Google / phone
          </Link>
        </nav>
      </div>
      <div className="container booking-content">
        {config.data?.checkoutEnabled === false && (
          <div className="booking-payment-notice" role="status">
            <CircleHelp size={22} />
            <span>
              Payments are disabled in this build. Reserved slots expire automatically after 10
              minutes. No money will be collected.
            </span>
          </div>
        )}
        {config.error && <Alert>{config.error}</Alert>}
        {error && <Alert>{error}</Alert>}
        {bookings.loading ? (
          <Loader />
        ) : bookings.error ? (
          <Alert>{bookings.error}</Alert>
        ) : !bookings.data?.items.length ? (
          <section className="booking-empty">
            <div className="booking-empty-main">
              <CalendarIllustration search />
              <h2>
                {scope === 'expert'
                  ? 'Your next appointment is on its way'
                  : 'Your next conversation is waiting'}
              </h2>
              <p>
                {scope === 'expert'
                  ? 'Your expert appointments will appear here when customers book a session.'
                  : 'You do not have any bookings yet. Explore our experts and schedule your first session to get personalized guidance.'}
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <Link className="btn btn-primary" to={scope === 'expert' ? '/studio' : '/#experts'}>
                  {scope === 'expert' ? 'Open Expert Studio' : 'Explore Experts'}{' '}
                  <ArrowRight size={15} />
                </Link>
                <a className="btn btn-outline-secondary" href="/#how-it-works">
                  How it works
                </a>
              </div>
            </div>
            <div className="booking-benefits">
              <div>
                <span className="booking-benefit-icon green">
                  <UsersRound size={25} />
                </span>
                <div>
                  <h3>Learn from verified experts</h3>
                  <p>Get guidance from industry professionals.</p>
                </div>
              </div>
              <div>
                <span className="booking-benefit-icon blue">
                  <CalendarDays size={25} />
                </span>
                <div>
                  <h3>Flexible scheduling</h3>
                  <p>Book at a time that works for you.</p>
                </div>
              </div>
              <div>
                <span className="booking-benefit-icon orange">
                  <ShieldCheck size={25} />
                </span>
                <div>
                  <h3>Secure &amp; private</h3>
                  <p>Your meeting links stay in your private dashboard.</p>
                </div>
              </div>
            </div>
          </section>
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
    </div>
  );
}
function CalendarIllustration({ search = false }: { search?: boolean }) {
  return (
    <div className={`booking-calendar-art ${search ? 'with-search' : ''}`} aria-hidden="true">
      <div className="booking-calendar-sheet">
        <div className="booking-calendar-rings">
          <i />
          <i />
          <i />
        </div>
        <div className="booking-calendar-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i}>{!search && i === 1 && <Check size={17} />}</span>
          ))}
        </div>
      </div>
      {search && <Search className="booking-calendar-search" size={49} strokeWidth={1.6} />}
      <span className="booking-calendar-spark" />
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

function CategorySelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const [page, setPage] = useState(1);
  const categories = useData(`/categories?limit=100&page=${page}`);
  return (
    <>
      <select
        id={id}
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
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>, category: string) {
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
  const verificationCopy: Record<string, { title: string; description: string }> = {
    approved: {
      title: 'You are verified',
      description: 'Keep your profile and availability up to date.',
    },
    pending: {
      title: 'Profile under review',
      description:
        'Your profile has been submitted for admin verification. You can still add and manage your services.',
    },
    rejected: {
      title: 'Update your profile',
      description: 'Review the admin note and update your profile for another review.',
    },
    suspended: {
      title: 'Profile suspended',
      description:
        'Your profile is hidden from discovery. Contact the marketplace team for guidance.',
    },
  };
  const verification = verificationCopy[d?.verification] ?? {
    title: 'Get Verified',
    description: 'A verified profile builds trust and helps you get more bookings.',
  };
  const tabs = [
    { key: 'profile', label: 'Profile', Icon: UserRound },
    { key: 'services', label: 'Services', Icon: Layers },
    { key: 'availability', label: 'Availability', Icon: CalendarDays },
    { key: 'earnings', label: 'Earnings', Icon: ChartNoAxesColumnIncreasing },
  ];
  return (
    <div
      className={`studio-page ${tab === 'availability' || tab === 'earnings' ? 'availability-theme' : ''}`}
    >
      <div className="container studio-container">
        <div className="studio-heading d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-4">
          <div>
            <p className="studio-eyebrow">Expert Studio</p>
            <h1>Make your experience count.</h1>
            <p>
              {tab === 'earnings' ? (
                'Track your earnings, view payout history and get insights on your growth.'
              ) : tab === 'availability' ? (
                'Set your availability, manage your schedule and let people book time with you.'
              ) : tab === 'services' ? (
                'Create and manage the services you offer. Set your pricing, availability and help people take the next step in their career or business.'
              ) : (
                <>
                  Create a compelling profile to showcase your expertise and start connecting
                  <br className="d-none d-xl-block" /> with learners, professionals and businesses.
                </>
              )}
            </p>
          </div>
          <div className="verification-callout d-flex align-items-center gap-3">
            <span className="verification-emblem">
              {tab === 'availability' || tab === 'earnings' ? (
                <CalendarDays size={34} />
              ) : (
                <BadgeCheck size={34} />
              )}
            </span>
            <div>
              <h2>
                {tab === 'earnings'
                  ? 'Your earnings, clearly'
                  : tab === 'availability'
                    ? 'Stay in control'
                    : verification.title}
              </h2>
              <p>
                {tab === 'earnings'
                  ? 'Track recorded earnings and payouts. Transfers remain subject to payout and release checks.'
                  : tab === 'availability'
                    ? 'Set your availability and manage all your appointments in one place.'
                    : verification.description}
              </p>
              {d && tab !== 'availability' && tab !== 'earnings' && (
                <span className={`badge ${statusColor(d.verification)} mt-2`}>
                  {d.verification.replaceAll('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>
        <section className="studio-shell" aria-label="Expert workspace">
          <nav
            className="studio-tabs d-flex flex-wrap align-items-center gap-2"
            aria-label="Expert studio sections"
          >
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`btn studio-tab ${tab === key ? 'active' : ''}`}
                aria-current={tab === key ? 'page' : undefined}
                disabled={!d && key !== 'profile'}
                onClick={() => setTab(key)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
            <Link className="studio-appointments ms-md-auto" to="/dashboard">
              Manage Appointments <ArrowRight size={15} />
            </Link>
          </nav>
          <div
            className={`studio-content ${tab === 'services' || tab === 'availability' ? 'studio-services-content' : ''}`}
          >
            {error && <Alert>{error}</Alert>}
            {notice && <Alert kind="success">{notice}</Alert>}
            {profile.loading ? (
              <Loader />
            ) : profile.error ? (
              <Alert>
                {profile.error}{' '}
                <button className="btn btn-link p-0" onClick={profile.reload}>
                  Try again
                </button>
              </Alert>
            ) : (
              <div hidden={tab !== 'profile'}>
                <StudioProfile key={d?.updatedAt ?? 'new'} profile={d} busy={busy} onSave={save} />
              </div>
            )}
            {d && tab === 'services' && (
              <ServicesEditor profileApproved={d.verification === 'approved'} />
            )}
            {d && tab === 'availability' && <Availability />}
            {d && tab === 'earnings' && <Earnings />}
          </div>
        </section>
      </div>
    </div>
  );
}
function StudioSectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="studio-section-title d-flex align-items-start gap-3">
      <span className="studio-step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
function StudioField({
  id,
  label,
  hint,
  icon,
  required = true,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="studio-field">
      <label htmlFor={id} className="studio-label">
        {label}{' '}
        {required && (
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className={`studio-control ${icon ? 'with-icon' : ''}`}>
        {icon && (
          <span className="studio-input-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </div>
      {hint && (
        <small id={`${id}-hint`} className="studio-hint">
          {hint}
        </small>
      )}
    </div>
  );
}
function StudioProfile({
  profile: d,
  busy,
  onSave,
}: {
  profile: any;
  busy: boolean;
  onSave: (e: FormEvent<HTMLFormElement>, category: string) => Promise<void>;
}) {
  const { user } = useContext(Auth);
  const [draft, setDraft] = useState({
    slug: d?.slug ?? '',
    headline: d?.headline ?? '',
    bio: d?.bio ?? '',
    city: d?.city ?? '',
    languages: d?.languages?.join(', ') ?? 'English',
    timezone: d?.timezone ?? 'Asia/Kolkata',
    experienceYears: String(d?.experienceYears ?? 0),
    confirmationPolicy: d?.confirmationPolicy ?? 'manual',
  });
  const [category, setCategory] = useState(String(d?.categories?.[0] ?? '')),
    [expanded, setExpanded] = useState(false);
  const update = (key: keyof typeof draft, value: string) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const displayName = user?.name ?? 'Your name';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  const zones = Array.from(
    new Set([draft.timezone, 'Asia/Kolkata', ...Intl.supportedValuesOf('timeZone')]),
  );
  return (
    <div className="row g-4 studio-profile-layout">
      <div className="col-lg-8">
        <StudioSectionTitle
          number="1"
          title="Public Profile"
          description="Your profile goes live after admin verification. Update it to show your professional details."
        />
        {d?.reviewReason && <Alert kind="info">Review note: {d.reviewReason}</Alert>}
        <form onSubmit={(e) => void onSave(e, category)} aria-label="Public profile form">
          <fieldset disabled={busy} className="border-0 p-0 m-0">
            <div className="row gx-3 gy-0">
              <div className="col-md-6">
                <StudioField
                  id="studio-slug"
                  label="Public profile slug"
                  hint={`This will be your profile URL: ${window.location.host}/experts/${draft.slug || 'your-name'}`}
                  icon={<Link2 size={17} />}
                >
                  <input
                    id="studio-slug"
                    aria-describedby="studio-slug-hint"
                    className="form-control"
                    name="slug"
                    value={draft.slug}
                    onChange={(e) => update('slug', e.target.value)}
                    placeholder="your-name"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    minLength={3}
                    maxLength={60}
                    required
                  />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-category"
                  label="Primary expertise"
                  icon={<Hexagon size={17} />}
                >
                  <CategorySelect id="studio-category" value={category} onChange={setCategory} />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-headline"
                  label="Headline"
                  hint="A short, clear headline about what you do."
                >
                  <input
                    id="studio-headline"
                    aria-describedby="studio-headline-hint"
                    className="form-control"
                    name="headline"
                    value={draft.headline}
                    onChange={(e) => update('headline', e.target.value)}
                    placeholder="Product strategy & your next career chapter"
                    minLength={10}
                    maxLength={120}
                    required
                  />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-experience"
                  label="Experience in years"
                  hint="Total professional experience in years."
                >
                  <input
                    id="studio-experience"
                    aria-describedby="studio-experience-hint"
                    className="form-control"
                    name="experienceYears"
                    type="number"
                    value={draft.experienceYears}
                    onChange={(e) => update('experienceYears', e.target.value)}
                    min={0}
                    max={70}
                    required
                  />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-city"
                  label="City"
                  hint="Where you’re based."
                  icon={<MapPin size={17} />}
                >
                  <input
                    id="studio-city"
                    aria-describedby="studio-city-hint"
                    className="form-control"
                    name="city"
                    value={draft.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="Hyderabad"
                    minLength={2}
                    required
                  />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-languages"
                  label="Languages"
                  hint="Separate multiple languages with commas."
                  icon={<Globe size={17} />}
                >
                  <input
                    id="studio-languages"
                    aria-describedby="studio-languages-hint"
                    className="form-control"
                    name="languages"
                    value={draft.languages}
                    onChange={(e) => update('languages', e.target.value)}
                    required
                  />
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-timezone"
                  label="Timezone"
                  hint="Choose your profile’s local timezone."
                  icon={<Clock size={17} />}
                >
                  <select
                    id="studio-timezone"
                    aria-describedby="studio-timezone-hint"
                    className="form-select"
                    name="timezone"
                    value={draft.timezone}
                    onChange={(e) => update('timezone', e.target.value)}
                    required
                  >
                    {zones.map((zone) => (
                      <option value={zone} key={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </StudioField>
              </div>
              <div className="col-md-6">
                <StudioField
                  id="studio-confirmation"
                  label="Booking confirmation preference"
                  hint="Choose how you want paid appointments confirmed."
                  icon={<CalendarDays size={17} />}
                >
                  <select
                    id="studio-confirmation"
                    aria-describedby="studio-confirmation-hint"
                    className="form-select"
                    name="confirmationPolicy"
                    value={draft.confirmationPolicy}
                    onChange={(e) => update('confirmationPolicy', e.target.value)}
                    required
                  >
                    <option value="manual">I approve each paid request</option>
                    <option value="auto">Confirm automatically after payment</option>
                  </select>
                </StudioField>
              </div>
            </div>
            <StudioField
              id="studio-bio"
              label="About your experience"
              hint="Tell people about your background, expertise and what they can expect from a session."
            >
              <div className="studio-bio-wrap">
                <textarea
                  id="studio-bio"
                  aria-describedby="studio-bio-hint studio-bio-count"
                  className="form-control"
                  name="bio"
                  value={draft.bio}
                  onChange={(e) => update('bio', e.target.value)}
                  rows={5}
                  minLength={30}
                  maxLength={3000}
                  required
                />
                <small id="studio-bio-count" className="bio-counter">
                  {draft.bio.length}/3000
                </small>
              </div>
            </StudioField>
            <button className="btn btn-primary w-100 studio-submit" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit for verification'} <ArrowRight size={16} />
            </button>
          </fieldset>
        </form>
      </div>
      <aside className="col-lg-4 studio-sidebar" aria-label="Profile guidance and preview">
        <section className="studio-side-card">
          <div className="studio-side-heading">
            <span className="studio-side-icon warm">
              <Lightbulb size={18} />
            </span>
            <h3>Tips for a great profile</h3>
          </div>
          <ul className="profile-tip-list">
            {[
              'Use a clear and professional headline',
              'Add your key skills and expertise',
              'Write a short and genuine about section',
              'Keep your availability updated',
              'Describe what customers can expect',
            ].map((tip) => (
              <li key={tip}>
                <CircleCheck size={15} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="studio-side-card">
          <div className="studio-side-heading align-items-start">
            <span className="studio-side-icon blue">
              <Eye size={18} />
            </span>
            <div>
              <h3>Profile preview</h3>
              <p>This is how your profile will appear to users after verification.</p>
            </div>
          </div>
          <div className="studio-preview" aria-label="Live profile preview">
            <div className="preview-avatar">{initials}</div>
            <h4>{displayName}</h4>
            <p className="preview-headline">{draft.headline || 'Your professional headline'}</p>
            <ul className="preview-details">
              <li>
                <MapPin size={14} />
                {draft.city || 'Your city'}
              </li>
              <li>
                <BriefcaseBusiness size={14} />
                {draft.experienceYears || 0}+ years
              </li>
              <li>
                <Languages size={14} />
                {draft.languages || 'Your languages'}
              </li>
            </ul>
            <div id="studio-full-preview" hidden={!expanded}>
              <p className="preview-bio preserve">
                {draft.bio || 'Your experience and approach will appear here.'}
              </p>
              <small className="d-block mb-3">
                Draft preview. Changes go live only after submission and admin approval.
              </small>
            </div>
            <button
              className="btn btn-light w-100"
              type="button"
              aria-expanded={expanded}
              aria-controls="studio-full-preview"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Close full preview' : 'View full preview'} <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section className="studio-side-card">
          <div className="studio-side-heading align-items-start">
            <span className="studio-side-icon warm">
              <CircleHelp size={18} />
            </span>
            <div>
              <h3>Need help?</h3>
              <p>Read our expert guidelines or booking guidance for assistance.</p>
            </div>
          </div>
          <Link className="btn btn-light w-100 studio-guidelines" to="/guidelines">
            View Guidelines
          </Link>
        </section>
      </aside>
    </div>
  );
}

type StudioService = {
  _id: string;
  title: string;
  description: string;
  categoryId: string;
  durationMinutes: number;
  pricePaise: number;
  mode: 'online' | 'in_person';
  location?: string;
  confirmationPolicy?: 'auto' | 'manual';
  active: boolean;
};
type ServiceDraft = {
  title: string;
  description: string;
  categoryId: string;
  duration: string;
  price: string;
  mode: 'online' | 'in_person';
  location: string;
  confirmation: string;
  active: boolean;
};
const emptyServiceDraft = (): ServiceDraft => ({
  title: '',
  description: '',
  categoryId: '',
  duration: '45',
  price: '',
  mode: 'online',
  location: '',
  confirmation: '',
  active: true,
});
function ServicesEditor({ profileApproved }: { profileApproved: boolean }) {
  const services = useData<{ items: StudioService[] }>('/expert/services');
  const [editing, setEditing] = useState<string | null>(null),
    [draft, setDraft] = useState<ServiceDraft>(emptyServiceDraft),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null),
    formRef = useRef<HTMLFormElement>(null);
  function update<K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  function focusEditor() {
    titleRef.current?.focus();
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
  function beginNew() {
    setEditing(null);
    setDraft(emptyServiceDraft());
    setError('');
    setNotice('');
    focusEditor();
  }
  function editService(s: StudioService) {
    setEditing(s._id);
    setDraft({
      title: s.title,
      description: s.description,
      categoryId: String(s.categoryId),
      duration: String(s.durationMinutes),
      price: (s.pricePaise / 100).toFixed(2),
      mode: s.mode,
      location: s.location ?? '',
      confirmation: s.confirmationPolicy ?? '',
      active: s.active,
    });
    setError('');
    setNotice('');
    focusEditor();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d+(?:\.\d{1,2})?$/.test(draft.price)) {
      setError('Enter a price in INR with no more than two decimal places.');
      return;
    }
    const [rupees, paise = ''] = draft.price.split('.');
    const pricePaise = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
    if (!Number.isSafeInteger(pricePaise) || pricePaise < 100 || pricePaise > 10000000) {
      setError('Enter a total price between ₹1 and ₹100,000.');
      return;
    }
    setBusy(true);
    try {
      await post(
        `/expert/services${editing ? `/${editing}` : ''}`,
        {
          title: draft.title,
          description: draft.description,
          categoryId: draft.categoryId,
          durationMinutes: Number(draft.duration),
          pricePaise,
          mode: draft.mode,
          location: draft.location,
          ...(draft.confirmation ? { confirmationPolicy: draft.confirmation } : {}),
          active: draft.active,
        },
        editing ? 'PUT' : 'POST',
      );
      setEditing(null);
      setDraft(emptyServiceDraft());
      services.reload();
      setNotice(
        'Service saved. It is discoverable only when your profile is approved and the service and category are active.',
      );
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  async function togglePublish(s: StudioService) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await post(
        `/expert/services/${s._id}`,
        {
          title: s.title,
          description: s.description,
          categoryId: String(s.categoryId),
          durationMinutes: s.durationMinutes,
          pricePaise: s.pricePaise,
          mode: s.mode,
          location: s.location ?? '',
          ...(s.confirmationPolicy ? { confirmationPolicy: s.confirmationPolicy } : {}),
          active: !s.active,
        },
        'PUT',
      );
      if (editing === s._id) update('active', !s.active);
      services.reload();
      setNotice(
        s.active
          ? 'Service archived. It is no longer available for new bookings.'
          : 'Service publishing enabled. Your profile and category must also be approved and active.',
      );
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="services-workspace">
      {error && (
        <div className="services-feedback">
          <Alert>{error}</Alert>
        </div>
      )}
      {notice && (
        <div className="services-feedback">
          <Alert kind="success">{notice}</Alert>
        </div>
      )}
      <div className="row g-0">
        <section className="col-lg-5 services-list-column" aria-labelledby="services-list-title">
          <div className="services-list-heading d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div>
              <h2 id="services-list-title">Your Services</h2>
              <p>Services are what people book sessions with you for.</p>
            </div>
            <button
              className="btn service-add-button"
              type="button"
              disabled={busy}
              onClick={beginNew}
            >
              <Plus size={16} /> Add New Service
            </button>
          </div>
          {!profileApproved && (
            <p className="service-approval-note">
              <ShieldCheck size={14} /> Services become discoverable after profile approval.
            </p>
          )}
          {services.loading ? (
            <Loader />
          ) : services.error ? (
            <Alert>
              {services.error}{' '}
              <button className="btn btn-link p-0" onClick={services.reload}>
                Try again
              </button>
            </Alert>
          ) : (
            services.data?.items.map((s) => (
              <article
                className={`service-tile ${s.active ? 'published' : 'archived'} ${editing === s._id ? 'editing' : ''}`}
                key={s._id}
              >
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <button
                      className="service-title-button"
                      type="button"
                      disabled={busy}
                      onClick={() => editService(s)}
                      aria-label={`Edit ${s.title}`}
                    >
                      {s.title}
                    </button>
                    <span className={`service-publish-badge ${s.active ? 'active' : ''}`}>
                      {s.active ? 'Published' : 'Archived'}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    <strong className="service-card-price">{formatMoney(s.pricePaise)}</strong>
                    <details className="service-action-menu">
                      <summary aria-label={`Actions for ${s.title}`}>
                        <MoreHorizontal size={20} />
                      </summary>
                      <div
                        className="service-action-panel"
                        onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}
                      >
                        <button type="button" disabled={busy} onClick={() => editService(s)}>
                          <Pencil size={14} /> Edit service
                        </button>
                        <button type="button" disabled={busy} onClick={() => void togglePublish(s)}>
                          {s.active ? <Archive size={14} /> : <RotateCcw size={14} />}{' '}
                          {s.active ? 'Archive service' : 'Publish service'}
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
                <p className="service-card-meta">
                  {s.durationMinutes} min <span aria-hidden="true">·</span>{' '}
                  {s.mode === 'online'
                    ? 'Online (Google Meet)'
                    : `In person${s.location ? ` · ${s.location}` : ''}`}
                </p>
                <p className="service-card-description">{s.description}</p>
              </article>
            ))
          )}
          {!services.loading && !services.error && (
            <div className="service-empty-card text-center">
              <div className="service-empty-art" aria-hidden="true">
                <ClipboardList size={56} strokeWidth={1.4} />
                <span>
                  <Plus size={18} />
                </span>
              </div>
              <h3>
                {services.data?.items.length ? 'Add more services' : 'Create your first service'}
              </h3>
              <p>
                Create different services for career guidance,
                <br className="d-none d-xl-block" /> resume review, interview prep, and more.
              </p>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={beginNew}>
                <Plus size={15} />{' '}
                {services.data?.items.length
                  ? 'Create Another Service'
                  : 'Create Your First Service'}
              </button>
            </div>
          )}
        </section>
        <section
          className="col-lg-7 col-xl-4 services-form-column"
          aria-labelledby="service-editor-title"
        >
          <h2 id="service-editor-title">{editing ? 'Edit service' : 'Create a service'}</h2>
          <p className="service-editor-intro">
            Fill in the details of the service you want to offer.
          </p>
          <form ref={formRef} onSubmit={submit} aria-label="Service editor">
            <fieldset disabled={busy} className="border-0 m-0 p-0">
              <StudioField id="service-title" label="Service title">
                <input
                  id="service-title"
                  ref={titleRef}
                  className="form-control"
                  value={draft.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Career Clarity Session"
                  minLength={4}
                  maxLength={120}
                  required
                />
              </StudioField>
              <StudioField id="service-category" label="Category">
                <CategorySelect
                  id="service-category"
                  value={draft.categoryId}
                  onChange={(value) => update('categoryId', value)}
                />
              </StudioField>
              <StudioField id="service-description" label="What will the customer get?">
                <div className="studio-bio-wrap">
                  <textarea
                    id="service-description"
                    className="form-control"
                    value={draft.description}
                    onChange={(e) => update('description', e.target.value)}
                    placeholder="Describe what you will cover in this session..."
                    rows={4}
                    minLength={20}
                    maxLength={2000}
                    aria-describedby="service-description-count"
                    required
                  />
                  <small className="bio-counter" id="service-description-count">
                    {draft.description.length}/2000
                  </small>
                </div>
              </StudioField>
              <div className="row gx-3">
                <div className="col-sm-6">
                  <StudioField id="service-duration" label="Duration (minutes)">
                    <input
                      id="service-duration"
                      className="form-control"
                      type="number"
                      value={draft.duration}
                      onChange={(e) => update('duration', e.target.value)}
                      min={15}
                      max={240}
                      step={15}
                      required
                    />
                  </StudioField>
                </div>
                <div className="col-sm-6">
                  <StudioField id="service-price" label="Total price (INR)">
                    <input
                      id="service-price"
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) => update('price', e.target.value)}
                      placeholder="e.g. 1499"
                      min={1}
                      max={100000}
                      step="0.01"
                      required
                    />
                  </StudioField>
                </div>
              </div>
              <div className="row gx-3">
                <div className="col-sm-6">
                  <StudioField id="service-mode" label="Session format">
                    <select
                      id="service-mode"
                      className="form-select"
                      value={draft.mode}
                      onChange={(e) => update('mode', e.target.value as ServiceDraft['mode'])}
                      required
                    >
                      <option value="online">Online - Google Meet</option>
                      <option value="in_person">In person</option>
                    </select>
                  </StudioField>
                </div>
                <div className="col-sm-6">
                  <StudioField id="service-confirmation" label="Confirmation">
                    <select
                      id="service-confirmation"
                      className="form-select"
                      value={draft.confirmation}
                      onChange={(e) => update('confirmation', e.target.value)}
                    >
                      <option value="">Use profile preference</option>
                      <option value="auto">Automatic</option>
                      <option value="manual">Manual approval</option>
                    </select>
                  </StudioField>
                </div>
              </div>
              <StudioField
                id="service-location"
                label="Location (required for in-person sessions)"
                required={draft.mode === 'in_person'}
              >
                <input
                  id="service-location"
                  className="form-control"
                  value={draft.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="e.g. Hyderabad, Madhapur"
                  maxLength={300}
                  required={draft.mode === 'in_person'}
                />
              </StudioField>
              <div className="form-check service-publish-check">
                <input
                  id="service-active"
                  type="checkbox"
                  className="form-check-input"
                  checked={draft.active}
                  onChange={(e) => update('active', e.target.checked)}
                />
                <label className="form-check-label" htmlFor="service-active">
                  Publish this service
                </label>
                <small>Visible for booking after your profile is approved.</small>
              </div>
              <button
                className="btn btn-primary w-100 service-save-button"
                type="submit"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save Service'} <ArrowRight size={15} />
              </button>
            </fieldset>
          </form>
        </section>
        <aside className="col-xl-3 services-guidance-column" aria-label="Service guidance">
          <section className="service-guide-card guide-blue">
            <div className="service-guide-heading">
              <span className="service-guide-icon">
                <Lightbulb size={26} />
              </span>
              <h3>Tips for a great service</h3>
            </div>
            <ul className="profile-tip-list">
              {[
                'Use a clear and specific title',
                'Explain what the customer will get',
                'Set a suitable duration and price',
                'Choose the right category',
                'Keep the description concise and valuable',
              ].map((tip) => (
                <li key={tip}>
                  <CircleCheck size={15} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="service-guide-card guide-green">
            <div className="service-guide-heading align-items-start">
              <span className="service-guide-icon">
                <CalendarDays size={24} />
              </span>
              <div>
                <h3>Session formats</h3>
                <p>
                  You can offer online and in-person sessions. Online appointments use Google Meet
                  when Calendar is configured.
                </p>
                <details className="service-guide-details">
                  <summary>
                    Learn more <ArrowRight size={13} />
                  </summary>
                  <p>
                    Meet links are created after booking confirmation. In-person services require a
                    location and do not create a Meet link.
                  </p>
                </details>
              </div>
            </div>
          </section>
          <section className="service-guide-card guide-peach">
            <div className="service-guide-heading align-items-start">
              <span className="service-guide-icon">
                <IndianRupee size={24} />
              </span>
              <div>
                <h3>Pricing guidance</h3>
                <p>Set a clear total price based on the session you provide.</p>
                <details className="service-guide-details">
                  <summary>
                    View pricing tips <ArrowRight size={13} />
                  </summary>
                  <p>
                    Enter the full customer price in INR, with up to two decimal places. Commission
                    follows the platform policy stored when a booking is reserved.
                  </p>
                </details>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

type StudioSlot = {
  _id: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'held' | 'booked' | 'closed';
};
function localSlotInput(value: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    day: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}
function Availability() {
  const services = useData<{ items: StudioService[] }>('/expert/services');
  const [page, setPage] = useState(1);
  const slots = useData<{ items: StudioSlot[]; total: number }>(
    `/expert/slots?limit=6&page=${page}`,
  );
  const [serviceId, setServiceId] = useState(''),
    [day, setDay] = useState(''),
    [time, setTime] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const activeServices = services.data?.items.filter((s) => s.active) ?? [];
  const selected = activeServices.find((s) => s._id === serviceId);
  const startsAt = day && time ? new Date(`${day}T${time}`) : null;
  const endsAt =
    startsAt && Number.isFinite(+startsAt) && selected
      ? new Date(+startsAt + selected.durationMinutes * 60000)
      : null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const displayZone = zone === 'Asia/Calcutta' ? 'Asia/Kolkata' : zone;
  const zoneShort = new Intl.DateTimeFormat('en-IN', { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;
  function reset() {
    setEditing(null);
    setServiceId('');
    setDay('');
    setTime('');
  }
  function editSlot(s: StudioSlot) {
    const local = localSlotInput(new Date(s.startsAt));
    setEditing(s._id);
    setServiceId(activeServices.some((service) => service._id === s.serviceId) ? s.serviceId : '');
    setDay(local.day);
    setTime(local.time);
    setNotice('');
    setError('');
    formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!selected || !startsAt || !Number.isFinite(+startsAt)) {
      setError('Choose an active service, date and start time.');
      return;
    }
    const normalized = localSlotInput(startsAt);
    if (normalized.day !== day || normalized.time !== time) {
      setError('This local time does not exist. Choose another start time.');
      return;
    }
    if (+startsAt % 900000 !== 0) {
      setError('Choose a start time on a 15-minute boundary.');
      return;
    }
    setBusy(true);
    try {
      await post(
        `/expert/slots${editing ? `/${editing}` : ''}`,
        { serviceId, startsAt: startsAt.toISOString() },
        editing ? 'PUT' : 'POST',
      );
      setNotice(editing ? 'Availability updated.' : 'Availability added.');
      reset();
      slots.reload();
      if (page !== 1) setPage(1);
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  async function removeSlot(s: StudioSlot) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/expert/slots/${s._id}`, { method: 'DELETE' });
      if (editing === s._id) reset();
      setNotice('Availability removed. The slot is closed to new bookings.');
      if (slots.data?.items.length === 1 && page > 1) setPage(page - 1);
      else slots.reload();
    } catch (err) {
      setError(msg(err));
    } finally {
      setBusy(false);
    }
  }
  const timeLabel = (value: string) =>
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(
      new Date(value),
    );
  return (
    <div className="availability-workspace row g-0">
      <section className="col-lg-6 availability-form-panel">
        <StudioSectionTitle
          number="1"
          title={editing ? 'Edit Your Availability' : 'Add Your Availability'}
          description="Let people know when you’re available for sessions. Add individual dated time slots."
        />
        <div className="availability-zone d-flex align-items-center gap-3">
          <span>
            <CalendarDays size={25} />
          </span>
          <div>
            <strong>
              All times are in {displayZone}
              {zoneShort ? ` (${zoneShort})` : ''}
            </strong>
            <p>Dates and times use your device’s timezone. Only open slots can be changed.</p>
          </div>
        </div>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {services.error ? (
          <Alert>
            {services.error}{' '}
            <button className="btn btn-link p-0" onClick={services.reload}>
              Try again
            </button>
          </Alert>
        ) : services.loading ? (
          <Loader />
        ) : (
          <form ref={formRef} onSubmit={submit} aria-label="Availability editor">
            <fieldset disabled={busy} className="border-0 p-0 m-0">
              <StudioField id="availability-service" label="Service">
                <select
                  id="availability-service"
                  className="form-select"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  required
                >
                  <option value="">Choose a service</option>
                  {activeServices.map((s) => (
                    <option value={s._id} key={s._id}>
                      {s.title} · {s.durationMinutes} min
                    </option>
                  ))}
                </select>
              </StudioField>
              {!activeServices.length && (
                <p className="small text-body-secondary">
                  Create or publish a service in the Services tab before adding availability.
                </p>
              )}
              <StudioField id="availability-day" label="Date" icon={<CalendarDays size={18} />}>
                <input
                  id="availability-day"
                  className="form-control"
                  type="date"
                  min={localSlotInput(new Date()).day}
                  max={localSlotInput(new Date(Date.now() + 180 * 86400000)).day}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  required
                />
              </StudioField>
              <fieldset className="availability-time-fields">
                <legend className="studio-label">
                  Time slot{' '}
                  <span className="required-mark" aria-hidden="true">
                    *
                  </span>
                </legend>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="visually-hidden" htmlFor="availability-start">
                      Start time
                    </label>
                    <div className="studio-control with-icon">
                      <span className="studio-input-icon" aria-hidden="true">
                        <Clock size={18} />
                      </span>
                      <input
                        id="availability-start"
                        className="form-control"
                        type="time"
                        step={900}
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        aria-describedby="availability-duration-note"
                      />
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <label className="visually-hidden" htmlFor="availability-end">
                      End time
                    </label>
                    <div className="studio-control with-icon">
                      <span className="studio-input-icon" aria-hidden="true">
                        <Clock size={18} />
                      </span>
                      <input
                        id="availability-end"
                        className="form-control"
                        type="time"
                        value={endsAt ? localSlotInput(endsAt).time : ''}
                        readOnly
                        aria-describedby="availability-duration-note"
                      />
                    </div>
                  </div>
                </div>
                <small className="studio-hint" id="availability-duration-note">
                  {selected
                    ? `End time is calculated from the service’s ${selected.durationMinutes}-minute duration.`
                    : 'Select a service to calculate the end time.'}{' '}
                  Start at least an hour ahead, on a 15-minute boundary.
                  {endsAt && localSlotInput(endsAt).day !== day
                    ? ` Ends on ${endsAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}.`
                    : ''}
                </small>
              </fieldset>
              <StudioField
                id="availability-repeat"
                label="Repeat (Optional)"
                required={false}
                hint="Beta availability uses individual dated slots."
              >
                <select
                  id="availability-repeat"
                  className="form-select"
                  value="none"
                  disabled
                  aria-describedby="availability-repeat-hint"
                >
                  <option value="none">Does not repeat</option>
                </select>
              </StudioField>
              <button
                className="btn btn-primary w-100 availability-save"
                type="submit"
                disabled={busy || !activeServices.length}
              >
                {busy ? 'Saving…' : editing ? 'Save Availability' : 'Add Availability'}{' '}
                <CalendarDays size={16} />
              </button>
              {editing && (
                <button
                  className="btn btn-link w-100 mt-2"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    reset();
                    setError('');
                  }}
                >
                  Cancel edit
                </button>
              )}
            </fieldset>
          </form>
        )}
      </section>
      <section className="col-lg-6 availability-upcoming">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <StudioSectionTitle
            number="2"
            title="Upcoming Availability"
            description="Your upcoming time slots. Edit or remove open slots; reserved slots stay protected."
          />
          <button
            className="btn availability-refresh"
            type="button"
            aria-label="Refresh availability"
            onClick={slots.reload}
            disabled={busy}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        {slots.loading ? (
          <Loader />
        ) : slots.error ? (
          <Alert>
            {slots.error}{' '}
            <button className="btn btn-link p-0" onClick={slots.reload}>
              Try again
            </button>
          </Alert>
        ) : slots.data?.items.length ? (
          <>
            <div className="availability-slot-list">
              {slots.data.items.map((s) => {
                const dateValue = new Date(s.startsAt),
                  service = services.data?.items.find((item) => item._id === s.serviceId);
                const duration = Math.round((+new Date(s.endsAt) - +dateValue) / 60000);
                return (
                  <article
                    className={`availability-slot-card ${editing === s._id ? 'editing' : ''}`}
                    key={s._id}
                  >
                    <div className="slot-date-box">
                      <strong>{dateValue.toLocaleDateString('en-IN', { day: '2-digit' })}</strong>
                      <span>
                        {dateValue.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}
                      </span>
                      <small>{dateValue.getFullYear()}</small>
                    </div>
                    <div className="slot-card-body">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <h3>{dateValue.toLocaleDateString('en-IN', { weekday: 'long' })}</h3>
                        {s.status !== 'open' && (
                          <span
                            className={`badge ${s.status === 'held' ? 'text-bg-warning' : 'text-bg-success'}`}
                          >
                            {s.status}
                          </span>
                        )}
                      </div>
                      <p>
                        {timeLabel(s.startsAt)} - {timeLabel(s.endsAt)}{' '}
                        <span>({duration} min)</span>
                      </p>
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="slot-service-tag">
                          {service?.title ?? 'Service unavailable'}
                        </span>
                        {service && (
                          <span className="slot-mode">
                            {service.mode === 'online' ? (
                              <>
                                <Video size={15} /> Online
                              </>
                            ) : (
                              <>
                                <MapPin size={15} /> In person
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    {s.status === 'open' ? (
                      <div className="slot-card-actions">
                        <button
                          className="btn slot-edit"
                          type="button"
                          aria-label={`Edit slot ${date(s.startsAt)}`}
                          disabled={busy}
                          onClick={() => editSlot(s)}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="btn slot-remove"
                          type="button"
                          aria-label={`Remove slot ${date(s.startsAt)}`}
                          disabled={busy}
                          onClick={() => void removeSlot(s)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ) : (
                      <span
                        className="slot-protected"
                        title="Reserved slots cannot be edited or removed"
                      >
                        <ShieldCheck size={18} />
                        <span className="visually-hidden">Reserved slot protected</span>
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
            <Pager
              page={page}
              setPage={setPage}
              total={slots.data.total ?? slots.data.items.length}
              limit={6}
            />
          </>
        ) : (
          <div className="availability-empty text-center">
            <CalendarDays size={37} />
            <h3>Make room for your next conversation.</h3>
            <p>Add your first available slot using the form. Your schedule will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}

type PayoutRecord = {
  _id: string;
  bookingId: string;
  amountPaise: number;
  mode: string;
  status: 'paid' | 'processing' | 'submitted' | 'unknown' | 'failed';
  providerId?: string;
  reference?: string;
  createdAt: string;
};
type EarningsData = {
  summary: {
    totalEarningsPaise: number;
    completedSessions: number;
    pendingPayoutPaise: number;
    thisMonthPaise: number;
  };
  monthly: { month: string; netPaise: number; sessions: number }[];
  payouts: PayoutRecord[];
  payoutTotal: number;
  payoutPage: number;
  payoutLimit: number;
  timezone: string;
  currentMonth: string;
  asOf: string;
  payoutInfo: { mode: string; delayHours: number; paymentMode: string; checkoutEnabled: boolean };
};
const payoutLabels: Record<PayoutRecord['status'], string> = {
  paid: 'Recorded paid',
  processing: 'Processing',
  submitted: 'Submitted',
  unknown: 'Needs review',
  failed: 'Failed',
};
function monthLabel(key: string, short = false) {
  return new Intl.DateTimeFormat('en-IN', {
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(new Date(`${key}-01T00:00:00Z`));
}
function Earnings() {
  const [months, setMonths] = useState('6'),
    [status, setStatus] = useState('all'),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<PayoutRecord | null>(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const params = new URLSearchParams({ months, timezone, status, page: String(page), limit: '7' });
  const report = useData<EarningsData>(`/expert/earnings?${params}`);
  const recordRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) recordRef.current?.focus();
  }, [selected]);
  const data = report.data;
  if (report.loading) return <Loader />;
  if (report.error)
    return (
      <Alert>
        {report.error}{' '}
        <button className="btn btn-link p-0" onClick={report.reload}>
          Try again
        </button>
      </Alert>
    );
  if (!data) return null;
  const metrics = [
    {
      label: 'Total Earnings',
      value: formatMoney(data.summary.totalEarningsPaise),
      hint: 'Completed, captured session net',
      Icon: IndianRupee,
      tone: 'green',
    },
    {
      label: 'Completed Sessions',
      value: String(data.summary.completedSessions),
      hint: 'Paid, undisputed sessions',
      Icon: CalendarDays,
      tone: 'blue',
    },
    {
      label: 'Pending Payout',
      value: formatMoney(data.summary.pendingPayoutPaise),
      hint: 'Completed net not recorded paid',
      Icon: Clock,
      tone: 'peach',
    },
    {
      label: 'This Month',
      value: formatMoney(data.summary.thisMonthPaise),
      hint: `Sessions ending in ${monthLabel(data.currentMonth)}`,
      Icon: ChartNoAxesColumnIncreasing,
      tone: 'purple',
    },
  ];
  return (
    <div className="earnings-workspace">
      <div className="row g-3 earnings-metrics">
        {metrics.map(({ label, value, hint, Icon, tone }) => (
          <div className="col-sm-6 col-xl-3" key={label}>
            <article className={`earnings-metric tone-${tone}`} aria-label={label}>
              <span className="earnings-metric-icon">
                <Icon size={25} />
              </span>
              <div>
                <h2>{label}</h2>
                <strong>{value}</strong>
                <p>{hint}</p>
              </div>
            </article>
          </div>
        ))}
      </div>
      <div className="row g-3">
        <div className="col-lg-8">
          <section className="earnings-chart-panel">
            <div className="earnings-section-heading d-flex flex-wrap align-items-center justify-content-between gap-2">
              <h2>Earnings Overview</h2>
              <label className="visually-hidden" htmlFor="earnings-period">
                Earnings period
              </label>
              <select
                id="earnings-period"
                className="form-select form-select-sm w-auto"
                value={months}
                onChange={(e) => {
                  setMonths(e.target.value);
                  setSelected(null);
                }}
              >
                <option value="3">Last 3 Months</option>
                <option value="6">Last 6 Months</option>
                <option value="12">Last 12 Months</option>
              </select>
            </div>
            <EarningsChart monthly={data.monthly} />
            <p className="earnings-chart-note">
              Completed session net, grouped by session end in {data.timezone}. Refunded and
              disputed sessions are excluded.
            </p>
          </section>
          <section className="earnings-history">
            <div className="earnings-section-heading d-flex flex-wrap align-items-start justify-content-between gap-3">
              <div>
                <h2>Payout History</h2>
                <p>Track recorded payouts and transfer attempts.</p>
              </div>
              <label className="visually-hidden" htmlFor="payout-filter">
                Payout status
              </label>
              <select
                id="payout-filter"
                className="form-select form-select-sm w-auto"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                  setSelected(null);
                }}
              >
                <option value="all">All Transactions</option>
                <option value="paid">Recorded paid</option>
                <option value="processing">Processing</option>
                <option value="submitted">Submitted</option>
                <option value="unknown">Needs review</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="table-responsive earnings-payout-table">
              <table className="table align-middle mb-0">
                <caption className="visually-hidden">
                  Your recorded payouts. Paid records do not certify final bank settlement.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Description</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.length ? (
                    data.payouts.map((p) => (
                      <tr key={p._id}>
                        <td>
                          {new Date(p.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td>
                          {p.mode === 'manual' ? 'Manual session payout' : 'Route transfer record'}
                          <small>Booking {p.bookingId}</small>
                        </td>
                        <td>
                          <strong>{formatMoney(p.amountPaise)}</strong>
                        </td>
                        <td>
                          <span className={`payout-state payout-${p.status}`}>
                            {payoutLabels[p.status]}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn payout-record-button"
                            type="button"
                            aria-label={`View payout ${p._id}`}
                            onClick={() => setSelected(p)}
                          >
                            <FileText size={14} /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="payout-empty">
                          <WalletCards size={28} />
                          <h3>
                            {status === 'all'
                              ? 'No payouts recorded yet'
                              : 'No payouts match this filter'}
                          </h3>
                          <p>
                            {status === 'all'
                              ? 'Completed paid sessions become eligible only after reconciliation, dispute checks and the payout delay.'
                              : 'Try another status to view your payout records.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pager
              page={page}
              setPage={(value) => {
                setPage(value);
                setSelected(null);
              }}
              total={data.payoutTotal}
              limit={data.payoutLimit}
            />
            <p className="earnings-record-note">
              “Recorded paid” reflects an operator/provider record, not independently verified bank
              settlement. No tax invoice is generated here.
            </p>
            {selected && (
              <section
                className="payout-record-detail"
                ref={recordRef}
                tabIndex={-1}
                aria-label="Payout record details"
              >
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h3>Payout record</h3>
                  <button
                    className="btn btn-sm"
                    type="button"
                    aria-label="Close payout record"
                    onClick={() => setSelected(null)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <dl>
                  <dt>Record ID</dt>
                  <dd>{selected._id}</dd>
                  <dt>Booking</dt>
                  <dd>{selected.bookingId}</dd>
                  <dt>Amount</dt>
                  <dd>{formatMoney(selected.amountPaise)}</dd>
                  <dt>Status</dt>
                  <dd>{payoutLabels[selected.status]}</dd>
                  <dt>Payout mode</dt>
                  <dd>{selected.mode}</dd>
                  <dt>External reference</dt>
                  <dd>{selected.reference ?? selected.providerId ?? 'No reference recorded'}</dd>
                </dl>
                <p>This is a payout record, not a tax invoice or bank settlement certificate.</p>
              </section>
            )}
          </section>
        </div>
        <aside className="col-lg-4 earnings-sidebar" aria-label="Payout information and help">
          <section className="earnings-side-card payout-information">
            <div className="earnings-side-heading">
              <span className="earnings-side-icon blue">
                <Landmark size={24} />
              </span>
              <h2>Payout Information</h2>
            </div>
            <dl>
              <dt>Payout method</dt>
              <dd>
                {data.payoutInfo.mode === 'automatic'
                  ? 'Razorpay Route (conditional)'
                  : 'Manual operator-managed payout'}
              </dd>
              <dt>Payout delay</dt>
              <dd>{data.payoutInfo.delayHours} hours after session end</dd>
              <dt>Checkout</dt>
              <dd>
                {data.payoutInfo.checkoutEnabled
                  ? 'Test checkout configured'
                  : data.payoutInfo.paymentMode === 'disabled'
                    ? 'Disabled'
                    : `Disabled (${data.payoutInfo.paymentMode} mode)`}
              </dd>
            </dl>
            <p>
              Bank details are managed outside this app. Changes require your marketplace
              administrator.
            </p>
            <Link to="/guidelines">
              View payout guidelines <ArrowRight size={14} />
            </Link>
          </section>
          <section className="earnings-side-card earnings-tips">
            <div className="earnings-side-heading">
              <span className="earnings-side-icon blue">
                <Lightbulb size={24} />
              </span>
              <h2>Tips to increase earnings</h2>
            </div>
            <ul className="profile-tip-list">
              {[
                'Keep your availability updated',
                'Offer clear, focused services',
                'Respond to paid requests promptly',
                'Complete sessions before marking them complete',
                'Invite honest reviews after completed sessions',
              ].map((tip) => (
                <li key={tip}>
                  <CircleCheck size={15} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="earnings-side-card earnings-help">
            <div className="earnings-side-heading align-items-start">
              <span className="earnings-side-icon green">
                <MessageSquareQuote size={23} />
              </span>
              <div>
                <h2>Need help?</h2>
                <p>
                  Review payout rules and ask your marketplace administrator about payment or payout
                  records.
                </p>
              </div>
            </div>
            <Link className="btn btn-light w-100" to="/guidelines">
              View Guidelines <ArrowRight size={14} />
            </Link>
          </section>
          <div className="earnings-asof">
            Report as of {date(data.asOf)}.<br />
            Pending amounts may still be waiting for reconciliation or a payout delay.
          </div>
        </aside>
      </div>
    </div>
  );
}
function EarningsChart({ monthly }: { monthly: EarningsData['monthly'] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...monthly.map((m) => m.netPaise));
  if (!max)
    return (
      <div className="earnings-chart-empty">
        <ChartNoAxesColumnIncreasing size={37} />
        <h3>Your earnings story starts here.</h3>
        <p>
          {monthly.some((month) => month.sessions > 0)
            ? 'Completed sessions have zero net earnings in this period.'
            : 'No completed paid sessions in this period yet.'}
        </p>
      </div>
    );
  const order = Math.pow(10, Math.floor(Math.log10(max / 4))),
    step = Math.ceil(max / 4 / order) * order,
    ceiling = step * 4;
  const height = 180,
    left = 63,
    top = 24,
    plotWidth = 555,
    bottom = top + height;
  const interval = plotWidth / monthly.length,
    barWidth = Math.min(45, interval * 0.55);
  const focused = active ?? monthly.length - 1;
  return (
    <div className="earnings-chart-container">
      <svg
        viewBox="0 0 640 245"
        role="img"
        aria-label={`Monthly completed-session earnings. ${monthly.map((m) => `${monthLabel(m.month)}: ${formatMoney(m.netPaise)}`).join('; ')}`}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = bottom - (height * tick) / 4;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="#edf0f5" />
              <text x={left - 10} y={y + 4} textAnchor="end" className="chart-axis">
                {formatMoney(step * tick).replace(/\.00$/, '')}
              </text>
            </g>
          );
        })}
        {monthly.map((m, i) => {
          const x = left + interval * i + interval / 2,
            y = bottom - (height * m.netPaise) / ceiling;
          return (
            <g
              key={m.month}
              tabIndex={0}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              <title>
                {monthLabel(m.month)}: {formatMoney(m.netPaise)} from {m.sessions} completed
                sessions
              </title>
              <rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={bottom - y}
                rx="4"
                fill={focused === i ? '#569d70' : '#c0e1c9'}
              />
              <text x={x} y={bottom + 23} textAnchor="middle" className="chart-axis">
                {monthLabel(m.month, true)}
              </text>
              {focused === i && m.netPaise > 0 && (
                <g className="chart-tooltip">
                  <rect
                    x={Math.max(left, Math.min(x - 38, left + plotWidth - 76))}
                    y={Math.max(0, y - 43)}
                    width="76"
                    height="36"
                    rx="5"
                    fill="#203a2d"
                  />
                  <text
                    x={Math.max(left + 38, Math.min(x, left + plotWidth - 38))}
                    y={Math.max(0, y - 43) + 15}
                    textAnchor="middle"
                  >
                    {formatMoney(m.netPaise)}
                  </text>
                  <text
                    x={Math.max(left + 38, Math.min(x, left + plotWidth - 38))}
                    y={Math.max(0, y - 43) + 28}
                    textAnchor="middle"
                    className="chart-tooltip-month"
                  >
                    {monthLabel(m.month, true)} {m.month.slice(0, 4)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const adminSections = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'experts', label: 'Experts', icon: UsersRound },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'policies', label: 'Policies', icon: Shield },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reports', label: 'Reports', icon: ChartNoAxesColumnIncreasing },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'invitations', label: 'Invitations', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];
function Admin() {
  const [tab, setTab] = useState('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const CalloutIcon =
    tab === 'categories'
      ? Layers
      : tab === 'invitations'
        ? Mail
        : tab === 'payments'
          ? WalletCards
          : ShieldCheck;
  const selectTab = (next: string) => {
    setTab(next);
    setMenuOpen(false);
  };
  return (
    <div className="admin-workspace">
      <div className="admin-mobile-bar">
        <strong>Marketplace operations</strong>
        <button
          className="btn btn-outline-secondary btn-sm"
          aria-label="Toggle admin navigation"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />} Menu
        </button>
      </div>
      <aside id="admin-sidebar" className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link className="admin-sidebar-home" to="/admin" onClick={() => selectTab('overview')}>
          <House size={20} /> Admin Dashboard
        </Link>
        <span className="admin-sidebar-kicker">MARKETPLACE OPERATIONS</span>
        <nav aria-label="Admin navigation">
          {adminSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              className={tab === id ? 'active' : ''}
              onClick={() => selectTab(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>
        <Link className="admin-website-link" to="/">
          Go to website <ArrowUpRight size={16} />
        </Link>
      </aside>
      <div className="admin-main">
        <header className="admin-welcome">
          <div>
            <span>MARKETPLACE OPERATIONS</span>
            <h1>
              {tab === 'payments'
                ? 'Bookings, reconciliation & payouts'
                : 'Keep good connections running.'}
            </h1>
            <p>
              {tab === 'categories'
                ? 'Manage professional categories that help users find the right experts.'
                : tab === 'payments'
                  ? 'Track bookings, manage payouts and reconcile payment records.'
                  : 'Verification, policies and every detail that builds trust.'}
            </p>
          </div>
          {['experts', 'categories', 'policies', 'settings', 'payments', 'invitations'].includes(
            tab,
          ) ? (
            <div className="admin-expert-callout">
              <CalloutIcon size={29} />
              <div>
                <strong>
                  {
                    {
                      experts: 'Expert verification',
                      categories: 'Organize skills, grow faster',
                      policies: 'Set fair policies',
                      settings: 'Connect your providers',
                      payments: 'Secure & transparent payouts',
                      invitations: 'Invite trusted users',
                    }[tab]
                  }
                </strong>
                <p>
                  {
                    {
                      experts:
                        'Review and approve expert profiles to maintain a trusted marketplace.',
                      categories:
                        'Well-structured categories make it easier to find the right experts.',
                      policies: 'Manage commissions, payouts and booking rules.',
                      settings:
                        'Configure email, Google, Calendar and phone integration credentials.',
                      payments: 'Review stored payment records and reconcile provider outcomes.',
                      invitations: 'Control who can access the beta and test safely.',
                    }[tab]
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="admin-beta-status">
              <span className="admin-status-dot" />
              <div>
                <strong>Controlled beta</strong>
                <small>Live transactions disabled</small>
              </div>
            </div>
          )}
        </header>
        <div className="admin-section-nav">
          <nav aria-label="Admin sections">
            {adminSections
              .filter((s) =>
                [
                  'overview',
                  'experts',
                  'categories',
                  'policies',
                  'payments',
                  'invitations',
                ].includes(s.id),
              )
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  aria-current={tab === id ? 'page' : undefined}
                  className={tab === id ? 'active' : ''}
                  onClick={() => selectTab(id)}
                >
                  <Icon size={18} />
                  {label}
                </button>
              ))}
          </nav>
        </div>
        <div className="admin-panel-content">
          {tab === 'overview' && <AdminOverview onNavigate={selectTab} />}
          {tab === 'experts' && <AdminExperts />}
          {tab === 'categories' && <AdminCategories />}
          {tab === 'policies' && <AdminPolicies />}
          {tab === 'settings' && <AdminIntegrations />}
          {tab === 'payments' && <AdminPayments />}
          {tab === 'invitations' && <Invitations />}
          {tab === 'reports' && <AdminLedger />}
          {tab === 'notifications' && <AdminExceptions notificationsOnly />}
        </div>
      </div>
    </div>
  );
}
function AdminOverview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const o = useData('/admin/overview');
  const cards = o.data
    ? [
        {
          label: 'Experts awaiting review',
          value: o.data.pendingExperts,
          hint: 'Pending verification',
          icon: UsersRound,
          tone: 'blue',
          target: 'experts',
        },
        {
          label: 'Total bookings',
          value: o.data.bookings,
          hint: 'All time bookings',
          icon: CalendarDays,
          tone: 'green',
          target: 'payments',
        },
        {
          label: 'Refunds to process',
          value: o.data.refundsRequired,
          hint: 'Requires operator processing',
          icon: RefreshCw,
          tone: 'orange',
          target: 'payments',
        },
        {
          label: 'Failed notification jobs',
          value: o.data.failedJobs,
          hint: 'Needs attention',
          icon: TriangleAlert,
          tone: 'purple',
          target: 'notifications',
        },
      ]
    : [];
  return (
    <>
      {o.error && <Alert>{o.error}</Alert>}
      {o.loading ? (
        <Loader />
      ) : (
        o.data && (
          <>
            <section className="admin-metrics" aria-label="Marketplace summary">
              {cards.map(({ label, value, hint, icon: Icon, tone, target }) => (
                <button
                  className={`admin-metric ${tone}`}
                  key={label}
                  onClick={() => onNavigate(target)}
                >
                  <span className="admin-metric-icon">
                    <Icon size={20} />
                  </span>
                  <span className="admin-metric-label">{label}</span>
                  <strong>{value}</strong>
                  <span className="admin-metric-bottom">
                    {hint}
                    <ArrowRight size={17} />
                  </span>
                </button>
              ))}
            </section>
            <section className="admin-surface admin-readiness">
              <div className="admin-panel-heading">
                <span className="admin-heading-icon">
                  <Mail size={24} />
                </span>
                <h2>Payment readiness</h2>
                <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={o.reload}>
                  <RefreshCw size={14} /> Refresh status
                </button>
              </div>
              {o.data.paymentBlockers.length ? (
                o.data.paymentBlockers.map((blocker: string) => (
                  <div className="admin-checkout-notice" role="status" key={blocker}>
                    <CircleHelp size={23} />
                    <div>
                      <strong>{blocker}</strong>
                      {blocker === 'Checkout is disabled' && (
                        <p>
                          Payments are disabled in this build. Reserved slots expire automatically
                          after 10 minutes. No money will be collected.
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="admin-checkout-notice">
                  <CircleHelp size={23} />
                  <div>
                    Test checkout is configured. Live launch still requires the complete release
                    review.
                  </div>
                </div>
              )}
              <div className="admin-providers">
                {[
                  { key: 'email', label: 'Email', icon: Mail },
                  { key: 'google', label: 'Google', icon: Globe },
                  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
                  { key: 'phone', label: 'Phone', icon: Phone },
                  { key: 'route', label: 'Route', icon: Hexagon },
                ].map(({ key, label, icon: Icon }) => (
                  <div key={key}>
                    <span className="admin-provider-icon">
                      <Icon size={22} />
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <span
                        className={o.data.providerStatus[key] ? 'configured' : 'not-configured'}
                      >
                        <i />
                        {o.data.providerStatus[key] ? 'Configured' : 'Not connected'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="admin-readiness-note">
                <Settings size={18} />
                <span>Configured does not mean externally tested or approved.</span>
                <button onClick={() => onNavigate('settings')}>
                  Go to settings <ArrowRight size={14} />
                </button>
              </div>
            </section>
          </>
        )
      )}
      <AdminExceptions onNavigate={onNavigate} />
    </>
  );
}
function AdminExceptions({
  onNavigate,
  notificationsOnly = false,
}: {
  onNavigate?: (tab: string) => void;
  notificationsOnly?: boolean;
}) {
  const q = useData('/admin/exceptions');
  const groups: { key: string; label: string }[] = notificationsOnly
    ? [{ key: 'jobs', label: 'Failed jobs' }]
    : [
        { key: 'bookings', label: 'Booking exceptions' },
        { key: 'payouts', label: 'Payouts awaiting reconciliation' },
        { key: 'jobs', label: 'Failed jobs' },
      ];
  const total = q.data ? groups.reduce((sum, g) => sum + q.data[g.key].length, 0) : null;
  return (
    <section className="admin-surface admin-exceptions">
      <div className="admin-panel-heading">
        <span className="admin-heading-icon">
          <Clock size={24} />
        </span>
        <div>
          <h2>{notificationsOnly ? 'Notification jobs' : 'Exception queue'}</h2>
          {q.data && (
            <p>
              {groups.map((g) => `${q.data[g.key].length} ${g.label.toLowerCase()}`).join(' / ')}
            </p>
          )}
        </div>
        <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={q.reload}>
          <RefreshCw size={14} /> Refresh queue
        </button>
      </div>
      <p className="admin-exception-guidance">
        Use Payments to reconcile captured/refunded payments. Ambiguous provider orders and
        transfers must be reviewed before retrying. Queue lists show up to 100 records per type.
      </p>
      {q.loading ? (
        <Loader />
      ) : q.error ? (
        <Alert>{q.error}</Alert>
      ) : total === 0 ? (
        <div className="admin-queue-empty">
          <FolderOpen size={31} />
          <strong>{notificationsOnly ? 'No failed jobs found' : 'No exceptions found'}</strong>
          <p>No {notificationsOnly ? 'failed jobs' : 'exceptions'} returned in this queue.</p>
        </div>
      ) : (
        <div className="admin-queue-groups">
          {groups
            .filter((g) => q.data?.[g.key].length)
            .map((g) => (
              <div key={g.key}>
                <h3>{g.label}</h3>
                <ul>
                  {q.data[g.key].map((item: any) => (
                    <li key={item._id}>
                      <code>{item._id}</code>
                      <span>{item.paymentStatus || item.status || 'Requires review'}</span>
                      {item.type && <span>{item.type}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
      {onNavigate && (
        <button className="admin-queue-action" onClick={() => onNavigate('payments')}>
          Open payments <ArrowRight size={15} />
        </button>
      )}
    </section>
  );
}
function AdminLedger() {
  const [page, setPage] = useState(1);
  const ledger = useData(`/admin/ledger?page=${page}`);
  return (
    <section className="admin-surface">
      <h2 className="admin-report-title">Ledger report</h2>
      <p className="text-body-secondary small">
        Stored ledger entries. This is not provider settlement certification.
      </p>
      {ledger.loading ? (
        <Loader />
      ) : ledger.error ? (
        <Alert>{ledger.error}</Alert>
      ) : !ledger.data?.items.length ? (
        <Empty title="No ledger entries on this page" />
      ) : (
        <>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {ledger.data.items.map((row: any) => (
                  <tr key={row._id}>
                    <td>
                      <code>{row._id}</code>
                    </td>
                    <td>
                      <code>{row.bookingId}</code>
                    </td>
                    <td>{row.kind}</td>
                    <td>
                      {Number.isSafeInteger(row.grossPaise)
                        ? formatMoney(row.grossPaise)
                        : 'Unavailable'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="d-flex justify-content-between align-items-center gap-3">
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={!ledger.data || ledger.data.items.length < 24}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
function AdminExperts() {
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [category, setCategory] = useState(''),
    [sort, setSort] = useState('newest');
  const [applied, setApplied] = useState(''),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [review, setReview] = useState<{ expert: any; status: string } | null>(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  const [categoryPage, setCategoryPage] = useState(1),
    [categoryOptions, setCategoryOptions] = useState<any[]>([]);
  const categories = useData(`/admin/categories?page=${categoryPage}&limit=100`);
  useEffect(() => {
    if (Array.isArray(categories.data?.items))
      setCategoryOptions((previous) => {
        const map = new Map(previous.map((c) => [c._id, c]));
        for (const c of categories.data.items) map.set(c._id, c);
        return [...map.values()];
      });
  }, [categories.data]);
  const experts = useData(`/admin/experts?page=${page}${applied ? '&' + applied : ''}`);
  function filter(nextStatus = status) {
    setStatus(nextStatus);
    setPage(1);
    setApplied(new URLSearchParams({ q: query, status: nextStatus, category, sort }).toString());
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!review) return;
    setBusy(true);
    setError('');
    try {
      await post(
        `/admin/experts/${review.expert._id}/verification`,
        { status: review.status, reason: reason.trim() },
        'PATCH',
      );
      setNotice(`Expert ${review.status}.`);
      setReview(null);
      setReason('');
      experts.reload();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  function exportPage() {
    const cell = (value: unknown) => {
      let text = String(value ?? '');
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const rows = [
      ['Name', 'Email', 'Headline', 'Status', 'Experience years', 'Joined'],
      ...(experts.data?.items ?? []).map((e: any) => [
        e.userId?.name,
        e.userId?.email,
        e.headline,
        e.verification,
        e.experienceYears,
        e.createdAt,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `expert-review-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  const summary = experts.data?.summary;
  return (
    <div className="expert-admin">
      {summary && (
        <section className="expert-review-metrics" aria-label="Expert summary">
          {[
            {
              label: 'Experts awaiting review',
              value: summary.pending,
              hint: 'View pending',
              status: 'pending',
              icon: UserRound,
              tone: 'blue',
            },
            {
              label: 'Verified experts',
              value: summary.approved,
              hint: 'View approved',
              status: 'approved',
              icon: CircleCheck,
              tone: 'green',
            },
            {
              label: 'Total experts',
              value: summary.total,
              hint: 'Manage experts',
              status: 'all',
              icon: Clock,
              tone: 'orange',
            },
            {
              label: 'Profiles updated this month',
              value: summary.updatedThisMonth,
              hint: 'UTC calendar month',
              status: null,
              icon: ChartNoAxesColumnIncreasing,
              tone: 'purple',
            },
          ].map(({ label, value, hint, status: next, icon: Icon, tone }) => (
            <div className={`expert-review-metric ${tone}`} key={label}>
              <span className="expert-review-metric-icon">
                <Icon size={23} />
              </span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                {next ? (
                  <button onClick={() => filter(next)}>
                    {hint}
                    <ArrowRight size={13} />
                  </button>
                ) : (
                  <small>{hint}</small>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
      <form
        className="expert-admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          filter();
        }}
      >
        <label className="expert-admin-search">
          <span className="visually-hidden">Search experts</span>
          <Search size={18} />
          <input
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search experts by name, email or expertise..."
            maxLength={120}
          />
        </label>
        <label>
          Status
          <select
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label>
          Category
          <select
            className="form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option value={c._id} key={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="slug">Profile slug A-Z</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          <SlidersHorizontal size={16} /> Filter
        </button>
        {categories.data && categoryOptions.length < categories.data.total && (
          <button
            className="btn btn-link"
            type="button"
            disabled={categories.loading}
            onClick={() => setCategoryPage(categoryPage + 1)}
          >
            Load more categories
          </button>
        )}
      </form>
      {categories.error && <Alert>{categories.error}</Alert>}
      <section className="admin-surface expert-verification-list">
        <div className="expert-verification-heading">
          <div>
            <h2>Expert verification{experts.data ? ` (${experts.data.total})` : ''}</h2>
            <p>Review expert profiles, verify details and approve or reject.</p>
          </div>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={experts.loading || !experts.data?.items.length}
            onClick={exportPage}
          >
            <Download size={16} /> Export page
          </button>
        </div>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {experts.loading ? (
          <Loader />
        ) : experts.error ? (
          <Alert>{experts.error}</Alert>
        ) : !experts.data?.items.length ? (
          <Empty title="No experts match these filters">Try a different search or status.</Empty>
        ) : (
          <div className="expert-review-list">
            {experts.data.items.map((e: any) => (
              <article className="expert-review-row" key={e._id}>
                <div className="expert-review-identity">
                  <span className="expert-review-avatar">
                    {(e.userId?.name || 'Expert')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part: string) => part[0])
                      .join('')}
                  </span>
                  <div>
                    <h3>{e.userId?.name || 'Account unavailable'}</h3>
                    <p>{e.headline}</p>
                    <div className="expert-review-meta">
                      {e.userId?.email && (
                        <span>
                          <Mail size={13} />
                          {e.userId.email}
                        </span>
                      )}
                      {e.createdAt && (
                        <span>
                          <CalendarDays size={13} />
                          Joined{' '}
                          {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
                            new Date(e.createdAt),
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="expert-review-details">
                  <div className="expert-review-tags">
                    {e.categories?.map((c: any) => (
                      <span key={c._id || c}>{c.name || 'Category unavailable'}</span>
                    ))}
                  </div>
                  <div className="expert-review-meta">
                    <span>
                      <FileText size={14} />
                      {e.experienceYears ?? 'Not provided'}
                      {e.experienceYears != null ? ' years experience' : ''}
                    </span>
                    {e.city && (
                      <span>
                        <MapPin size={13} />
                        {e.city}
                      </span>
                    )}
                  </div>
                </div>
                <div className="expert-review-actions">
                  <span className={`badge ${statusColor(e.verification)}`}>
                    {e.verification === 'pending' ? 'Pending review' : e.verification}
                  </span>
                  <div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy || e.verification === 'approved'}
                      onClick={() => {
                        setReview({ expert: e, status: 'approved' });
                        setReason('');
                        setError('');
                      }}
                    >
                      <Check size={13} /> Approve
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      disabled={busy || e.verification === 'rejected'}
                      onClick={() => {
                        setReview({ expert: e, status: 'rejected' });
                        setReason('');
                        setError('');
                      }}
                    >
                      Reject
                    </button>
                    <details className="expert-review-more">
                      <summary aria-label={`More actions for ${e.userId?.name || 'expert'}`}>
                        <MoreHorizontal size={18} />
                      </summary>
                      <div>
                        <button
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open');
                            setReview({ expert: e, status: 'suspended' });
                            setReason('');
                          }}
                        >
                          Suspend expert
                        </button>
                        <button
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open');
                            setReview({ expert: e, status: 'details' });
                          }}
                        >
                          Review profile
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <Pager page={page} setPage={setPage} total={experts.data?.total ?? 0} />
        {review && (
          <section className="expert-review-editor" aria-label="Review selected expert">
            <h3>
              {review.status === 'details'
                ? 'Profile details'
                : `${review.status === 'approved' ? 'Approve' : review.status === 'rejected' ? 'Reject' : 'Suspend'} expert`}
              : {review.expert.userId?.name}
            </h3>
            <p>{review.expert.bio}</p>
            {review.status === 'details' ? (
              <button className="btn btn-outline-secondary" onClick={() => setReview(null)}>
                Close details
              </button>
            ) : (
              <form onSubmit={verify}>
                <Field label="Review reason">
                  <textarea
                    className="form-control"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={500}
                    required
                    placeholder="Record the evidence and reason for this decision."
                  />
                </Field>
                <p className="small text-body-secondary">
                  Approval publishes the expert subject to the existing marketplace policies.
                </p>
                <div className="d-flex gap-2">
                  <button className="btn btn-primary" disabled={busy || reason.trim().length < 5}>
                    {busy ? 'Saving...' : 'Save review decision'}
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
function AdminCategories() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('all'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [resetKey, setResetKey] = useState(0);
  const categories = useData(
    `/admin/categories?page=${page}&q=${encodeURIComponent(q)}&status=${status}`,
  );
  function reset() {
    setEditing(null);
    setResetKey((k) => k + 1);
    setError('');
  }
  return (
    <div className="admin-category-layout admin-page-spacing">
      <section className="admin-surface">
        <h2>Professional categories</h2>
        <p className="admin-muted">
          These categories organize marketplace discovery. Activate or archive categories anytime.
        </p>
        <div className="admin-list-filters">
          <label className="admin-search-field">
            <Search size={17} />
            <input
              className="form-control"
              aria-label="Search categories"
              value={q}
              maxLength={120}
              placeholder="Search categories..."
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className="form-select"
            aria-label="Category status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
          </select>
        </div>
        {categories.loading ? (
          <Loader />
        ) : categories.error ? (
          <Alert>{categories.error}</Alert>
        ) : !categories.data?.items.length ? (
          <Empty title="No categories found" />
        ) : (
          <div className="table-responsive admin-data-table">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Category name</th>
                  <th>Unique slug</th>
                  <th>Status</th>
                  <th>Experts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.data.items.map((c: any, i: number) => (
                  <tr key={c._id}>
                    <td>{(page - 1) * 24 + i + 1}</td>
                    <td>{c.name}</td>
                    <td>{c.slug}</td>
                    <td>
                      <span
                        className={`badge ${c.active ? 'text-bg-success' : 'text-bg-secondary'}`}
                      >
                        {c.active ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td>{c.expertCount ?? 'Unavailable'}</td>
                    <td>
                      <button
                        className="btn btn-link btn-sm"
                        aria-label={`Edit ${c.name}`}
                        onClick={() => {
                          setEditing(c);
                          setError('');
                          setNotice('');
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminListCount page={page} total={categories.data?.total ?? 0} />
        <Pager page={page} setPage={setPage} total={categories.data?.total ?? 0} />
      </section>
      <section className="admin-surface admin-category-editor">
        <h2>{editing ? 'Edit category' : 'Add a new category'}</h2>
        <p className="admin-muted">
          Create a category to organize expert services on the marketplace.
        </p>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <form
          key={`${editing?._id ?? 'new'}-${resetKey}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError('');
            try {
              await post(
                `/admin/categories${editing ? '/' + editing._id : ''}`,
                { name: f.get('name'), slug: f.get('slug'), active: f.get('active') === 'on' },
                editing ? 'PUT' : 'POST',
              );
              reset();
              categories.reload();
              setNotice('Category saved.');
            } catch (err) {
              setError(msg(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Category name">
            <input
              className="form-control"
              name="name"
              defaultValue={editing?.name ?? ''}
              placeholder="e.g. Marketing & Growth"
              minLength={2}
              maxLength={80}
              required
            />
          </Field>
          <Field label="Unique slug">
            <input
              className="form-control"
              name="slug"
              defaultValue={editing?.slug ?? ''}
              placeholder="e.g. marketing-growth"
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
            />
            <small>Use lowercase letters, numbers and hyphens only.</small>
          </Field>
          <label className="admin-check-label">
            <input
              className="form-check-input"
              type="checkbox"
              name="active"
              defaultChecked={editing?.active ?? true}
            />{' '}
            <span>
              Active category
              <small>Archived categories hide affected listings from discovery.</small>
            </span>
          </label>
          <button className="btn btn-primary w-100" disabled={busy}>
            Save category
          </button>
          <button
            className="btn btn-outline-secondary w-100 mt-2"
            type="button"
            disabled={busy}
            onClick={reset}
          >
            Cancel
          </button>
        </form>
        <aside className="admin-info-panel mt-4">
          <CircleHelp size={25} />
          <div>
            <h3>Tips for better categories</h3>
            <ul>
              <li>Use clear and specific names</li>
              <li>Keep the slug short and descriptive</li>
              <li>Group similar services together</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
function AdminListCount({ page, total }: { page: number; total: number }) {
  return (
    <p className="admin-list-count">
      {total
        ? `Showing ${(page - 1) * 24 + 1}-${Math.min(page * 24, total)} of ${total}`
        : 'No records'}
    </p>
  );
}
type IntegrationField = {
  key: string;
  label: string;
  secret: boolean;
  type: string;
  value: string;
  configured: boolean;
  options?: string[];
};
type IntegrationProvider = {
  id: string;
  title: string;
  help: string;
  enabled: boolean;
  configured: boolean;
  fields: IntegrationField[];
};
type IntegrationSettings = {
  available: boolean;
  revision: number;
  origin: string;
  providers: IntegrationProvider[];
};
function AdminIntegrations() {
  const data = useData<IntegrationSettings>('/admin/integrations');
  if (data.loading && !data.data) return <Loader />;
  if (data.error) return <Alert>{data.error}</Alert>;
  if (!data.data) return null;
  return (
    <section className="admin-integrations admin-page-spacing">
      <div className="admin-surface">
        <div className="admin-page-heading">
          <span>
            <Settings size={28} />
          </span>
          <div>
            <h2>Provider configuration</h2>
            <p>
              Manage SMTP / Amazon SES, WhatsApp, Razorpay, Google, Calendar / Meet and phone OTP.
            </p>
          </div>
        </div>
        <div className="admin-info-panel">
          <ShieldCheck size={25} />
          <div>
            <h3>Credentials stay on the server</h3>
            <p>
              Saved secrets are encrypted and never returned to this page. Leave a secret blank to
              keep it, or select Clear saved secret to remove it. Messaging settings apply without a
              restart. Razorpay keys are staged for operator activation. Configured does not mean
              externally tested.
            </p>
          </div>
        </div>
        <p className="integration-origin">
          Application origin: <code>{data.data.origin}</code>
        </p>
        {!data.data.available && (
          <Alert>
            Encrypted integration storage is not configured on this server. An operator must
            provision its storage path and encryption key before changes can be saved.
          </Alert>
        )}
      </div>
      <div className="integration-card-grid">
        {data.data.providers.map((provider) => (
          <IntegrationCard
            key={provider.id}
            provider={provider}
            revision={data.data!.revision}
            available={data.data!.available && !data.loading}
            onSaved={data.reload}
          />
        ))}
      </div>
    </section>
  );
}
function IntegrationCard({
  provider,
  revision,
  available,
  onSaved,
}: {
  provider: IntegrationProvider;
  revision: number;
  available: boolean;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(provider.fields.map((f) => [f.key, f.value])),
    ),
    [enabled, setEnabled] = useState(provider.enabled),
    [cleared, setCleared] = useState<string[]>([]),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [recipient, setRecipient] = useState(''),
    [consent, setConsent] = useState(false);
  const [savedFields, setSavedFields] = useState(provider.fields);
  const Icon =
    provider.id === 'email'
      ? Mail
      : provider.id === 'google'
        ? Globe
        : provider.id === 'calendar'
          ? CalendarDays
          : Phone;
  return (
    <form
      className="admin-surface integration-card"
      aria-label={provider.title + ' configuration'}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const result = (await post(
            '/admin/integrations/' + provider.id,
            { revision, enabled, fields: values, clearSecrets: cleared, password },
            'PUT',
          )) as IntegrationSettings;
          const updated = result.providers.find((p) => p.id === provider.id)!;
          setSavedFields(updated.fields);
          setValues(Object.fromEntries(updated.fields.map((f) => [f.key, f.value])));
          setCleared([]);
          setNotice(
            'Configuration saved. Complete a real provider sign-in or delivery check before relying on this integration.',
          );
          onSaved();
        } catch (e) {
          setError(msg(e));
        } finally {
          setPassword('');
          setBusy(false);
        }
      }}
    >
      <div className="integration-card-heading">
        <span>
          <Icon size={24} />
        </span>
        <div>
          <h3>{provider.title}</h3>
          <small>
            {provider.configured ? 'Configured / not externally validated' : 'Not connected'}
          </small>
        </div>
      </div>
      <p className="admin-muted">{provider.help}</p>
      <label className="integration-enable">
        <input
          type="checkbox"
          className="form-check-input"
          checked={enabled}
          disabled={busy || !available}
          onChange={(e) => setEnabled(e.target.checked)}
        />{' '}
        {provider.id === 'razorpay'
          ? 'Mark staged Razorpay credentials ready for operator review'
          : 'Enable ' + provider.title.toLowerCase()}
      </label>
      {savedFields
        .filter(
          (field) =>
            provider.id !== 'email' ||
            (field.key.startsWith('SMTP_')
              ? values.EMAIL_PROVIDER !== 'ses'
              : field.key.startsWith('SES_')
                ? values.EMAIL_PROVIDER === 'ses'
                : true),
        )
        .map((field) => (
          <div className="integration-field" key={field.key}>
            <Field label={field.label}>
              {field.options ? (
                <select
                  className="form-select"
                  name={field.key}
                  value={values[field.key] ?? ''}
                  disabled={busy || !available}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option === 'ses' ? 'Amazon SES' : 'SMTP'}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-control"
                  name={field.key}
                  type={field.secret ? 'password' : field.type}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                  maxLength={4096}
                  min={field.type === 'number' ? 1 : undefined}
                  max={field.type === 'number' ? 65535 : undefined}
                  disabled={busy || !available}
                  placeholder={
                    field.secret && field.configured ? 'Saved secret - leave blank to keep' : ''
                  }
                />
              )}
            </Field>
            {field.secret && (
              <div className="integration-secret-state">
                <span>{field.configured ? 'A secret is saved' : 'No saved secret'}</span>
                {field.configured && (
                  <label>
                    <input
                      type="checkbox"
                      checked={cleared.includes(field.key)}
                      disabled={busy || !available}
                      onChange={(e) =>
                        setCleared((current) =>
                          e.target.checked
                            ? [...current, field.key]
                            : current.filter((k) => k !== field.key),
                        )
                      }
                    />{' '}
                    Clear saved secret: {field.label}
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
      <Field label="Confirm admin password">
        <input
          className="form-control"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={busy || !available}
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <button className="btn btn-primary w-100" disabled={busy || !available}>
        {busy ? 'Saving...' : 'Save ' + provider.title.toLowerCase()}
      </button>
      {provider.id === 'razorpay' && (
        <p className="admin-muted">
          Webhook URL: <code>{window.location.origin}/api/webhooks/razorpay</code>. Staged
          credentials do not change checkout mode or Route payouts.
        </p>
      )}
      {(provider.id === 'email' || provider.id === 'whatsapp') && (
        <div className="integration-delivery-test">
          <h4>Test saved configuration</h4>
          <p className="admin-muted">
            Save changes first. A test sends one real message and may incur provider charges.
            Provider acceptance does not prove delivery.
          </p>
          <Field label="Test recipient">
            <input
              className="form-control"
              type={provider.id === 'email' ? 'email' : 'tel'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={provider.id === 'email' ? 'you@example.com' : '+919876543210'}
              disabled={busy || !available}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy || !available}
            />{' '}
            I have permission to send this test to the recipient.
          </label>
          <button
            type="button"
            className="btn btn-outline-primary w-100"
            disabled={busy || !available || !recipient || !consent || !password}
            onClick={async () => {
              setBusy(true);
              setError('');
              setNotice('');
              try {
                const result = await post('/admin/integrations/' + provider.id + '/test', {
                  recipient,
                  consent,
                  password,
                });
                setNotice(result.message);
              } catch (e) {
                setError(msg(e));
              } finally {
                setPassword('');
                setBusy(false);
              }
            }}
          >
            {busy
              ? 'Sending...'
              : provider.id === 'email'
                ? 'Send test email'
                : 'Send test WhatsApp message'}
          </button>
        </div>
      )}
    </form>
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
      className="admin-surface admin-policies admin-page-spacing"
      key={s.updatedAt}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        setNotice('');
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
      <div className="admin-page-heading">
        <span>
          <FileText size={28} />
        </span>
        <div>
          <h2>Marketplace policies</h2>
          <p>Configure commission, booking and payout settings for the expert marketplace.</p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <div className="admin-policy-grid">
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
      <div className="admin-info-panel">
        <CircleHelp size={26} />
        <div>
          <h3>Automatic payouts require additional setup</h3>
          <p>
            Automatic payouts require Route approval, a ready linked account and reconciliation.
            This setting cannot enable live transactions.
          </p>
          <Link to="/guidelines">
            Learn more <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <button className="btn btn-primary w-100 mt-3" disabled={busy}>
        Save policies <Check size={17} />
      </button>
    </form>
  );
}
function AdminPayments() {
  const [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('all'),
    [payout, setPayout] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [applied, setApplied] = useState(''),
    [busy, setBusy] = useState(false);
  const bookings = useData(`/admin/payments?page=${page}${applied ? '&' + applied : ''}`);
  async function run(b: any, kind: string) {
    setError('');
    setNotice('');
    setBusy(true);
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
    } finally {
      setBusy(false);
    }
  }
  const summary = bookings.data?.summary;
  return (
    <div className="admin-page-spacing admin-payments">
      {summary && (
        <section className="expert-review-metrics" aria-label="Payment summary">
          {[
            {
              label: 'Total bookings',
              value: String(summary.totalBookings),
              hint: 'All stored bookings',
              icon: CalendarDays,
              tone: 'blue',
            },
            {
              label: 'Recorded paid payouts',
              value: formatMoney(summary.recordedPaidPaise),
              hint: 'Recorded paid amounts',
              icon: WalletCards,
              tone: 'green',
            },
            {
              label: 'Payouts to reconcile',
              value: String(summary.payoutsToReconcile),
              hint: 'Processing, submitted or unknown',
              icon: Clock,
              tone: 'orange',
            },
            {
              label: 'Recorded paid count',
              value: String(summary.recordedPaidCount),
              hint: 'Not bank settlement certification',
              icon: CircleCheck,
              tone: 'purple',
            },
          ].map(({ label, value, hint, icon: Icon, tone }) => (
            <div className={`expert-review-metric ${tone}`} key={label}>
              <span className="expert-review-metric-icon">
                <Icon size={22} />
              </span>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{hint}</small>
              </div>
            </div>
          ))}
        </section>
      )}
      <form
        className="admin-payment-filters admin-bordered-panel"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(new URLSearchParams({ q, status, payout, from, to }).toString());
        }}
      >
        <label className="admin-search-field">
          <span className="visually-hidden">Search payments</span>
          <Search size={16} />
          <input
            className="form-control"
            placeholder="Booking ID, title, expert or customer"
            value={q}
            maxLength={120}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          From (UTC)
          <input
            className="form-control"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To (UTC)
          <input
            className="form-control"
            type="date"
            min={from || undefined}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Booking status
          <select
            className="form-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {[
              'all',
              'held',
              'pending_confirmation',
              'confirmed',
              'completed',
              'cancelled',
              'expired',
            ].map((v) => (
              <option key={v} value={v}>
                {v.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Payout status
          <select
            className="form-select"
            value={payout}
            onChange={(e) => setPayout(e.target.value)}
          >
            {['all', 'none', 'processing', 'submitted', 'paid', 'unknown', 'failed'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary">
          <SlidersHorizontal size={16} /> Filter
        </button>
      </form>
      <section className="admin-surface">
        <h2>Bookings, reconciliation &amp; payouts</h2>
        <p className="admin-muted">
          Refunds are processed by an operator in Razorpay, then reconciled here. Review ambiguous
          orders and transfers before retrying.
        </p>
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        {bookings.loading ? (
          <Loader />
        ) : bookings.error ? (
          <Alert>{bookings.error}</Alert>
        ) : !bookings.data?.items.length ? (
          <Empty title="No bookings match these filters" />
        ) : (
          <div className="table-responsive admin-data-table admin-payment-table">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Expert</th>
                  <th>Customer</th>
                  <th>Date &amp; time</th>
                  <th>Gross / expert net</th>
                  <th>Payout</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.data.items.map((b: any) => (
                  <tr key={b._id}>
                    <td>
                      <strong>{b.title}</strong>
                      <small>{b._id}</small>
                    </td>
                    <td>{b.expertId?.userId?.name ?? 'Unavailable'}</td>
                    <td>{b.customerId?.name ?? 'Unavailable'}</td>
                    <td>{date(b.startsAt)}</td>
                    <td>
                      {formatMoney(b.grossPaise)}
                      <small>{formatMoney(b.expertPaise)} net</small>
                    </td>
                    <td>
                      {b.payout ? (
                        <>
                          <span className={`badge ${statusColor(b.payout.status)}`}>
                            {b.payout.status}
                          </span>
                          <small>{formatMoney(b.payout.amountPaise)}</small>
                        </>
                      ) : (
                        'Not recorded'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusColor(b.status)}`}>
                        {b.status.replaceAll('_', ' ')}
                      </span>
                      <small>
                        {b.paymentStatus}
                        {b.dispute ? ' / dispute' : ''}
                      </small>
                    </td>
                    <td>
                      <div className="admin-payment-actions">
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          disabled={busy || !b.orderId}
                          onClick={() => run(b, 'reconcile')}
                        >
                          Reconcile
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm"
                          disabled={
                            busy ||
                            !!b.payout ||
                            b.status !== 'completed' ||
                            b.paymentStatus !== 'captured' ||
                            b.dispute
                          }
                          onClick={() => run(b, 'payout')}
                        >
                          Payout
                        </button>
                        {b.status === 'pending_confirmation' && (
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              setError('');
                              try {
                                await post(`/bookings/${b._id}/action`, { action: 'accept' });
                                bookings.reload();
                              } catch (e) {
                                setError(msg(e));
                              } finally {
                                setBusy(false);
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
        )}
        <AdminListCount page={page} total={bookings.data?.total ?? 0} />
        <Pager page={page} setPage={setPage} total={bookings.data?.total ?? 0} />
      </section>
    </div>
  );
}
function Invitations() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [email, setEmail] = useState(''),
    [active, setActive] = useState(true),
    [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const invites = useData(`/admin/invites?page=${page}&q=${encodeURIComponent(q)}`);
  async function save(address: string, allowed: boolean) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await post('/admin/invites', { email: address, active: allowed });
      setNotice('Beta access updated. Share the link separately; no invitation email was sent.');
      invites.reload();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-surface admin-invitations admin-page-spacing">
      <div className="admin-page-heading">
        <span>
          <Mail size={28} />
        </span>
        <div>
          <h2>Control beta access</h2>
          <p>
            Allow specific email addresses to register or sign in. Share the beta link with each
            person separately.
          </p>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <div className="admin-invite-grid">
        <form
          className="admin-bordered-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void save(email, active);
          }}
        >
          <h3>Invite a user</h3>
          <Field label="Email address">
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </Field>
          <label className="admin-check-label">
            <input
              className="form-check-input"
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span>
              Allow beta access
              <small>User can register or sign in using the shared beta link.</small>
            </span>
          </label>
          <button className="btn btn-primary w-100" disabled={busy}>
            <Mail size={16} /> Save access
          </button>
        </form>
        <aside className="admin-info-panel">
          <CircleHelp size={28} />
          <div>
            <h3>How it works</h3>
            <ol>
              <li>Add the email address of the person you want to invite.</li>
              <li>Share the beta link with them separately.</li>
              <li>They register or sign in using that email address.</li>
              <li>Revoke access anytime if needed.</li>
            </ol>
          </div>
        </aside>
      </div>
      <section className="admin-bordered-panel mt-3">
        <div className="admin-table-heading">
          <div>
            <h3>Invited users{invites.data ? ` (${invites.data.total})` : ''}</h3>
            <p className="admin-muted">Manage people who have been given beta access.</p>
          </div>
          <label className="admin-search-field">
            <Search size={17} />
            <input
              className="form-control"
              aria-label="Search invitations"
              placeholder="Search by email..."
              maxLength={120}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>
        {invites.loading ? (
          <Loader />
        ) : invites.error ? (
          <Alert>{invites.error}</Alert>
        ) : !invites.data?.items.length ? (
          <Empty title="No invitations found" />
        ) : (
          <div className="table-responsive admin-data-table">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email address</th>
                  <th>Status</th>
                  <th>Invited on</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.data.items.map((i: any, index: number) => (
                  <tr key={i._id}>
                    <td>{(page - 1) * 24 + index + 1}</td>
                    <td>{i.email}</td>
                    <td>
                      <span className={`badge ${i.active ? 'text-bg-success' : 'text-bg-danger'}`}>
                        {i.active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td>{date(i.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        disabled={busy}
                        onClick={() => void save(i.email, !i.active)}
                        aria-label={`${i.active ? 'Revoke' : 'Restore'} access for ${i.email}`}
                      >
                        {i.active ? 'Revoke' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminListCount page={page} total={invites.data?.total ?? 0} />
        <Pager page={page} setPage={setPage} total={invites.data?.total ?? 0} />
      </section>
    </section>
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
