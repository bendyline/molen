import { relative } from 'node:path';

// The default reporter prints a file only after it finishes. Emit starts as well so an
// interrupted runner still tells us which browser test (or beforeAll hook) was active.
export default class GoldenReporter {
  onTestModuleStart(module) {
    console.log(
      `[golden:file:start] ${new Date().toISOString()} ${relative(process.cwd(), module.moduleId)}`,
    );
  }

  onTestCaseReady(test) {
    console.log(`[golden:test:start] ${new Date().toISOString()} ${test.fullName}`);
  }

  onTestCaseResult(test) {
    console.log(
      `[golden:test:end] ${new Date().toISOString()} ${test.result().state} ${Math.round(test.diagnostic()?.duration ?? 0)}ms ${test.fullName}`,
    );
  }
}
