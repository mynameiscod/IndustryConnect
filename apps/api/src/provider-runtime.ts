import type { Config } from './config.js';
import { createProviders, type Providers } from './providers.js';
import { effectiveProviderConfig } from './integrations.js';
import { sendTrackedEmail } from './email-delivery.js';
// Each operation gets an immutable credential snapshot shared with the worker via encrypted storage.
export function createRuntimeProviders(c: Config): Providers {
  return new Proxy({} as Providers, {
    get(_target, property: keyof Providers) {
      return (...args: unknown[]) => {
        const integrationOperation = [
          'verifyGoogle',
          'createMeeting',
          'cancelMeeting',
          'sendEmail',
          'startPhone',
          'verifyPhone',
        ].includes(property);
        const snapshot = integrationOperation ? effectiveProviderConfig(c) : c;
        const providers = createProviders(snapshot);
        if (property === 'sendEmail')
          return sendTrackedEmail(snapshot, providers, ...(args as [string, string, string]));
        return (providers[property] as (...args: unknown[]) => unknown)(...args);
      };
    },
  });
}
