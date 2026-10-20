import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';

function BrandMark() {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <path
        d="M16 3H7a4 4 0 0 0-4 4v9h5V8h8V3Zm4 0v5h8v8h5V7a4 4 0 0 0-4-4h-9ZM3 20v9a4 4 0 0 0 4 4h9v-5H8v-8H3Zm25 0v8h-8v5h9a4 4 0 0 0 4-4v-9h-5Z"
        fill="currentColor"
      />
      <path d="m18 11 7 7-7 7-7-7 7-7Z" fill="currentColor" />
    </svg>
  );
}
export function SiteHeader({
  user,
  onSignOut,
}: {
  user: { name: string; roles: string[] } | null;
  onSignOut: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  useEffect(() => {
    setMenuOpen(false);
    if (!location.hash) return;
    const timer = window.setTimeout(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.key, location.hash]);
  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      await onSignOut();
    } catch {
      setError('Sign out failed. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <>
      <div className="site-announcement">
        <span>A new perspective is closer than you think.</span>
        <Link to="/#questions">
          Invite-only beta <ArrowUpRight size={13} />
        </Link>
      </div>
      <header
        className="site-header"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setMenuOpen(false);
            document.getElementById('site-menu-toggle')?.focus();
          }
        }}
      >
        <div className="site-header-inner">
          <Link to="/" className="site-brand" aria-label="IndustryConnect home">
            <BrandMark />
            <span>
              industry<span>connect</span>
              <b>.</b>
            </span>
          </Link>
          <nav
            id="site-navigation"
            className={'site-navigation' + (menuOpen ? ' is-open' : '')}
            aria-label="Main navigation"
          >
            <Link to="/#experts">Find an expert</Link>
            <Link to="/#how-it-works">How it works</Link>
            <NavLink to="/studio">
              For experts <ArrowUpRight size={13} />
            </NavLink>
            {user && <NavLink to="/dashboard">My bookings</NavLink>}
            {user?.roles.includes('admin') && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="site-header-actions">
            {user ? (
              <>
                <span className="site-greeting">Hi, {user.name.split(' ')[0]}</span>
                <button
                  className="site-sign-in"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <Link className="site-sign-in" to="/auth">
                Sign in <ArrowUpRight size={15} />
              </Link>
            )}
            <button
              id="site-menu-toggle"
              className="site-menu-toggle"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="site-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {error && (
          <p className="site-signout-error" role="alert">
            {error}
          </p>
        )}
      </header>
    </>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-main">
        <div>
          <Link to="/" className="site-brand" aria-label="IndustryConnect home">
            <BrandMark />
            <span>
              industry<span>connect</span>
              <b>.</b>
            </span>
          </Link>
          <p>
            Good people. Fresh perspectives.
            <br />A meaningful next step.
          </p>
        </div>
        <nav aria-label="Explore links">
          <span>FIND YOUR NEXT STEP</span>
          <Link to="/#experts">Explore experts</Link>
          <Link to="/#how-it-works">How it works</Link>
          <Link to="/#questions">Your questions, answered</Link>
        </nav>
        <nav aria-label="Expert links">
          <span>SHARE WHAT YOU KNOW</span>
          <Link to="/studio">
            Become an expert <ArrowUpRight size={13} />
          </Link>
          <Link to="/dashboard">Your bookings</Link>
          <Link to="/guidelines">Booking guidelines</Link>
        </nav>
        <div className="site-footer-note">
          <span>THE NEXT CHAPTER STARTS WITH</span>
          <p>
            A conversation
            <ArrowUpRight size={26} />
          </p>
          <Link to="/#experts">
            Find yours <ArrowRight size={17} />
          </Link>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} IndustryConnect</span>
        <span>An independent expert marketplace.</span>
        <span>
          <i /> Controlled beta
        </span>
      </div>
    </footer>
  );
}
