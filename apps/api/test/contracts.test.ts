import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
describe('API contract coverage', () => {
  it('documents every JSON API operation and resolves schema references', () => {
    const source = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    const spec = JSON.parse(
      readFileSync(new URL('../../../docs/openapi.json', import.meta.url), 'utf8'),
    );
    const routes = [
      ...source.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"]\/api([^'"]+)['"]/g),
    ].map((m) => ({ method: m[1], path: m[2].replace(/:(\w+)/g, '{$1}') }));
    expect(routes.length).toBeGreaterThan(50);
    for (const route of routes)
      expect(spec.paths[route.path]?.[route.method], `${route.method} ${route.path}`).toBeDefined();
    const refs = [...JSON.stringify(spec).matchAll(/#\/components\/schemas\/([^"}]+)/g)].map(
      (m) => m[1],
    );
    for (const name of refs) expect(spec.components.schemas[name], name).toBeDefined();
  });
});
