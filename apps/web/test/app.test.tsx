// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';
const expert = {
  id: 'expert1',
  slug: 'demo-expert',
  name: 'Demo Expert',
  headline: 'Thoughtful career conversations',
  city: 'Hyderabad',
  experienceYears: 10,
  languages: ['English'],
  reviewCount: 0,
  rating: null,
  services: [{ id: 's1', mode: 'online', pricePaise: 150000 }],
};
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      let status = 200,
        data: any = {};
      if (path === '/api/me') {
        status = 401;
        data = { error: { message: 'Please sign in' } };
      } else if (path.startsWith('/api/categories')) data = { items: [], total: 0 };
      else if (path.startsWith('/api/experts?')) data = { items: [expert], total: 1 };
      else if (path === '/api/config')
        data = { betaAccess: 'invite', googleClientId: '', checkoutEnabled: false };
      return { ok: status < 400, status, json: async () => data } as Response;
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('customer UI', () => {
  it('shows stored verified stories without inventing customer identities', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path.startsWith('/api/experts?'))
        return {
          ok: true,
          json: async () => ({ items: [{ ...expert, reviewCount: 1, rating: 5 }], total: 1 }),
        } as Response;
      if (path === '/api/experts/demo-expert')
        return {
          ok: true,
          json: async () => ({
            name: expert.name,
            reviews: [
              { _id: 'r1', rating: 5, text: 'Practical feedback from my completed session.' },
            ],
          }),
        } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Practical feedback from my completed session/)).toBeTruthy();
    expect(screen.getByText('Verified customer')).toBeTruthy();
    expect(screen.queryByText('Karthik N.')).toBeNull();
  });
  it('takes the footer email to sign-in without claiming a newsletter subscription', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    fireEvent.change(screen.getByLabelText('Your email address'), {
      target: { value: 'local@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe(
      'local@example.invalid',
    );
  });
  it('opens mobile navigation and closes it after following a link', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('link', { name: 'Explore experts' }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
  it('shows API-backed experts without fabricated ratings', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Demo Expert')).toBeTruthy();
    expect(screen.getByText('New expert')).toBeTruthy();
    expect(screen.getByText(/₹1,500(?:\.00)?/)).toBeTruthy();
    expect(screen.queryByText('4.9')).toBeNull();
  });
  it('submits search and price filters to the API', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    fireEvent.change(screen.getByLabelText('Search experts'), { target: { value: 'design' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find an expert' }));
    await waitFor(() =>
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('q=design'))).toBe(
        true,
      ),
    );
    fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '2500' } });
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('maxPrice=250000')),
      ).toBe(true),
    );
  });
  it('routes unauthenticated dashboards to sign-in', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(await screen.findByText('Our controlled beta is invitation-only.')).toBeTruthy();
  });
  it('surfaces API errors without showing fake sample profiles', async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        ({
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Marketplace is temporarily unavailable' } }),
        }) as Response,
    );
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    for (const alert of alerts)
      expect(alert.textContent).toContain('Marketplace is temporarily unavailable');
    expect(screen.queryByText('Demo Expert')).toBeNull();
  });
});

