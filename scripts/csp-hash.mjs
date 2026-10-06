// Recomputes the SHA-256 hashes of the inline <script> and <style> blocks in
// index.html and writes them into the Content-Security-Policy meta tag.
//
//   node scripts/csp-hash.mjs          update index.html in place
//   node scripts/csp-hash.mjs --check  exit 1 if the hashes are stale (used in CI)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../index.html", import.meta.url);
const check = process.argv.includes("--check");
const html = readFileSync(file, "utf8");

// The HTML parser normalises CRLF/CR to LF before the browser hashes the text.
const hashOf = (tag) => {
  const blocks = [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
  if (blocks.length !== 1) throw new Error(`expected exactly one <${tag}> block, found ${blocks.length}`);
  const text = blocks[0][1].replace(/\r\n?/g, "\n");
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
};

const scriptHash = hashOf("script");
const styleHash = hashOf("style");

const updated = html
  .replace(/script-src '[^']*'/, `script-src ${scriptHash}`)
  .replace(/style-src '[^']*'/, `style-src ${styleHash}`);

if (check) {
  if (updated !== html) {
    console.error("CSP hashes in index.html are stale. Run: node scripts/csp-hash.mjs");
    process.exit(1);
  }
  console.log("CSP hashes OK");
} else {
  writeFileSync(file, updated);
  console.log(`script-src ${scriptHash}\nstyle-src  ${styleHash}`);
}
