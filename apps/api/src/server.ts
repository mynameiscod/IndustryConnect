import mongoose from 'mongoose';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connect, ensureSettings } from './models.js';
const c = readConfig();
await connect(c.MONGODB_URI, c.NODE_ENV === 'production');
const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
if (!hello.setName) throw new Error('MongoDB replica set required for transactional bookings');
await ensureSettings();
const server = createApp(c).listen(c.PORT, () =>
  console.info(JSON.stringify({ event: 'server_ready', port: c.PORT, payments: c.PAYMENTS_MODE })),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void mongoose.disconnect().then(() => process.exit(0));
    });
  });