describe('expert studio', () => {
  const storedProfile = {
    slug: 'demo-expert',
    headline: 'Thoughtful career conversations',
    bio: 'Practical career guidance based on ten years of professional experience.',
    city: 'Hyderabad',
    languages: ['English', 'Telugu'],
    timezone: 'Asia/Kolkata',
    experienceYears: 10,
    confirmationPolicy: 'manual',
    categories: ['cat1'],
    verification: 'approved',
    updatedAt: '2026-10-20T00:00:00.000Z',
  };
  function mockStudio(failSave = false) {
    let profile = { ...storedProfile };
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let data: unknown = {},
        status = 200;
      if (path === '/api/me')
        data = {
          id: 'u1',
          name: 'Demo Expert',
          roles: ['customer', 'expert'],
          emailVerified: true,
        };
      else if (path === '/api/expert/profile') {
        if (init?.method === 'PUT') {
          if (failSave) {
            status = 400;
            data = { error: { message: 'Select active categories' } };
          } else {
            profile = {
              ...profile,
              ...JSON.parse(String(init.body)),
              verification: 'pending',
              updatedAt: '2026-10-20T01:00:00.000Z',
            };
            data = profile;
          }
        } else data = profile;
      } else if (path.startsWith('/api/categories'))
        data = { items: [{ _id: 'cat1', name: 'Career & Leadership' }], total: 1 };
      else if (path === '/api/expert/services') data = { items: [] };
      return { ok: status < 400, status, json: async () => data } as Response;
    });
  }
  function renderStudio() {
    return render(
      <MemoryRouter initialEntries={['/studio']}>
        <App />
      </MemoryRouter>,
    );
  }
  it('shows readiness from stored services and availability and links the approved public profile', async () => {
    mockStudio();
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      String(url) === '/api/expert/onboarding'
        ? ({
            ok: true,
            json: async () => ({
              activeServices: 1,
              openSlots: 2,
              listed: true,
              acceptingReservations: true,
              publicPath: '/experts/demo-expert',
            }),
          } as Response)
        : fallback(url, init),
    );
    renderStudio();
    const checklist = await screen.findByRole('region', { name: 'Expert onboarding progress' });
    expect(
      await within(checklist).findByText(/Your profile is listed with available times/),
    ).toBeTruthy();
    expect(within(checklist).getAllByText('Complete')).toHaveLength(5);
    expect(
      within(checklist).getByRole('link', { name: 'View public profile' }).getAttribute('href'),
    ).toBe('/experts/demo-expert');
  });
  it('returns a new expert to Studio after sign-in instead of losing the onboarding destination', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let signedIn = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path === '/api/auth/login') {
        signedIn = true;
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (path === '/api/me' && signedIn)
        return {
          ok: true,
          json: async () => ({
            id: 'new',
            name: 'New Expert',
            emailVerified: true,
            roles: ['customer'],
          }),
        } as Response;
      if (path === '/api/expert/profile') return { ok: true, json: async () => null } as Response;
      return fallback(url, init);
    });
    renderStudio();
    await screen.findByRole('heading', { name: 'Welcome back' });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'expert@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'long-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    expect(await screen.findByRole('form', { name: 'Public profile form' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Expert onboarding progress' })).toBeTruthy();
  });
  it('updates the draft preview and preserves edits across tabs without autosaving', async () => {
    mockStudio();
    renderStudio();
    const headline = await screen.findByRole('textbox', { name: 'Headline', exact: true });
    fireEvent.change(headline, { target: { value: 'Updated career strategy headline' } });
    const preview = screen.getByLabelText('Live profile preview');
    expect(preview.textContent).toContain('Updated career strategy headline');
    fireEvent.click(screen.getByRole('button', { name: 'Services', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Your Services' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Profile', exact: true }));
    expect(
      (screen.getByRole('textbox', { name: 'Headline', exact: true }) as HTMLInputElement).value,
    ).toBe('Updated career strategy headline');
    fireEvent.click(screen.getByRole('button', { name: 'View full preview' }));
    expect(
      screen.getByRole('button', { name: 'Close full preview' }).getAttribute('aria-expanded'),
    ).toBe('true');
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(
      0,
    );
  });
  it('links a phone-account email and returns to the application without changing accounts', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let verified = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path === '/api/me')
        return {
          ok: true,
          json: async () => ({
            id: 'phone-owner',
            name: 'Phone Expert',
            emailVerified: verified,
            roles: ['customer'],
          }),
        } as Response;
      if (path === '/api/expert/profile') return { ok: true, json: async () => null } as Response;
      if (path === '/api/me/email/request') return { ok: true, json: async () => ({}) } as Response;
      if (path === '/api/me/email/verify') {
        verified = true;
        return { ok: true, json: async () => ({}) } as Response;
      }
      return fallback(url, init);
    });
    renderStudio();
    await screen.findByRole('form', { name: 'Public profile form' });
    expect(
      (
        screen.getByRole('button', { name: 'Submit for verification' }) as HTMLButtonElement
      ).closest('fieldset')?.disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Verify or add your email' }));
    await screen.findByRole('heading', { name: 'Verify your email' });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'phone-expert@example.invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/me/email/request'),
      ).toBe(true),
    );
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email', exact: true }));
    await screen.findByRole('form', { name: 'Public profile form' });
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/me/email/verify'),
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', { name: 'Submit for verification' }) as HTMLButtonElement
      ).closest('fieldset')?.disabled,
    ).toBe(false);
  });
  it('submits the existing profile contract and reports pending admin review', async () => {
    mockStudio();
    renderStudio();
    fireEvent.change(await screen.findByRole('textbox', { name: 'City', exact: true }), {
      target: { value: 'Bengaluru' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Public profile form' }));
    expect(await screen.findByText('Profile submitted for admin review.')).toBeTruthy();
    const put = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/expert/profile' && init?.method === 'PUT',
      );
    expect(put).toBeTruthy();
    expect(JSON.parse(String(put![1]!.body))).toEqual({
      slug: storedProfile.slug,
      headline: storedProfile.headline,
      bio: storedProfile.bio,
      city: 'Bengaluru',
      languages: ['English', 'Telugu'],
      timezone: 'Asia/Kolkata',
      experienceYears: 10,
      categories: ['cat1'],
      confirmationPolicy: 'manual',
    });
    expect(
      await screen.findByText('pending', { selector: '.verification-callout .badge' }),
    ).toBeTruthy();
  });
  it('keeps the draft editable after a rejected submission', async () => {
    mockStudio(true);
    renderStudio();
    fireEvent.change(await screen.findByRole('textbox', { name: 'Headline', exact: true }), {
      target: { value: 'A headline kept after a failed save' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Public profile form' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Select active categories',
    );
    expect(
      (screen.getByRole('textbox', { name: 'Headline', exact: true }) as HTMLInputElement).value,
    ).toBe('A headline kept after a failed save');
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /Submit for verification/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
  });
});

describe('expert service workspace', () => {
  const service = {
    _id: 's1',
    title: 'Product career clarity',
    description: 'Get clarity on product roles, skills and a roadmap for your next career move.',
    categoryId: 'cat1',
    durationMinutes: 45,
    pricePaise: 149900,
    mode: 'online',
    location: '',
    active: true,
  };
  function mockServices(failSave = false) {
    let rows = [{ ...service }];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let data: unknown = {},
        status = 200;
      if (path === '/api/me')
        data = {
          id: 'u1',
          name: 'Demo Expert',
          roles: ['customer', 'expert'],
          emailVerified: true,
        };
      else if (path === '/api/expert/profile')
        data = {
          slug: 'demo-expert',
          headline: 'Thoughtful career conversations',
          bio: 'Practical career guidance from professional experience.',
          city: 'Hyderabad',
          languages: ['English'],
          timezone: 'Asia/Kolkata',
          experienceYears: 8,
          confirmationPolicy: 'manual',
          categories: ['cat1'],
          verification: 'pending',
          updatedAt: '2026-10-20T00:00:00Z',
        };
      else if (path.startsWith('/api/categories'))
        data = { items: [{ _id: 'cat1', name: 'Career & Leadership' }], total: 1 };
      else if (path === '/api/expert/services' && init?.method !== 'POST') data = { items: rows };
      else if (
        path.startsWith('/api/expert/services') &&
        (init?.method === 'POST' || init?.method === 'PUT')
      ) {
        if (failSave) {
          status = 409;
          data = { error: { message: 'Close future slots before changing duration' } };
        } else {
          const body = JSON.parse(String(init.body));
          const record = { ...body, _id: init.method === 'POST' ? 's2' : 's1' };
          rows =
            init.method === 'POST'
              ? [record, ...rows]
              : rows.map((row) => (row._id === record._id ? record : row));
          data = record;
        }
      }
      return { ok: status < 400, status, json: async () => data } as Response;
    });
  }
  async function openServices(failSave = false) {
    mockServices(failSave);
    render(
      <MemoryRouter initialEntries={['/studio']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('textbox', { name: 'Headline', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Services', exact: true }));
    await screen.findByRole('button', { name: 'Edit Product career clarity' });
  }
  function fillNewService(price = '499.99') {
    fireEvent.change(screen.getByRole('textbox', { name: 'Service title', exact: true }), {
      target: { value: 'Career clarity test session' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Category', exact: true }), {
      target: { value: 'cat1' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'What will the customer get?', exact: true }),
      { target: { value: 'A focused conversation with practical steps for your career goals.' } },
    );
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Total price (INR)', exact: true }), {
      target: { value: price },
    });
  }
  it('creates a service using exact integer paise while preserving pending-profile restrictions', async () => {
    await openServices();
    expect(screen.getByRole('heading', { name: 'Profile under review' })).toBeTruthy();
    fillNewService();
    fireEvent.submit(screen.getByRole('form', { name: 'Service editor' }));
    expect(await screen.findByText(/Service saved\. It is discoverable only/)).toBeTruthy();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/expert/services' && init?.method === 'POST',
      );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      title: 'Career clarity test session',
      description: 'A focused conversation with practical steps for your career goals.',
      categoryId: 'cat1',
      durationMinutes: 45,
      pricePaise: 49999,
      mode: 'online',
      location: '',
      active: true,
    });
    expect(
      await screen.findByRole('button', { name: 'Edit Career clarity test session' }),
    ).toBeTruthy();
  });
  it('loads an existing service for editing and resets the form for Add New Service', async () => {
    await openServices();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Product career clarity' }));
    expect(
      (screen.getByRole('spinbutton', { name: 'Total price (INR)' }) as HTMLInputElement).value,
    ).toBe('1499.00');
    fireEvent.change(screen.getByRole('textbox', { name: 'Service title' }), {
      target: { value: 'Updated product career session' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Service editor' }));
    expect(
      await screen.findByRole('button', { name: 'Edit Updated product career session' }),
    ).toBeTruthy();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/expert/services/s1' && init?.method === 'PUT',
      );
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      title: 'Updated product career session',
      pricePaise: 149900,
      active: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Edit Updated product career session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add New Service' }));
    expect((screen.getByRole('textbox', { name: 'Service title' }) as HTMLInputElement).value).toBe(
      '',
    );
    expect(screen.getByRole('heading', { name: 'Create a service' })).toBeTruthy();
  });
  it('archives and republishes through the existing update endpoint', async () => {
    await openServices();
    fireEvent.click(screen.getByLabelText('Actions for Product career clarity'));
    fireEvent.click(screen.getByRole('button', { name: 'Archive service' }));
    expect(
      await screen.findByText('Archived', { selector: '.service-publish-badge' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Actions for Product career clarity'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish service' }));
    expect(
      await screen.findByText('Published', { selector: '.service-publish-badge' }),
    ).toBeTruthy();
    const mutations = vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, init]) => String(url) === '/api/expert/services/s1' && init?.method === 'PUT',
      );
    expect(mutations.map(([, init]) => JSON.parse(String(init?.body)).active)).toEqual([
      false,
      true,
    ]);
  });
  it('keeps edits after the server refuses a duration change', async () => {
    await openServices(true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Product career clarity' }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration (minutes)' }), {
      target: { value: '60' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Service editor' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Close future slots before changing duration',
    );
    expect(
      (screen.getByRole('spinbutton', { name: 'Duration (minutes)' }) as HTMLInputElement).value,
    ).toBe('60');
    expect(screen.queryByText(/Service saved\./)).toBeNull();
  });
  it('requires a location for in-person sessions and rejects sub-paise pricing', async () => {
    await openServices();
    const location = screen.getByRole('textbox', {
      name: 'Location (required for in-person sessions)',
    }) as HTMLInputElement;
    expect(location.required).toBe(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Session format' }), {
      target: { value: 'in_person' },
    });
    expect(location.required).toBe(true);
    fillNewService('499.999');
    fireEvent.submit(screen.getByRole('form', { name: 'Service editor' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Enter a price in INR with no more than two decimal places.',
    );
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(
      0,
    );
  });
});

