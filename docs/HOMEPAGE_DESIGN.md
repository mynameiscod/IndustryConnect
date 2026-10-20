# IndustryConnect homepage

Working brand based on the independent repository name. Final business branding remains an owner decision.

## Design and behavior

Warm ivory, charcoal, coral and sage; large editorial typography; an original mentoring photograph; goal shortcuts; live expert discovery; a three-step booking explanation; expert invitation; accessible native FAQ disclosures; shared navigation and footer. Layout breakpoints cover compact phones, tablets and desktop. The homepage theme is scoped over locally bundled Bootstrap; the Bootstrap authentication and dashboard views remain intact.

Search, category, language, session format, price and page state live in the URL. Requests are abortable on navigation/filter changes. Category chips paginate through the admin taxonomy. Expert cards use API prices, services, experience, languages and genuine stored review aggregates; no invented endorsements or public sample profiles. Loading, empty, failed request and retry states are explicit. Navigation supports keyboard focus, Escape, mobile expansion and route-change closing. Motion respects reduced-motion preferences.

The application still requires its Express API and isolated MongoDB replica set. Sign-in, onboarding, profiles, reservations and dashboards use the existing application routes. Live checkout remains source-locked.

## Review without a database

Run `npm ci`, then `npm run preview:homepage`, and open `.runtime/industryconnect-homepage-preview.html` in a browser. The generator bundles the same homepage and shared navigation components with embedded CSS and imagery. It uses a separate in-memory dataset labeled as fictional, supports local search/filter interactions, and explains when a link requires the full app. It does not authenticate, submit personal data, create bookings or call a payment provider. Demo fixtures are not imported into the production entry point.

For full application testing, use the README local setup and `npm run dev`; open `http://localhost:5173`.

## Validation and remaining review

- Combined with remote commit `fe38161`, preserving Bootstrap UI and ambiguous-order recovery changes.
- Strict TypeScript checks, 40 automated tests in four suites, production build and eight compiled API/worker smoke checks pass.
- The seven jsdom UI tests cover real API result rendering, search/price requests, auth redirects, restored/cleared URL filters, goal shortcuts, mobile navigation state and request errors.
- Standalone preview is also checked for mounting, embedded imagery, fixture search/clear and explicit full-app boundaries in jsdom. This is not layout verification.
- Browser rendering was attempted but blocked: local browser process launch returned EACCES, and the cloud browser could not access the local server. Desktop/mobile visual, keyboard/screen-reader, contrast and provider popup QA remain pending. No screenshot or browser pass is claimed.
- Before beta release: inspect 320, 390, 768, 1024 and 1440 px layouts; exercise keyboard navigation, empty/error/retry states, query history and expert links; verify provider flows in staging. The existing security, payment reconciliation and deployment release gates still apply.

## Image provenance

Asset: `apps/web/public/images/conversation.webp`, 1254 × 1254, 103,666 bytes. Generated with the built-in ImageGen tool, then converted to WebP for delivery. Fictional people are decorative brand imagery, not listed professionals or testimonials. No external image host or font request is required.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: decorative hero photograph for IndustryConnect, an independent professional-expert marketplace. Create a beautiful high-end editorial photograph of a friendly South Asian woman in her thirties with shoulder-length dark hair in a terracotta/coral blouse, and a South Asian man in his late thirties with short dark hair and subtle glasses wearing a dark navy overshirt. They are seated on opposite sides of a small light oak desk in a sunlit modern studio, having a warm focused one-to-one mentoring conversation. Candid, natural facial expressions, realistic skin texture, subtle smiles, eye contact with each other rather than camera, a single notebook and a closed laptop on the desk. Composition: square image, medium-wide scene with both people clearly visible from waist up, generous space above heads, good separation of silhouettes, clean warm ivory wall, soft shadow of a plant on the background. Contemporary magazine photography, calm and approachable, believable natural daylight, tasteful editorial color grading, muted warm colors, subtle film grain, exquisite photographic quality. No text, no logos, no branding, no fake app UI, no badge, no busy office, no stock-photo handshake. Fictional people only; used as decorative brand imagery, not as actual expert profiles.
