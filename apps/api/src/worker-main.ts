import mongoose from 'mongoose';
import { readConfig } from './config.js';
import { connect } from './models.js';
import { createProviders } from './providers.js';
import { workerTick } from './worker.js';
const c = readConfig();
await connect(c.MONGODB_URI, c.NODE_ENV === 'production');
const providers = createProviders(c);
let stopped = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopped = true;
  });
while (!stopped) {
  try {
    await workerTick(providers);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'worker_error',
        type: error instanceof Error ? error.name : 'Unknown',
      }),
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
await mongoose.disconnect();