describe('expert availability workspace', () => {
  const start = new Date(Math.ceil((Date.now() + 86400000) / 900000) * 900000);
  const service = {
    _id: 's1',
    title: 'Career Clarity Session',
    description: 'A focused career conversation with practical next steps.',
    categoryId: 'cat1',
    durationMinutes: 45,
    pricePaise: 149900,
    mode: 'online',
    active: true,
  };
  function local(value: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      day: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
      time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
    };
  }
  async function openAvailability(failEdit = false) {
    let rows = [
      {
        _id: 'slot1',
        serviceId: 's1',
        startsAt: start.toISOString(),
        endsAt: new Date(+start + 2700000).toISOString(),
        status: 'open',
      },
      {
        _id: 'slot2',
        serviceId: 's1',
        startsAt: new Date(+start + 7200000).toISOString(),
        endsAt: new Date(+start + 9900000).toISOString(),
        status: 'held',
      },
    ];
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let status = 200,
        data: unknown = {};
      if (path === '/api/me')
        data = {
          id: 'u1',
          name: 'Demo Expert',
          roles: ['customer', 'expert'],
          emailVerified: true,
        };
      else if (path === '/api/expert/profile')
        data = {
          slug: 'demo-expert',
          headline: 'Career guidance and next steps',
          bio: 'A detailed career guidance biography for testing.',
          city: 'Hyderabad',
          languages: ['English'],
          timezone: 'Asia/Kolkata',
          experienceYears: 8,
          categories: ['cat1'],
          verification: 'approved',
          updatedAt: '2026-10-20T00:00:00Z',
        };
      else if (path.startsWith('/api/categories'))
        data = { items: [{ _id: 'cat1', name: 'Career & Leadership' }], total: 1 };
      else if (path === '/api/expert/services') data = { items: [service] };
      else if (path.startsWith('/api/expert/slots?'))
        data = { items: rows, total: rows.length, page: 1 };
      else if (path.startsWith('/api/expert/slots')) {
        if (init?.method === 'DELETE') {
          rows = rows.filter((row) => row._id !== 'slot1');
          data = { status: 'closed' };
        } else if (init?.method === 'PUT' && failEdit) {
          status = 409;
          data = { error: { message: 'Only your open slots can be edited' } };
        } else {
          const body = JSON.parse(String(init?.body));
          const record = {
            _id: init?.method === 'PUT' ? 'slot1' : 'slot3',
            serviceId: body.serviceId,
            startsAt: body.startsAt,
            endsAt: new Date(+new Date(body.startsAt) + 2700000).toISOString(),
            status: 'open',
          };
          rows =
            init?.method === 'PUT'
              ? rows.map((row) => (row._id === record._id ? record : row))
              : [...rows, record];
          data = record;
        }
      }
      return { ok: status < 400, status, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/studio']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('textbox', { name: 'Headline', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Availability', exact: true }));
    await screen.findByRole('button', { name: /Edit slot/ });
  }
  function fillTime(value: Date) {
    const input = local(value);
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: input.day } });
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: input.time } });
  }
  it('calculates a readonly end time and submits a dated UTC interval request', async () => {
    await openAvailability();
    fireEvent.change(screen.getByRole('combobox', { name: 'Service', exact: true }), {
      target: { value: 's1' },
    });
    const target = new Date(+start + 14400000);
    fillTime(target);
    const end = screen.getByLabelText('End time') as HTMLInputElement;
    expect(end.readOnly).toBe(true);
    expect(end.value).toBe(local(new Date(+target + 2700000)).time);
    expect((screen.getByLabelText('Repeat (Optional)') as HTMLSelectElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole('form', { name: 'Availability editor' }));
    expect(await screen.findByText('Availability added.')).toBeTruthy();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/expert/slots' && init?.method === 'POST',
      );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      serviceId: 's1',
      startsAt: target.toISOString(),
    });
  });
  it('loads and updates an open slot through the edit endpoint', async () => {
    await openAvailability();
    fireEvent.click(screen.getByRole('button', { name: /Edit slot/ }));
    expect((screen.getByLabelText('Start time') as HTMLInputElement).value).toBe(local(start).time);
    const target = new Date(+start + 14400000);
    fillTime(target);
    fireEvent.submit(screen.getByRole('form', { name: 'Availability editor' }));
    expect(await screen.findByText('Availability updated.')).toBeTruthy();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/expert/slots/slot1' && init?.method === 'PUT',
      );
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      serviceId: 's1',
      startsAt: target.toISOString(),
    });
  });
  it('removes open availability while protecting reserved slots', async () => {
    await openAvailability();
    expect(screen.getAllByRole('button', { name: /Edit slot/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Remove slot/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Remove slot/ }));
    expect(
      await screen.findByText('Availability removed. The slot is closed to new bookings.'),
    ).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Remove slot/ })).toBeNull());
    expect(screen.getByText('Reserved slot protected')).toBeTruthy();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([url, init]) => String(url) === '/api/expert/slots/slot1' && init?.method === 'DELETE',
        ),
    ).toBe(true);
  });
  it('keeps an edit draft when a slot becomes reserved before saving', async () => {
    await openAvailability(true);
    fireEvent.click(screen.getByRole('button', { name: /Edit slot/ }));
    const target = new Date(+start + 14400000);
    fillTime(target);
    fireEvent.submit(screen.getByRole('form', { name: 'Availability editor' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Only your open slots can be edited',
    );
    expect((screen.getByLabelText('Start time') as HTMLInputElement).value).toBe(
      local(target).time,
    );
    expect(screen.queryByText('Availability updated.')).toBeNull();
  });
  it('rejects a start time outside a 15-minute boundary without submitting', async () => {
    await openAvailability();
    fireEvent.change(screen.getByRole('combobox', { name: 'Service', exact: true }), {
      target: { value: 's1' },
    });
    fillTime(new Date(+start + 7 * 60000));
    fireEvent.submit(screen.getByRole('form', { name: 'Availability editor' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Choose a start time on a 15-minute boundary.',
    );
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([, init]) => init?.method === 'POST' || init?.method === 'PUT'),
    ).toHaveLength(0);
  });
});

