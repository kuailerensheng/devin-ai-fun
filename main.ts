// Reads /input/cases.json, answers each case alone with solve.js, writes /output/answers.json. The fast path reads the file's bytes in place; run(input) answers any input it declines.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';
setFlagsFromString('--no-incremental-marking');
const { run, answerPath } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
  answerPath: (path: string, run: (input: unknown) => unknown) => Uint8Array;
};
const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const path = join(INPUT_DIR, 'cases.json');
let out: Uint8Array | string;
try {
  out = answerPath(path, run);
} catch {
  const cases = JSON.parse(readFileSync(path, 'utf8')) as { id: string; input: unknown }[];
  const answers: unknown[] = [];
  for (const c of cases) answers.push(run(c.input));
  out = JSON.stringify(answers);
}
writeFileSync(join(OUTPUT_DIR, 'answers.json'), out);
