// Minimal describe/it-free test harness. No Jest/Vitest dependency on purpose:
// this repo's installed Node (v14.15.1) predates the toolchains those require.
// Swap this out once the dev environment is upgraded — see the note in README.

type TestFn = () => void;

const tests: { name: string; fn: TestFn }[] = [];

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export function run(): void {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      t.fn();
      pass++;
      console.log(`  ok - ${t.name}`);
    } catch (err) {
      fail++;
      console.error(`  FAIL - ${t.name}`);
      console.error(err instanceof Error ? err.stack ?? err.message : err);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exitCode = 1;
}