describe('expert earnings workspace', () => {
  async function openEarnings(
    options: { empty?: boolean; zeroNet?: boolean; error?: boolean } = {},
  ) {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const path = String(url);
      let status = 200,
        data: unknown = {};
      if (path === '/api/me')
        data = {
          id: 'u1',
          name: 'Demo Expert',
          roles: ['customer', 'expert'],
          emailVerified: true,
        };
      else if (path === '/api/expert/profile')
        data = {
          slug: 'demo-expert',
          headline: 'Career guidance and next steps',
          bio: 'A detailed career guidance biography for testing.',
          city: 'Hyderabad',
          languages: ['English'],
          timezone: 'Asia/Kolkata',
          experienceYears: 8,
          categories: ['cat1'],
          verification: 'approved',
          updatedAt: '2026-10-20T00:00:00Z',
        };
      else if (path.startsWith('/api/categories'))
        data = { items: [{ _id: 'cat1', name: 'Career & Leadership' }], total: 1 };
      else if (path.startsWith('/api/expert/earnings?')) {
        if (options.error) {
          status = 503;
          data = { error: { message: 'Earnings report unavailable' } };
        } else {
          const q = new URL(path, 'http://localhost').searchParams;
          const all =
            options.empty || options.zeroNet
              ? []
              : [
                  {
                    _id: 'p1',
                    bookingId: 'b1',
                    amountPaise: 280000,
                    mode: 'manual',
                    status: 'paid',
                    reference: 'utr-fixture-123',
                    createdAt: '2026-10-12T12:00:00Z',
                  },
                  {
                    _id: 'p2',
                    bookingId: 'b2',
                    amountPaise: 320000,
                    mode: 'automatic',
                    status: 'unknown',
                    createdAt: '2026-10-10T12:00:00Z',
                  },
                ];
          const payouts = all.filter(
            (p) => q.get('status') === 'all' || p.status === q.get('status'),
          );
          data = {
            summary:
              options.empty || options.zeroNet
                ? {
                    totalEarningsPaise: 0,
                    completedSessions: options.zeroNet ? 1 : 0,
                    pendingPayoutPaise: 0,
                    thisMonthPaise: 0,
                  }
                : {
                    totalEarningsPaise: 1250000,
                    completedSessions: 18,
                    pendingPayoutPaise: 320000,
                    thisMonthPaise: 495000,
                  },
            monthly: ['05', '06', '07', '08', '09', '10']
              .map((month, i) => ({
                month: `2026-${month}`,
                netPaise:
                  options.empty || options.zeroNet ? 0 : i === 4 ? 755000 : i === 5 ? 495000 : 0,
                sessions:
                  options.zeroNet && i === 5
                    ? 1
                    : options.empty || options.zeroNet
                      ? 0
                      : i === 4
                        ? 12
                        : i === 5
                          ? 6
                          : 0,
              }))
              .slice(-Number(q.get('months'))),
            payouts,
            payoutTotal: payouts.length,
            payoutPage: 1,
            payoutLimit: 7,
            timezone: q.get('timezone'),
            currentMonth: '2026-10',
            asOf: '2026-10-20T10:00:00Z',
            payoutInfo: {
              mode: 'manual',
              delayHours: 48,
              paymentMode: 'disabled',
              checkoutEnabled: false,
            },
          };
        }
      }
      return { ok: status < 400, status, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/studio']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('textbox', { name: 'Headline', exact: true });
    fireEvent.click(screen.getByRole('button', { name: 'Earnings', exact: true }));
  }
  it('renders server earnings, session counts and pending net without invented bank details', async () => {
    await openEarnings();
    const total = await screen.findByRole('article', { name: 'Total Earnings' });
    expect(within(total).getByText(/₹12,500(?:\.00)?/)).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Completed Sessions' })).getByText('18'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Pending Payout' })).getByText(/₹3,200(?:\.00)?/),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: /Monthly completed-session earnings/ })).toBeTruthy();
    expect(screen.getByText('Recorded paid', { selector: '.payout-state' })).toBeTruthy();
    expect(screen.queryByText('XXXX - 1234')).toBeNull();
  });
  it('requests the selected period and payout status from the server', async () => {
    await openEarnings();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Earnings period' }), {
      target: { value: '3' },
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) => String(url).includes('/api/expert/earnings?months=3')),
      ).toBe(true),
    );
    fireEvent.change(await screen.findByRole('combobox', { name: 'Payout status' }), {
      target: { value: 'unknown' },
    });
    expect(await screen.findByRole('button', { name: 'View payout p2' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View payout p1' })).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('status=unknown')),
    ).toBe(true);
  });
  it('opens the actual payout reference as a record rather than an invoice', async () => {
    await openEarnings();
    fireEvent.click(await screen.findByRole('button', { name: 'View payout p1' }));
    const detail = screen.getByRole('region', { name: 'Payout record details' });
    expect(within(detail).getByText('utr-fixture-123')).toBeTruthy();
    expect(
      within(detail).getByText(/not a tax invoice or bank settlement certificate/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close payout record' }));
    expect(screen.queryByRole('region', { name: 'Payout record details' })).toBeNull();
  });
  it('shows genuine zero and empty states without sample transactions', async () => {
    await openEarnings({ empty: true });
    expect(await screen.findByText('No payouts recorded yet')).toBeTruthy();
    expect(screen.getByText('No completed paid sessions in this period yet.')).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Total Earnings' })).getByText(/₹0(?:\.00)?/),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /View payout/ })).toBeNull();
  });
  it('distinguishes zero-net completed sessions from having no completed sessions', async () => {
    await openEarnings({ zeroNet: true });
    expect(
      await screen.findByText('Completed sessions have zero net earnings in this period.'),
    ).toBeTruthy();
    expect(
      within(screen.getByRole('article', { name: 'Completed Sessions' })).getByText('1'),
    ).toBeTruthy();
    expect(screen.queryByText('No completed paid sessions in this period yet.')).toBeNull();
  });
  it('shows report errors without presenting zero as a successful financial result', async () => {
    await openEarnings({ error: true });
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Earnings report unavailable Try again',
    );
    expect(screen.queryByRole('article', { name: 'Total Earnings' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('expert registration to dashboard journey', () => {
  it('lets a returning expert applicant resume before creating a profile', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url) === '/api/me')
        return {
          ok: true,
          json: async () => ({
            id: 'applicant',
            name: 'New Applicant',
            roles: ['customer'],
            accountPurpose: 'expert',
            emailVerified: true,
          }),
        } as Response;
      if (String(url) === '/api/expert/profile')
        return { ok: true, json: async () => null } as Response;
      if (String(url) === '/api/expert/dashboard')
        return {
          ok: true,
          json: async () => ({
            profile: null,
            onboarding: {
              verification: 'not_started',
              activeServices: 0,
              openSlots: 0,
              listed: false,
              acceptingReservations: false,
              publicPath: null,
            },
            stats: {
              upcomingAppointments: 0,
              pendingRequests: 0,
              completedSessions: 0,
              heldReservations: 0,
            },
          }),
        } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
    const overview = await screen.findByRole('region', { name: 'Your expert overview' });
    expect(
      within(overview).getByRole('heading', { name: 'Complete your expert profile' }),
    ).toBeTruthy();
    expect(within(overview).queryByRole('link', { name: 'Manage services' })).toBeNull();
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('bookings?scope=expert')),
    ).toBe(false);
    fireEvent.click(within(overview).getByRole('link', { name: 'Complete profile' }));
    expect(await screen.findByRole('form', { name: 'Public profile form' })).toBeTruthy();
  });
  it('keeps expert intent through verification and shows the saved profile and review result on the dashboard', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let signedIn = false,
      profile: any = null,
      approved = false;
    const category = 'a'.repeat(24);
    const onboarding = () => ({
      emailVerified: true,
      profileSubmitted: !!profile,
      verification: approved ? 'approved' : (profile?.verification ?? 'not_started'),
      activeServices: approved ? 1 : 0,
      openSlots: approved ? 2 : 0,
      listed: approved,
      acceptingReservations: approved,
      publicPath: approved ? '/experts/new-journey-expert' : null,
    });
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let data: any;
      if (path === '/api/auth/register') data = {};
      else if (path === '/api/auth/email/verify') {
        signedIn = true;
        data = {};
      } else if (path === '/api/me' && signedIn)
        data = {
          id: 'new-expert',
          name: 'New Journey Expert',
          email: 'journey@example.invalid',
          emailVerified: true,
          roles: profile ? ['customer', 'expert'] : ['customer'],
        };
      else if (path === '/api/expert/profile') {
        if (init?.method === 'PUT')
          profile = {
            ...JSON.parse(String(init.body)),
            verification: 'pending',
            updatedAt: '2026-10-22T10:00:00Z',
          };
        data = profile;
      } else if (path === '/api/expert/onboarding') data = onboarding();
      else if (path === '/api/expert/dashboard')
        data = {
          profile: profile ? { ...profile, verification: approved ? 'approved' : 'pending' } : null,
          onboarding: onboarding(),
          stats: {
            upcomingAppointments: 0,
            pendingRequests: 0,
            completedSessions: 0,
            heldReservations: 0,
          },
        };
      else if (path.startsWith('/api/bookings?') || path === '/api/expert/services')
        data = { items: [], total: 0 };
      else if (path.startsWith('/api/categories'))
        data = { items: [{ _id: category, name: 'Technology' }], total: 1 };
      else return fallback(url, init);
      return { ok: true, status: 200, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Welcome back' });
    fireEvent.click(screen.getByRole('button', { name: 'Create account', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Account purpose' }), {
      target: { value: 'expert' },
    });
    fireEvent.change(screen.getByLabelText('Your name'), {
      target: { value: 'New Journey Expert' },
    });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'journey@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password · at least 12 characters'), {
      target: { value: 'a-long-test-password-123' },
    });
    fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
    await screen.findByRole('heading', { name: 'Verify your email' });
    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify email', exact: true }));
    const form = await screen.findByRole('form', { name: 'Public profile form' });
    for (const [label, value] of [
      ['Public profile slug', 'new-journey-expert'],
      ['Headline', 'Thoughtful technology career guidance'],
      ['City', 'Hyderabad'],
      ['About your experience', 'Professional guidance based on years of technology experience.'],
    ])
      fireEvent.change(within(form).getByRole('textbox', { name: label, exact: true }), {
        target: { value },
      });
    fireEvent.change(
      within(form).getByRole('combobox', { name: 'Primary expertise', exact: true }),
      {
        target: { value: category },
      },
    );
    fireEvent.submit(form);
    fireEvent.click(await screen.findByRole('link', { name: 'View expert dashboard' }));
    expect(
      await screen.findByRole('heading', { name: 'Your application is under review' }),
    ).toBeTruthy();
    const overview = screen.getByRole('region', { name: 'Your expert overview' });
    expect(within(overview).getByText('Thoughtful technology career guidance')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Expert appointments' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(overview).queryByRole('link', { name: 'View published profile' })).toBeNull();
    approved = true;
    fireEvent.click(within(overview).getByRole('button', { name: 'Refresh expert status' }));
    expect(
      await screen.findByRole('heading', { name: 'Your expert profile is published' }),
    ).toBeTruthy();
    expect(
      within(overview).getByRole('link', { name: 'View published profile' }).getAttribute('href'),
    ).toBe('/experts/new-journey-expert');
    fireEvent.click(within(overview).getByRole('link', { name: 'Manage services' }));
    expect(await screen.findByRole('heading', { name: 'Your Services' })).toBeTruthy();
  });
});

describe('personal booking workspace', () => {
  function mockDashboard(roles: string[], failBookings = false) {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path === '/api/me')
        return {
          ok: true,
          json: async () => ({ id: 'customer1', name: 'Ananya Rao', emailVerified: true, roles }),
        } as Response;
      if (path.startsWith('/api/bookings?'))
        return {
          ok: !failBookings,
          status: failBookings ? 503 : 200,
          json: async () =>
            failBookings
              ? { error: { message: 'Bookings temporarily unavailable' } }
              : { items: [], total: 0 },
        } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );
  }
  it('personalizes the empty state and routes discovery to real experts', async () => {
    mockDashboard(['customer']);
    expect(await screen.findByRole('heading', { name: 'Good to see you, Ananya.' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Your next conversation is waiting' }),
    ).toBeTruthy();
    expect(screen.getByText(/Payments are disabled in this build/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Expert appointments' })).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Explore Experts' }));
    expect(await screen.findByText('Demo Expert')).toBeTruthy();
  });
  it('switches expert scope and shows the appropriate empty state', async () => {
    mockDashboard(['customer', 'expert']);
    fireEvent.click(await screen.findByRole('button', { name: 'Expert appointments' }));
    expect(
      await screen.findByRole('heading', { name: 'Your next appointment is on its way' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Expert appointments' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('scope=expert&page=1')),
    ).toBe(true);
  });
  it('shows booking failure instead of an empty-bookings claim', async () => {
    mockDashboard(['customer'], true);
    expect(await screen.findByText('Bookings temporarily unavailable')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Your next conversation is waiting' })).toBeNull();
  });
});

describe('sign-in reference layout', () => {
  it('opens the expert signup link directly and explains open expert registration', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) =>
      String(url) === '/api/config'
        ? ({
            ok: true,
            json: async () => ({
              betaAccess: 'invite',
              expertSignupEnabled: true,
              googleClientId: '',
            }),
          } as Response)
        : fallback(url, init),
    );
    render(
      <MemoryRouter initialEntries={['/auth?mode=register&next=/studio']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Your name')).toBeTruthy();
    expect(
      (screen.getByRole('combobox', { name: 'Account purpose' }) as HTMLSelectElement).value,
    ).toBe('expert');
    expect(
      await screen.findByText(
        'Expert registration is open. Your profile is published only after admin approval.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Our controlled beta is invitation-only.')).toBeNull();
  });
  it('toggles password visibility without losing the draft', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Welcome back' });
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    fireEvent.change(password, { target: { value: 'a-private-draft' } });
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.type).toBe('text');
    expect(password.value).toBe('a-private-draft');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password.type).toBe('password');
    expect(
      (screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('keeps account creation, reset and phone forms reachable', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Welcome back' });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('button', { name: 'Send reset code' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Your name')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Phone OTP' }));
    expect(screen.getByLabelText('Phone number with country code')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send OTP' })).toBeTruthy();
  });
});

describe('responsive admin operations', () => {
  function mockAdmin(failQueue = false) {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const p = String(url);
      if (p === '/api/me')
        return {
          ok: true,
          json: async () => ({
            id: 'admin1',
            name: 'Test Admin',
            roles: ['customer', 'admin'],
            emailVerified: true,
          }),
        } as Response;
      if (p === '/api/admin/overview')
        return {
          ok: true,
          json: async () => ({
            pendingExperts: 2,
            bookings: 7,
            refundsRequired: 1,
            failedJobs: 0,
            paymentBlockers: ['Checkout is disabled'],
            providerStatus: {
              email: false,
              google: false,
              calendar: false,
              phone: false,
              route: false,
            },
          }),
        } as Response;
      if (p === '/api/admin/exceptions')
        return {
          ok: !failQueue,
          status: failQueue ? 503 : 200,
          json: async () =>
            failQueue
              ? { error: { message: 'Queue is unavailable' } }
              : { bookings: [], payouts: [], jobs: [] },
        } as Response;
      if (p.startsWith('/api/admin/ledger?'))
        return {
          ok: true,
          json: async () => ({
            items: [{ _id: 'ledger1', bookingId: 'booking1', kind: 'capture', grossPaise: 12345 }],
          }),
        } as Response;
      if (p.startsWith('/api/admin/experts?'))
        return { ok: true, json: async () => ({ items: [], total: 0 }) } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    );
  }
  it('renders stored counts and honest integration states, with refresh', async () => {
    mockAdmin();
    const summary = await screen.findByRole('region', { name: 'Marketplace summary' });
    expect(within(summary).getByText('7')).toBeTruthy();
    expect(screen.getAllByText('Not connected')).toHaveLength(5);
    expect(await screen.findByText('No exceptions found')).toBeTruthy();
    expect(screen.queryByText('System Healthy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === '/api/admin/overview').length,
      ).toBe(2),
    );
  });
  it('toggles the mobile menu and closes it after selecting a workflow', async () => {
    mockAdmin();
    await screen.findByText('No exceptions found');
    const toggle = screen.getByRole('button', { name: 'Toggle admin navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Admin navigation' })).getByRole('button', {
        name: 'Experts',
      }),
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) => String(url).includes('/api/admin/experts?page=1')),
      ).toBe(true),
    );
  });
  it('shows queue failure without claiming no exceptions and renders real report amounts', async () => {
    mockAdmin(true);
    expect(await screen.findByText('Queue is unavailable')).toBeTruthy();
    expect(screen.queryByText('No exceptions found')).toBeNull();
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Admin navigation' })).getByRole('button', {
        name: 'Reports',
      }),
    );
    expect(await screen.findByText('booking1')).toBeTruthy();
    expect(screen.getByText(/123\.45/)).toBeTruthy();
  });
});

