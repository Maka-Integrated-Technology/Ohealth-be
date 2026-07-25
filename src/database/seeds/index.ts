/* eslint-disable no-console */
import { runBookingFlowSeed } from './seed-booking-flow';

runBookingFlowSeed().catch((err: unknown) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
