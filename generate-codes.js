// scripts/generate-codes.js
// Gebruik: node scripts/generate-codes.js --count 200 --format "FSID-AAAA-9999-9999" [--expires ISO] [--dealer_id X] [--dealer_naam Y]
import crypto from 'crypto';

function parseArgs() {
  const out = { count: 200, format: 'FSID-AAAA-9999-9999', expires: null, dealer_id: null, dealer_naam: null };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) {
    const k = a[i].replace(/^--/, '');
    out[k] = a[i + 1];
  }
  out.count = Number(out.count || 200);
  return out;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function randLetter() { return LETTERS[crypto.randomInt(0, LETTERS.length)]; }
function randDigit() { return String(crypto.randomInt(0, 10)); }

function makeCode(fmt) {
  // Ondersteunt exact "FSID-AAAA-9999-9999" en vergelijkbare placeholders
  return fmt.replace(/A/g, () => randLetter()).replace(/9/g, () => randDigit());
}

function main() {
  const { count, format, expires, dealer_id, dealer_naam } = parseArgs();
  const arr = [];
  for (let i = 0; i < count; i++) {
    const code = makeCode(format);
    const entry = { code };
    if (expires) entry.expiresAt = expires;
    if (dealer_id) entry.dealer_id = dealer_id;
    if (dealer_naam) entry.dealer_naam = dealer_naam;
    arr.push(entry);
  }
  process.stdout.write(JSON.stringify(arr, null, 2));
}

main();
