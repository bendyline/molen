#!/usr/bin/env node
import { runCli } from './cli-commands';

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e: unknown) => {
    process.stderr.write(`molen: ${(e as Error).message}\n`);
    process.exitCode = 1;
  });
