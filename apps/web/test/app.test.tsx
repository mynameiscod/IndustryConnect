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
  it('restores shareable search filters and clears the entire search', async () => {
    render(
      <MemoryRouter initialEntries={['/?q=design&mode=online&language=Telugu&price=2500']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    expect((screen.getByLabelText('Search experts') as HTMLInputElement).value).toBe('design');
    expect((screen.getByLabelText('Language') as HTMLSelectElement).value).toBe('Telugu');
    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => {
        const value = String(url);
        return (
          value.includes('q=design') &&
          value.includes('mode=online') &&
          value.includes('language=Telugu') &&
          value.includes('maxPrice=250000')
        );
      }),
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect((screen.getByLabelText('Search experts') as HTMLInputElement).value).toBe(''),
    );
    expect((screen.getByLabelText('Maximum price') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Session format') as HTMLSelectElement).value).toBe('');
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url) === '/api/experts?page=1'),
      ).toBe(true),
    );
  });
  it('turns a goal shortcut into a real expert search', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    await screen.findByText('Demo Expert');
    fireEvent.click(screen.getByRole('button', { name: /Build something better/ }));
    await waitFor(() =>
      expect(
        vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('q=system+design')),
      ).toBe(true),
    );
    expect((screen.getByLabelText('Search experts') as HTMLInputElement).value).toBe(
      'system design',
    );
  });
  it('closes the mobile navigation after selecting a destination', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'How it works',
      }),
    );
    await waitFor(() => expect(toggle.getAttribute('aria-expanded')).toBe('false'));
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
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Demo Expert')).toBeNull();
  });
});