describe('expert verification workspace', () => {
  function setup(failReview = false) {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const p = String(url);
      let data: any;
      if (p === '/api/me')
        data = { id: 'admin1', name: 'Admin', roles: ['customer', 'admin'], emailVerified: true };
      else if (p === '/api/admin/overview')
        data = {
          pendingExperts: 1,
          bookings: 0,
          refundsRequired: 0,
          failedJobs: 0,
          paymentBlockers: [],
          providerStatus: {},
        };
      else if (p === '/api/admin/exceptions') data = { bookings: [], payouts: [], jobs: [] };
      else if (p.startsWith('/api/admin/categories?'))
        data = { items: [{ _id: 'cat1', name: 'Technology' }], total: 1 };
      else if (p.startsWith('/api/admin/experts?'))
        data = {
          items: [
            {
              _id: 'e1',
              userId: { name: 'Test Expert', email: 'expert@example.invalid' },
              headline: 'Practical technology guidance',
              bio: 'Review this profile evidence.',
              verification: 'pending',
              categories: [{ _id: 'cat1', name: 'Technology' }],
              experienceYears: 5,
              city: 'Hyderabad',
              createdAt: '2026-10-01T00:00:00Z',
            },
          ],
          total: 1,
          summary: { pending: 1, approved: 0, total: 1, updatedThisMonth: 1 },
        };
      else if (p === '/api/admin/experts/e1')
        data = {
          expert: {
            _id: 'e1',
            headline: 'Practical technology guidance',
            bio: 'Review this profile evidence.',
            profileRevision: 0,
            experienceYears: 5,
            city: 'Hyderabad',
            languages: ['English'],
            timezone: 'Asia/Kolkata',
          },
          owner: { email: 'expert@example.invalid', emailVerified: true, active: true },
          categories: [{ name: 'Technology', active: true }],
          services: [],
          openSlots: 0,
          readiness: { publicPath: null },
        };
      else if (p === '/api/admin/experts/e1/verification')
        return {
          ok: !failReview,
          status: failReview ? 503 : 200,
          json: async () => (failReview ? { error: { message: 'Review could not be saved' } } : {}),
        } as Response;
      else return fallback(url, init);
      return { ok: true, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    );
  }
  async function openExperts() {
    fireEvent.click(
      await within(screen.getByRole('navigation', { name: 'Admin navigation' })).findByRole(
        'button',
        { name: 'Experts' },
      ),
    );
    await screen.findByText('Test Expert');
  }
  it('applies server filters and shows stored category and experience without ratings', async () => {
    setup();
    await screen.findByText('No exceptions found');
    await openExperts();
    fireEvent.change(screen.getByLabelText('Search experts'), { target: { value: 'Practical' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) => String(url).includes('q=Practical&status=pending')),
      ).toBe(true),
    );
    expect(screen.getByText('5 years experience')).toBeTruthy();
    expect(screen.getByText('Profiles updated this month')).toBeTruthy();
    expect(screen.queryByText(/12 reviews/)).toBeNull();
  });
  it('requires a review reason and retains the draft after failure', async () => {
    setup(true);
    await screen.findByText('No exceptions found');
    await openExperts();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(
      (screen.getByRole('button', { name: 'Save review decision' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'Reviewed the supplied profile evidence' },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save review decision' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save review decision' }));
    expect(await screen.findByText('Review could not be saved')).toBeTruthy();
    expect((screen.getByLabelText('Review reason') as HTMLTextAreaElement).value).toBe(
      'Reviewed the supplied profile evidence',
    );
    const request = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url) === '/api/admin/experts/e1/verification');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      status: 'approved',
      reason: 'Reviewed the supplied profile evidence',
      expectedRevision: 0,
    });
  });
});

