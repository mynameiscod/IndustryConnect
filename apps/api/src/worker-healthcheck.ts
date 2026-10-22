import { readHeartbeat } from './worker-heartbeat.js';
process.exitCode = (await readHeartbeat()) ? 0 : 1;
