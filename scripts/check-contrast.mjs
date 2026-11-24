#!/usr/bin/env node
// Verifies WCAG 2.1 colour contrast for the palette defined in client/src/styles.css.
// Text pairs need 4.5:1 (AA); non-text indicators need 3:1. Exits with code 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../client/src/styles.css', import.meta.url)), 'utf8');

const readVars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));

const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const light = readVars(css.slice(0, darkStart));
const dark = { ...light, ...readVars(css.slice(darkStart, css.indexOf('* { box-sizing'))) };

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const TEXT_PAIRS = [
  ['text', 'bg'],
  ['text', 'card'],
  ['muted', 'bg'],
  ['muted', 'card'],
  ['accent-text', 'accent'],
  ['error', 'card'],
  ['error', 'bg'],
];
const NON_TEXT_PAIRS = [
  ['lvl-0', 'card'],
  ['lvl-2', 'card'],
  ['lvl-3', 'card'],
  ['lvl-5', 'card'],
  ['focus', 'card'],
  ['focus', 'bg'],
];

let failures = 0;
for (const [theme, vars] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [list, min] of [
    [TEXT_PAIRS, 4.5],
    [NON_TEXT_PAIRS, 3],
  ]) {
    for (const [fg, bg] of list) {
      const ratio = contrast(vars[fg], vars[bg]);
      const ok = ratio >= min;
      if (!ok) failures += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${theme.padEnd(5)} ${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs ${min}:1)`);
    }
  }
}
if (failures) {
  console.error(`\n${failures} contrast check(s) failed.`);
  process.exit(1);
}
console.log('\nAll contrast checks passed.');