describe('admin review end to end', () => {
  it('lands admins in operations, inspects service details, saves a review and displays audit history', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let signedIn = false,
      approved = false;
    const expert = {
      _id: 'e1',
      userId: { name: 'Applicant Expert', email: 'applicant@example.invalid' },
      slug: 'applicant-expert',
      headline: 'Experienced professional guidance',
      bio: 'Professional experience ready for admin review.',
      verification: 'pending',
      profileRevision: 3,
      categories: [{ _id: 'cat1', name: 'Technology' }],
      createdAt: '2026-10-22T10:00:00Z',
      experienceYears: 8,
    };
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let data: any;
      if (path === '/api/auth/login') {
        signedIn = true;
        data = { roles: ['admin'] };
      } else if (path === '/api/me' && signedIn)
        data = { id: 'a1', name: 'Admin', roles: ['admin'], emailVerified: true };
      else if (path === '/api/admin/overview')
        data = {
          pendingExperts: approved ? 0 : 1,
          bookings: 0,
          refundsRequired: 0,
          failedJobs: 0,
          paymentBlockers: ['Checkout is disabled'],
          providerStatus: {},
        };
      else if (path === '/api/admin/exceptions') data = { bookings: [], payouts: [], jobs: [] };
      else if (path.startsWith('/api/admin/categories?'))
        data = { items: [{ _id: 'cat1', name: 'Technology' }], total: 1 };
      else if (path.startsWith('/api/admin/experts?'))
        data = {
          items: approved ? [] : [expert],
          total: approved ? 0 : 1,
          summary: {
            pending: approved ? 0 : 1,
            approved: approved ? 1 : 0,
            total: 1,
            updatedThisMonth: 1,
          },
        };
      else if (path === '/api/admin/experts/e1')
        data = {
          expert,
          owner: { email: 'applicant@example.invalid', emailVerified: true, active: true },
          categories: [{ name: 'Technology', active: true }],
          services: [
            {
              _id: 's1',
              title: 'Professional office hours',
              description: 'A focused professional conversation.',
              pricePaise: 249900,
              durationMinutes: 45,
              mode: 'online',
              active: true,
            },
          ],
          openSlots: 2,
          readiness: { publicPath: null },
        };
      else if (path === '/api/admin/experts/e1/verification') {
        approved = true;
        data = { verification: 'approved', profileRevision: 4 };
      } else if (path.startsWith('/api/admin/audit?'))
        data = {
          items: approved
            ? [
                {
                  _id: 'audit1',
                  actorId: { name: 'Admin' },
                  action: 'expert.verify',
                  resourceId: 'e1',
                  createdAt: '2026-10-22T11:00:00Z',
                  details: { reason: 'Reviewed application and service evidence' },
                },
              ]
            : [],
          total: approved ? 1 : 0,
        };
      else return fallback(url, init);
      return { ok: true, status: 200, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Welcome back' });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'admin@example.invalid' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a-long-test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue', exact: true }));
    const summary = await screen.findByRole('region', { name: 'Marketplace summary' });
    fireEvent.click(within(summary).getByRole('button', { name: /Experts awaiting review/ }));
    expect(await screen.findByText('Applicant Expert')).toBeTruthy();
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('status=pending')),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Approve', exact: true }));
    expect(await screen.findByText('Professional office hours')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Review reason'), {
      target: { value: 'Reviewed application and service evidence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save review decision' }));
    expect(
      await screen.findByText('Expert approved. Review saved; status email queued.'),
    ).toBeTruthy();
    const saved = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith('/e1/verification'));
    expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({
      expectedRevision: 3,
      status: 'approved',
    });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Admin navigation' })).getByRole('button', {
        name: 'Audit log',
      }),
    );
    expect(await screen.findByText('expert.verify')).toBeTruthy();
    expect(screen.getByText('Reviewed application and service evidence')).toBeTruthy();
  });
  it('opens notification history by URL and queues only an explicitly reviewed email retry', async () => {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let queued = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url) === '/api/me')
        return {
          ok: true,
          json: async () => ({ id: 'a1', name: 'Admin', roles: ['admin'], emailVerified: true }),
        } as Response;
      if (String(url).startsWith('/api/admin/jobs?'))
        return {
          ok: true,
          json: async () => ({
            items: queued
              ? []
              : [
                  {
                    _id: 'j1',
                    type: 'expert-review',
                    status: 'failed',
                    attempts: 8,
                    createdAt: '2026-10-22T10:00:00Z',
                    lastError: 'ProviderError',
                  },
                ],
            total: queued ? 0 : 1,
          }),
        } as Response;
      if (String(url) === '/api/admin/jobs/j1/retry') {
        queued = true;
        return {
          ok: true,
          json: async () => ({
            status: 'queued',
            message: 'Email job queued for the worker. This does not confirm delivery.',
          }),
        } as Response;
      }
      return fallback(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/admin?section=notifications']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Review email retry' }));
    const form = screen.getByRole('form', { name: 'Retry selected email job' });
    expect(
      (within(form).getByRole('button', { name: 'Queue email retry' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.change(within(form).getByLabelText('Retry reason'), {
      target: { value: 'Checked report before retrying' },
    });
    fireEvent.submit(form);
    expect(
      await screen.findByText('Email job queued for the worker. This does not confirm delivery.'),
    ).toBeTruthy();
  });
});

