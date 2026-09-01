// Minimal test harness: no Jest/Vitest because the installed Node (v14) predates them.

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
