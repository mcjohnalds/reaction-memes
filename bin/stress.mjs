import { stressTest } from "../src/stress.mjs"

stressTest({
  targetRequestsPerSecond: parseFloat(process.argv[2]),
  stressTestDuration: Infinity,
  lagLimit: Infinity,
  port: 8080,
  log: true,
});