describe('admin management reference pages', () => {
  function setup() {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const p = String(url);
      let data: any;
      if (p === '/api/me')
        data = { id: 'a1', name: 'Admin', roles: ['customer', 'admin'], emailVerified: true };
      else if (p === '/api/admin/overview')
        data = {
          pendingExperts: 0,
          bookings: 0,
          refundsRequired: 0,
          failedJobs: 0,
          paymentBlockers: [],
          providerStatus: {},
        };
      else if (p === '/api/admin/exceptions') data = { bookings: [], payouts: [], jobs: [] };
      else if (p.startsWith('/api/admin/categories?'))
        data = {
          items: [
            { _id: 'c1', name: 'Technology', slug: 'technology', active: true, expertCount: 3 },
          ],
          total: 1,
        };
      else if (p === '/api/admin/categories/c1') data = {};
      else if (p === '/api/admin/settings')
        data = {
          commissionBps: 1000,
          confirmationPolicy: 'expert_choice',
          payoutMode: 'manual',
          payoutDelayHours: 48,
          updatedAt: '2026-10-21',
        };
      else if (p.startsWith('/api/admin/invites?'))
        data = {
          items: [
            {
              _id: 'i1',
              email: 'member@example.invalid',
              active: true,
              createdAt: '2026-10-21T10:00:00Z',
            },
          ],
          total: 1,
        };
      else if (p === '/api/admin/invites') data = {};
      else if (p.startsWith('/api/admin/payments?'))
        data = {
          items: [],
          total: 0,
          summary: {
            totalBookings: 0,
            recordedPaidPaise: 0,
            recordedPaidCount: 0,
            payoutsToReconcile: 0,
          },
        };
      else return fallback(url, init);
      return { ok: true, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    );
  }
  async function open(label: string) {
    await screen.findByText('No exceptions found');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Admin navigation' })).getByRole('button', {
        name: label,
      }),
    );
  }
  it('loads editable categories and sends archive changes to the existing API', async () => {
    setup();
    await open('Categories');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Technology' }));
    expect((screen.getByLabelText('Category name') as HTMLInputElement).value).toBe('Technology');
    fireEvent.click(screen.getByLabelText(/Active category/));
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }));
    await screen.findByText('Category saved.');
    const req = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/admin/categories/c1' && init?.method === 'PUT',
      );
    expect(JSON.parse(String(req?.[1]?.body))).toEqual({
      name: 'Technology',
      slug: 'technology',
      active: false,
    });
  });
  it('saves exact commission basis points and existing policy modes', async () => {
    setup();
    await open('Policies');
    fireEvent.change(await screen.findByLabelText('Platform commission (%)'), {
      target: { value: '12.34' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save policies' }));
    await screen.findByText(/Policies saved/);
    const req = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/admin/settings' && init?.method === 'PUT',
      );
    expect(JSON.parse(String(req?.[1]?.body))).toEqual({
      commissionBps: 1234,
      confirmationPolicy: 'expert_choice',
      payoutMode: 'manual',
      payoutDelayHours: 48,
    });
  });
  it('revokes a stored invitation without claiming a sent email', async () => {
    setup();
    await open('Invitations');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Revoke access for member@example.invalid' }),
    );
    expect(await screen.findByText(/no invitation email was sent/)).toBeTruthy();
    const req = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) => String(url) === '/api/admin/invites' && init?.method === 'POST',
      );
    expect(JSON.parse(String(req?.[1]?.body))).toEqual({
      email: 'member@example.invalid',
      active: false,
    });
  });
  it('uses server payment filters and displays true zero report states', async () => {
    setup();
    await open('Payments');
    await screen.findByText('No bookings match these filters');
    expect(screen.getByText('Recorded paid payouts')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search payments'), {
      target: { value: 'consultation' },
    });
    fireEvent.change(screen.getByLabelText('Payout status'), { target: { value: 'unknown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.some(([url]) =>
            String(url).includes('q=consultation&status=all&payout=unknown'),
          ),
      ).toBe(true),
    );
  });
});

