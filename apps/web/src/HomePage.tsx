import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Compass,
  Globe,
  Lightbulb,
  MapPin,
  MessageCircle,
  Palette,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Video,
  X,
} from 'lucide-react';
import { formatMoney } from '@market/contracts';
import { api } from './api.js';

type Category = { _id: string; name: string };
type Expert = {
  id: string;
  slug: string;
  name: string;
  headline: string;
  city?: string;
  experienceYears?: number;
  languages?: string[];
  reviewCount: number;
  rating: number | null;
  services: {
    id: string;
    title?: string;
    pricePaise: number;
    mode: string;
    durationMinutes?: number;
  }[];
};
type Page<T> = { items: T[]; total: number };
function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(reason instanceof Error ? reason.message : 'Please try again in a moment.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, loading, error, retry: () => setVersion((current) => current + 1) };
}

const goals = [
  {
    icon: BriefcaseBusiness,
    title: 'Find your next chapter',
    text: 'Career direction & leadership',
    query: 'career',
    color: 'peach',
  },
  {
    icon: Code2,
    title: 'Build something better',
    text: 'Technology & engineering',
    query: 'system design',
    color: 'sage',
  },
  {
    icon: Lightbulb,
    title: 'Bring your idea to life',
    text: 'Business & entrepreneurship',
    query: 'business',
    color: 'lilac',
  },
  {
    icon: Palette,
    title: 'Make your work stand out',
    text: 'Design & creative thinking',
    query: 'portfolio',
    color: 'sand',
  },
];

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').slice(0, 100);
  const category = params.get('category') ?? '';
  const mode = params.get('mode') ?? '';
  const language = params.get('language') ?? '';
  const price = params.get('price') ?? '';
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const [search, setSearch] = useState(query);
  const [categoryPage, setCategoryPage] = useState(1);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => setSearch(query), [query]);
  const categories = useResource<Page<Category>>('/categories?limit=12&page=' + categoryPage);
  const config = useResource<{ checkoutEnabled: boolean; betaAccess: string }>('/config');
  const apiParams = new URLSearchParams({
    page: String(page),
    ...(query ? { q: query } : {}),
    ...(category ? { category } : {}),
    ...(mode ? { mode } : {}),
    ...(language ? { language } : {}),
    ...(price ? { maxPrice: String(Number(price) * 100) } : {}),
  });
  const experts = useResource<Page<Expert>>('/experts?' + apiParams.toString());
  const hasFilters = Boolean(query || category || mode || language || price);
  const resultCount = experts.data?.total ?? 0;

  function updateFilter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      return next;
    });
  }
  function showResults() {
    resultsHeading.current?.focus({ preventScroll: true });
    document.getElementById('experts')?.scrollIntoView?.({ block: 'start' });
  }
  function searchFor(value: string) {
    const clean = value.trim().slice(0, 100);
    setSearch(clean);
    updateFilter('q', clean);
    showResults();
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    searchFor(search);
  }
  function resetFilters() {
    setSearch('');
    setParams(new URLSearchParams());
  }
  function changePage(nextPage: number) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage > 1) next.set('page', String(nextPage));
      else next.delete('page');
      return next;
    });
    showResults();
  }

  return (
    <div className="market-home">
      <section className="hc-hero hc-container" aria-labelledby="hero-title">
        <div className="hc-hero-copy">
          <div className="hc-kicker">
            <span /> A LITTLE PERSPECTIVE. A BIG NEXT STEP.
          </div>
          <h1 id="hero-title">
            Big ambitions.
            <br />
            Better
            <br />
            <em>conversations.</em>
          </h1>
          <p className="hc-hero-description">
            You don’t have to figure it all out alone. Find an expert who’s been there, and make
            your next move with clarity.
          </p>
          <form className="hc-search" role="search" onSubmit={submitSearch}>
            <Search size={21} aria-hidden="true" />
            <input
              aria-label="Search experts"
              placeholder="What’s on your mind?"
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              enterKeyHint="search"
              autoComplete="off"
            />
            <button type="submit">
              Find an expert <ArrowUpRight size={19} aria-hidden="true" />
            </button>
          </form>
          <div className="hc-suggestions">
            <span>A place to start:</span>
            {[
              ['Career direction', 'career'],
              ['System design', 'system design'],
              ['Starting up', 'business'],
            ].map(([label, value]) => (
              <button key={value} onClick={() => searchFor(value)}>
                {label}
                <ArrowUpRight size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="hc-hero-footnote">
            <span>
              <Check size={14} /> One-to-one, just for you
            </span>
            <span>
              <Check size={14} /> Online or in person
            </span>
          </div>
        </div>
        <div className="hc-hero-visual">
          <span className="hc-doodle hc-doodle-top" aria-hidden="true">
            ✳
          </span>
          <figure className="hc-hero-photo">
            <img
              src="/images/conversation.webp"
              width="1254"
              height="1254"
              alt="An illustrative mentoring conversation in a warm, sunlit studio"
              fetchPriority="high"
              decoding="async"
            />
            <figcaption>
              <span className="hc-photo-dot" /> Different journeys. A shared way forward.
            </figcaption>
          </figure>
          <div className="hc-perspective-stamp" aria-hidden="true">
            <ArrowUpRight size={28} />
            <span>
              FRESH
              <br />
              PERSPECTIVES
            </span>
          </div>
          <div className="hc-conversation-note">
            <span className="hc-note-icon">
              <MessageCircle size={24} aria-hidden="true" />
            </span>
            <div>
              <small>THE POWER OF HUMAN CONNECTION</small>
              <p>
                One conversation.
                <br />
                <strong>A whole new possibility.</strong>
              </p>
            </div>
          </div>
          <span className="hc-photo-number" aria-hidden="true">
            01 — MADE FOR WHAT’S NEXT
          </span>
        </div>
      </section>

      <section className="hc-promise-bar hc-container" aria-label="A more personal way to connect">
        <div>
          <ShieldCheck />
          <p>
            <strong>Know who you’re meeting</strong>
            <span>Reviewed profiles. Visible experience.</span>
          </p>
        </div>
        <div>
          <MessageCircle />
          <p>
            <strong>Space for your questions</strong>
            <span>Focused sessions around your goals.</span>
          </p>
        </div>
        <div>
          <CalendarDays />
          <p>
            <strong>Make it work for you</strong>
            <span>Clear pricing, formats, and availability.</span>
          </p>
        </div>
      </section>

      <section className="hc-goals hc-container" aria-labelledby="goals-title">
        <div className="hc-section-heading">
          <div>
            <span className="hc-kicker">THERE’S A CONVERSATION FOR THAT</span>
            <h2 id="goals-title">
              What’s your <em>next move?</em>
            </h2>
          </div>
          <a href="#experts" className="hc-text-link">
            Explore all expertise <ArrowDown size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="hc-goal-grid">
          {goals.map(({ icon: Icon, title, text, query: keyword, color }) => (
            <button
              className={'hc-goal hc-tone-' + color}
              key={keyword}
              onClick={() => searchFor(keyword)}
            >
              <span className="hc-goal-top">
                <Icon size={26} strokeWidth={1.5} />
                <ArrowUpRight size={19} />
              </span>
              <strong>{title}</strong>
              <span>{text}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="experts" className="hc-experts hc-container" aria-labelledby="experts-title">
        <div className="hc-section-heading">
          <div>
            <span className="hc-kicker">GOOD PEOPLE. REAL PERSPECTIVE.</span>
            <h2 id="experts-title" ref={resultsHeading} tabIndex={-1}>
              Find your kind of <em>expert.</em>
            </h2>
          </div>
          <p>
            A fresh pair of eyes.
            <br />A meaningful next step.
          </p>
        </div>
        <div className="hc-categories" aria-label="Expertise categories">
          <button
            className={'hc-category' + (!category ? ' is-active' : '')}
            aria-pressed={!category}
            onClick={() => updateFilter('category', '')}
          >
            <Compass size={15} aria-hidden="true" /> All expertise
          </button>
          {categories.data?.items.map((item) => (
            <button
              key={item._id}
              className={'hc-category' + (category === item._id ? ' is-active' : '')}
              aria-pressed={category === item._id}
              onClick={() => updateFilter('category', item._id)}
            >
              {item.name}
            </button>
          ))}
          {(categories.data?.total ?? 0) > 12 && (
            <button
              className="hc-category hc-more-categories"
              onClick={() =>
                setCategoryPage((current) =>
                  current * 12 >= (categories.data?.total ?? 0) ? 1 : current + 1,
                )
              }
            >
              More categories <ChevronRight size={15} />
            </button>
          )}
        </div>
        {categories.error && (
          <p className="hc-category-error">
            Categories couldn’t load. <button onClick={categories.retry}>Try again</button>
          </p>
        )}
        <div className="hc-filter-bar">
          <div className="hc-filters">
            <span className="hc-filter-label">
              <SlidersHorizontal size={16} aria-hidden="true" /> Refine by
            </span>
            <select
              aria-label="Session format"
              value={mode}
              onChange={(event) => updateFilter('mode', event.target.value)}
            >
              <option value="">Any format</option>
              <option value="online">Online</option>
              <option value="in_person">In person</option>
            </select>
            <select
              aria-label="Language"
              value={language}
              onChange={(event) => updateFilter('language', event.target.value)}
            >
              <option value="">Any language</option>
              <option>English</option>
              <option>Telugu</option>
              <option>Hindi</option>
            </select>
            <select
              aria-label="Maximum price"
              value={price}
              onChange={(event) => updateFilter('price', event.target.value)}
            >
              <option value="">Any price</option>
              <option value="1000">Up to ₹1,000</option>
              <option value="2500">Up to ₹2,500</option>
              <option value="5000">Up to ₹5,000</option>
            </select>
          </div>
          <div className="hc-result-meta">
            {hasFilters && (
              <button className="hc-clear" onClick={resetFilters}>
                Clear filters <X size={13} />
              </button>
            )}
            <span role="status" aria-live="polite">
              {experts.loading
                ? 'Finding your experts…'
                : experts.error
                  ? 'Please try again'
                  : resultCount + (resultCount === 1 ? ' expert' : ' experts')}
            </span>
          </div>
        </div>
        {query && (
          <p className="hc-search-summary">
            Showing matches for <strong>“{query}”</strong>
          </p>
        )}
        <div className="hc-results" aria-busy={experts.loading}>
          {experts.loading ? (
            <div className="hc-expert-grid hc-skeleton-grid" aria-hidden="true">
              {[0, 1, 2, 3].map((item) => (
                <div className="hc-skeleton" key={item}>
                  <div />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : experts.error ? (
            <div className="hc-empty hc-error" role="alert">
              <Compass size={32} />
              <h3>We couldn’t load the experts.</h3>
              <p>{experts.error}</p>
              <button className="hc-button" onClick={experts.retry}>
                Try again <ArrowRight size={16} />
              </button>
            </div>
          ) : experts.data?.items.length ? (
            <div className="hc-expert-grid">
              {experts.data.items.map((expert, index) => (
                <HomeExpertCard key={expert.id} expert={expert} index={index} />
              ))}
            </div>
          ) : (
            <div className="hc-empty">
              <Search size={32} />
              <h3>
                {hasFilters
                  ? 'Let’s find another way forward.'
                  : 'Good connections are on their way.'}
              </h3>
              <p>
                {hasFilters
                  ? 'Try a different search or clear your filters to explore all available experts.'
                  : 'Reviewed experts will appear here as they join the controlled beta.'}
              </p>
              {hasFilters ? (
                <button className="hc-button" onClick={resetFilters}>
                  Explore all experts <ArrowRight size={16} />
                </button>
              ) : (
                <Link className="hc-button" to="/studio">
                  Share your expertise <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
          )}
        </div>
        {resultCount > 24 && !experts.loading && !experts.error && (
          <nav className="hc-pagination" aria-label="Expert results pages">
            <button disabled={page === 1} onClick={() => changePage(page - 1)}>
              <ChevronLeft size={16} /> Previous
            </button>
            <span>
              Page {page} of {Math.ceil(resultCount / 24)}
            </span>
            <button disabled={page * 24 >= resultCount} onClick={() => changePage(page + 1)}>
              Next <ChevronRight size={16} />
            </button>
          </nav>
        )}
        <div className="hc-listing-note">
          <ShieldCheck size={16} />
          <span>
            Profiles are reviewed before listing. Reviews come from completed, paid bookings.
          </span>
          <Link to="/guidelines">
            Our approach <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="hc-how" aria-labelledby="how-title">
        <div className="hc-container hc-how-inner">
          <div className="hc-how-intro">
            <span className="hc-kicker">SMALL STEP. NEW POSSIBILITIES.</span>
            <h2 id="how-title">
              Less overthinking.
              <br />
              <em>
                More moving
                <br />
                forward.
              </em>
            </h2>
            <p>
              From “where do I start?” to a conversation
              <br className="hc-desktop-break" /> that helps you see what’s next.
            </p>
            <Link className="hc-light-link" to="/guidelines">
              How booking works <ArrowUpRight size={18} />
            </Link>
            <span className="hc-how-spark" aria-hidden="true">
              ✳
            </span>
          </div>
          <div className="hc-steps">
            {[
              {
                icon: Search,
                title: 'Find someone who gets it.',
                text: 'Explore experience, services, and verified reviews. Choose the person who fits your goals.',
              },
              {
                icon: CalendarDays,
                title: 'Make a little time.',
                text: 'Pick a service and available slot. Review the price and confirmation policy before you book.',
              },
              {
                icon: MessageCircle,
                title: 'Have a real conversation.',
                text: 'Bring your questions to a focused one-to-one session. Leave with a fresh perspective on your next step.',
              },
            ].map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="hc-step">
                <span className="hc-step-number">{'0' + (index + 1)}</span>
                <div>
                  <Icon size={23} strokeWidth={1.5} />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hc-expert-invite hc-container" aria-labelledby="expert-invite-title">
        <div className="hc-invite-content">
          <span className="hc-kicker">YOU’VE BEEN THERE. HELP SOMEONE GET THERE.</span>
          <h2 id="expert-invite-title">
            Your experience.
            <br />
            Someone else’s <em>turning point.</em>
          </h2>
          <p>
            Turn what you know into a meaningful conversation. Create your profile, set your
            services, and make room for the people you can help.
          </p>
          <Link className="hc-button" to="/studio">
            Become an expert <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="hc-invite-art" aria-hidden="true">
          <div className="hc-invite-orbit" />
          <span className="hc-invite-asterisk">✳</span>
          <div className="hc-invite-card">
            <span>KNOWLEDGE WORTH SHARING</span>
            <MessageCircle size={45} strokeWidth={1} />
            <p>
              Good advice
              <br />
              has a way of
              <br />
              <em>going places.</em>
            </p>
            <ArrowUpRight size={32} />
          </div>
          <span className="hc-invite-small">YOUR TIME. YOUR EXPERTISE.</span>
        </div>
      </section>

      <section id="questions" className="hc-faq hc-container" aria-labelledby="faq-title">
        <div>
          <span className="hc-kicker">A LITTLE MORE CLARITY</span>
          <h2 id="faq-title">
            Good questions.
            <br />
            <em>Clear answers.</em>
          </h2>
          <p>
            Here’s what to know before
            <br className="hc-desktop-break" /> your first conversation.
          </p>
          <Link className="hc-text-link" to="/guidelines">
            Read the booking guidelines <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hc-faq-items">
          {[
            [
              'Who can I connect with?',
              'Professionals across the categories available in our marketplace. Browse their experience, services, languages, and prices to find someone who fits the question you want to explore.',
            ],
            [
              'How are experts and reviews verified?',
              'An admin reviews expert profiles before they are published. A customer can review only their own paid, completed booking. Always read the profile and service details to decide whether the expert is right for you.',
            ],
            [
              'Can I meet online or in person?',
              'Both formats are supported. Each service shows its format before you reserve. Online bookings use a meeting link; in-person services show their meeting location. Availability depends on the expert and service.',
            ],
            [
              'How can I try the beta?',
              config.data?.betaAccess === 'open'
                ? 'Create an account to explore the marketplace. Check the booking guidelines and current payment availability before reserving a session.'
                : 'The controlled beta is invitation-only. Invited customers and experts can sign in to explore the platform. More experts and services will become available as the beta grows.',
            ],
            [
              'What happens when I reserve a session?',
              config.data?.checkoutEnabled !== true
                ? 'Payments are not currently available. You can explore services and try a reservation, which holds a slot for 10 minutes before it expires. A reservation alone does not confirm a paid session.'
                : 'A reservation holds a slot for 10 minutes. Complete payment within that time, then follow the confirmation policy shown for the service. Your dashboard shows the latest booking status.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">
                  <span />
                </span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function HomeExpertCard({ expert, index }: { expert: Expert; index: number }) {
  const services = expert.services ?? [];
  const lowest = services.length
    ? Math.min(...services.map((service) => service.pricePaise))
    : null;
  const initials = expert.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');
  const hasRating = expert.reviewCount > 0 && typeof expert.rating === 'number';
  return (
    <article className={'hc-expert-card hc-card-tone-' + (index % 4)}>
      <div className="hc-card-cover">
        <span className="hc-card-shape" aria-hidden="true" />
        <span className="hc-card-initials" aria-hidden="true">
          {initials}
        </span>
        <span className="hc-reviewed">
          <ShieldCheck size={13} aria-hidden="true" /> Profile reviewed
        </span>
        <span className="hc-card-experience">
          {expert.experienceYears
            ? expert.experienceYears + '+ years of experience'
            : 'A fresh perspective'}
        </span>
        <span className="hc-card-spark" aria-hidden="true">
          {['✳', '↗', '✦', '◈'][index % 4]}
        </span>
      </div>
      <div className="hc-card-content">
        <div className="hc-card-name">
          <h3>
            <Link to={'/experts/' + expert.slug}>{expert.name}</Link>
          </h3>
          {hasRating ? (
            <span className="hc-card-rating">
              <Star size={13} />
              {expert.rating!.toFixed(1)}
              <span>({expert.reviewCount})</span>
            </span>
          ) : (
            <span className="hc-new">New expert</span>
          )}
        </div>
        <p className="hc-card-headline">{expert.headline}</p>
        <div className="hc-card-meta">
          <span>
            <MapPin size={13} />
            {expert.city || 'Location on profile'}
          </span>
          <span>
            {services.some((service) => service.mode === 'online') ? (
              <>
                <Video size={13} /> Online
              </>
            ) : (
              <>
                <Globe size={13} /> In person
              </>
            )}
          </span>
        </div>
        <div className="hc-card-languages">
          {expert.languages?.slice(0, 3).map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="hc-card-bottom">
          <div>
            <span>Sessions from</span>
            <strong>{lowest === null ? 'View services' : formatMoney(lowest)}</strong>
          </div>
          <Link to={'/experts/' + expert.slug} aria-label={'View ' + expert.name + ' profile'}>
            View profile <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
