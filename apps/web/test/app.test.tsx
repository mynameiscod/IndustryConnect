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