describe('expert detail reservation reference', () => {
  const firstTime = '2030-11-03T10:00:00Z',
    secondTime = '2030-11-04T12:00:00Z';
  const timeLabel = (value: string) =>
    new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(value));
  function setup(empty = false, noServices = false) {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      let data: any;
      if (path === '/api/me')
        data = { id: 'customer1', name: 'Customer', roles: ['customer'], emailVerified: true };
      else if (path === '/api/experts/detail-expert')
        data = {
          id: 'e1',
          name: 'Test Expert',
          headline: 'Thoughtful professional guidance',
          bio: 'Stored profile biography.',
          verified: true,
          city: 'Hyderabad',
          languages: ['English', 'Telugu'],
          experienceYears: 8,
          categories: ['c1'],
          reviews: [],
          services: noServices
            ? []
            : [
                {
                  id: 's1',
                  title: 'Founder office hours',
                  description: 'A focused conversation about your business.',
                  durationMinutes: 45,
                  pricePaise: 249900,
                  mode: 'online',
                },
                {
                  id: 's2',
                  title: 'Strategy follow-up',
                  description: 'Review your next steps.',
                  durationMinutes: 30,
                  pricePaise: 150000,
                  mode: 'online',
                },
              ],
        };
      else if (path.startsWith('/api/categories'))
        data = { items: [{ id: 'c1', name: 'Business Strategy' }], total: 1 };
      else if (path === '/api/services/s1/slots')
        data = {
          items: empty
            ? []
            : [
                { _id: 'slot1', startsAt: firstTime, endsAt: '2030-11-03T10:45:00Z' },
                { _id: 'slot2', startsAt: secondTime, endsAt: '2030-11-04T12:45:00Z' },
              ],
        };
      else if (path === '/api/services/s2/slots')
        data = { items: [{ _id: 'slot3', startsAt: secondTime, endsAt: '2030-11-04T12:30:00Z' }] };
      else if (path === '/api/bookings')
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: 'Reservation temporarily unavailable' } }),
        } as Response;
      else return fallback(url, init);
      return { ok: true, json: async () => data } as Response;
    });
    render(
      <MemoryRouter initialEntries={['/experts/detail-expert']}>
        <App />
      </MemoryRouter>,
    );
  }
  it('shows actual profile facts, service price and truthful review and payment states', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Test Expert' });
    expect(screen.getByText('8 years experience')).toBeTruthy();
    expect(await screen.findByText('Business Strategy')).toBeTruthy();
    expect(
      screen.getByText('No reviews yet. Only customers with completed paid bookings can review.'),
    ).toBeTruthy();
    expect(screen.getByText(/Payments are disabled. This reservation/)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Reserve this session' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('requires a time and terms, and reuses the reservation key after a failed request', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: timeLabel(firstTime) }));
    const reserve = screen.getByRole('button', { name: 'Reserve this session' });
    expect((reserve as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(reserve);
    await screen.findByText('Reservation temporarily unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Reserve this session' }));
    await screen.findByText('Reservation temporarily unavailable');
    const requests = vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === '/api/bookings');
    expect(requests).toHaveLength(2);
    const keys = requests.map(
      ([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key'],
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(JSON.parse(String(requests[0][1]?.body))).toEqual({
      slotId: 'slot1',
      termsAccepted: true,
    });
  });
  it('clears selected times when switching service', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: timeLabel(firstTime) }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Strategy follow-up/ }));
    await screen.findByRole('button', { name: timeLabel(secondTime) });
    expect(
      (screen.getByRole('button', { name: 'Reserve this session' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('handles empty availability and missing services without fabricating times', async () => {
    setup(true);
    await screen.findByText('No upcoming slots. Check back soon.');
    expect(
      (screen.getByRole('button', { name: 'Reserve this session' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole('button', { name: timeLabel(firstTime) })).toBeNull();
    cleanup();
    setup(false, true);
    expect(
      await screen.findByRole('heading', { name: 'No published services available' }),
    ).toBeTruthy();
  });
});

describe('admin provider configuration screen', () => {
  function setup(fail = false) {
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    const settings = {
      available: true,
      revision: 2,
      origin: 'https://iconnect.example.invalid',
      providers: [
        {
          id: 'email',
          title: 'Email delivery',
          help: 'Configure your SMTP sender.',
          enabled: true,
          configured: true,
          fields: [
            {
              key: 'EMAIL_PROVIDER',
              label: 'Email provider',
              type: 'text',
              secret: false,
              value: 'smtp',
              configured: true,
              options: ['smtp', 'ses'],
            },
            {
              key: 'SES_REGION',
              label: 'SES region',
              type: 'text',
              secret: false,
              value: 'ap-south-1',
              configured: true,
            },
            {
              key: 'SMTP_HOST',
              label: 'SMTP host',
              type: 'text',
              secret: false,
              value: 'smtp.example.invalid',
              configured: true,
            },
            {
              key: 'SMTP_PASSWORD',
              label: 'SMTP password',
              type: 'text',
              secret: true,
              value: '',
              configured: true,
            },
          ],
        },
      ],
    };
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url);
      if (path === '/api/me')
        return {
          ok: true,
          json: async () => ({
            id: 'a1',
            name: 'Admin',
            roles: ['customer', 'admin'],
            emailVerified: true,
          }),
        } as Response;
      if (path === '/api/admin/overview')
        return {
          ok: true,
          json: async () => ({
            pendingExperts: 0,
            bookings: 0,
            refundsRequired: 0,
            failedJobs: 0,
            paymentBlockers: [],
            providerStatus: {},
          }),
        } as Response;
      if (path === '/api/admin/exceptions')
        return {
          ok: true,
          json: async () => ({ bookings: [], payouts: [], jobs: [] }),
        } as Response;
      if (path === '/api/admin/integrations')
        return { ok: true, json: async () => settings } as Response;
      if (path === '/api/admin/integrations/email')
        return {
          ok: !fail,
          status: fail ? 403 : 200,
          json: async () =>
            fail
              ? { error: { message: 'Confirm your current admin password' } }
              : { ...settings, revision: 3 },
        } as Response;
      if (path === '/api/admin/integrations/email/test')
        return {
          ok: true,
          json: async () => ({ accepted: true, message: 'Provider accepted the request.' }),
        } as Response;
      return fallback(url, init);
    });
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    );
  }
  async function open() {
    await screen.findByText('No exceptions found');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Admin navigation' })).getByRole('button', {
        name: 'Settings',
      }),
    );
    return await screen.findByRole('form', { name: 'Email delivery configuration' });
  }
  it('separates integrations from policies and keeps saved secrets out of inputs', async () => {
    setup();
    const form = await open();
    expect(screen.getByRole('heading', { name: 'Provider configuration' })).toBeTruthy();
    expect((within(form).getByLabelText('SMTP password') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('heading', { name: 'Marketplace policies' })).toBeNull();
    fireEvent.change(within(form).getByLabelText('Confirm admin password'), {
      target: { value: 'admin-current-password' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Save email delivery' }));
    expect(await screen.findByText('Settings saved. Provider is enabled.')).toBeTruthy();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url) === '/api/admin/integrations/email');
    const body = JSON.parse(String(call?.[1]?.body));
    expect(body.revision).toBe(2);
    expect(body.fields.SMTP_PASSWORD).toBe('');
    expect(body.password).toBe('admin-current-password');
    expect((within(form).getByLabelText('Confirm admin password') as HTMLInputElement).value).toBe(
      '',
    );
  });
  it('switches SMTP and SES fields and requires consent and reauthentication before sending', async () => {
    setup();
    const form = await open();
    fireEvent.change(within(form).getByLabelText('Email provider'), { target: { value: 'ses' } });
    expect(within(form).getByLabelText('SES region')).toBeTruthy();
    expect(within(form).queryByLabelText('SMTP host')).toBeNull();
    fireEvent.change(within(form).getByLabelText('Email provider'), { target: { value: 'smtp' } });
    const testForm = screen.getByRole('form', { name: 'Email delivery test' });
    const send = within(testForm).getByRole('button', {
      name: 'Send test email',
    }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(within(testForm).getByLabelText('Test recipient'), {
      target: { value: 'recipient@example.invalid' },
    });
    fireEvent.change(within(testForm).getByLabelText('Admin password for test'), {
      target: { value: 'admin-password' },
    });
    expect(send.disabled).toBe(true);
    fireEvent.click(
      within(testForm).getByLabelText('I have permission to send this test to the recipient.'),
    );
    fireEvent.click(send);
    await screen.findByText('Provider accepted the request.');
    const call = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith('/email/test'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      recipient: 'recipient@example.invalid',
      consent: true,
      password: 'admin-password',
    });
    expect(
      (within(testForm).getByLabelText('Admin password for test') as HTMLInputElement).value,
    ).toBe('');
  });
  it('preserves credential drafts after failure but clears the admin reauthentication password', async () => {
    setup(true);
    const form = await open();
    fireEvent.change(within(form).getByLabelText('SMTP host'), {
      target: { value: 'new.smtp.example.invalid' },
    });
    fireEvent.change(within(form).getByLabelText('SMTP password'), {
      target: { value: 'new-secret-draft' },
    });
    fireEvent.change(within(form).getByLabelText('Confirm admin password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Save email delivery' }));
    await screen.findByText('Confirm your current admin password');
    expect((within(form).getByLabelText('SMTP host') as HTMLInputElement).value).toBe(
      'new.smtp.example.invalid',
    );
    expect((within(form).getByLabelText('SMTP password') as HTMLInputElement).value).toBe(
      'new-secret-draft',
    );
    expect((within(form).getByLabelText('Confirm admin password') as HTMLInputElement).value).toBe(
      '',
    );
  });
  it('shows pending delivery separately and refreshes provider reports without sending again', async () => {
    setup();
    const fallback = vi.mocked(fetch).getMockImplementation()!;
    let delivered = false;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      if (String(url).startsWith('/api/admin/email-deliveries')) {
        if (init?.method === 'POST') delivered = true;
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                _id: 'r1',
                provider: 'ses',
                recipient: 're***@example.invalid',
                messageId: 'ses-test',
                createdAt: '2026-10-22T08:00:00.000Z',
                status: delivered ? 'delivered' : 'accepted',
                reportNote: delivered
                  ? 'The recipient mail server accepted this email.'
                  : 'Delivery confirmation is pending.',
              },
            ],
            total: 1,
          }),
        } as Response;
      }
      return fallback(url, init);
    });
    await open();
    const reports = screen.getByRole('region', { name: 'Email delivery reports' });
    expect(await within(reports).findByText('Accepted - delivery pending')).toBeTruthy();
    fireEvent.click(within(reports).getByRole('button', { name: 'Check delivery' }));
    expect(await within(reports).findByText('Delivered to mail server')).toBeTruthy();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/email/test'))).toBe(
      false,
    );
  });
});
