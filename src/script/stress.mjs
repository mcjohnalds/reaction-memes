import { stressTest } from "../stress.mjs";

stressTest({
  targetRequestsPerSecond: parseFloat(process.argv[2]),
  stressTestDuration: Infinity,
  lagLimit: Infinity,
  port: 8080,
  log: true,
});
