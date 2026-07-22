// ---------------------------------------------------------------------------
// build.mjs
//
// PageCrypt only encrypts the contents of the ONE html file you point it at.
// If index.html links out to /css/style.css and /js/app.js, those files sit
// next to it in the clear — anyone can read them without the password. So
// before encrypting, this script bundles everything (JS modules -> one IIFE,
// CSS -> inline <style>) into a single self-contained dist/index.html.
//
// Usage:
//   npm install
//   npm run build     -> produces dist/index.html (unencrypted, self-contained)
//   npm run encrypt   -> builds, then runs pagecrypt on dist/index.html
//                        in place (you'll be prompted for a password, or
//                        pass one: npx pagecrypt dist/index.html dist/index.html "your password")
// ---------------------------------------------------------------------------

import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";

async function main() {
  await mkdir("dist", { recursive: true });

  // Bundle all JS modules (app.js and everything it imports) into one IIFE.
  const bundled = await build({
    entryPoints: ["js/app.js"],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
    target: "es2019",
  });
  const jsBundle = bundled.outputFiles[0].text;

  const css = await readFile("css/style.css", "utf8");
  let html = await readFile("index.html", "utf8");

  // Replace the external stylesheet link with an inline <style> block.
  html = html.replace(
    /<link rel="stylesheet" href="\/css\/style\.css" \/>/,
    `<style>\n${css}\n</style>`
  );

  // Replace the external module script with the bundled, inline script.
  html = html.replace(
    /<script type="module" src="\/js\/app\.js"><\/script>/,
    `<script>\n${jsBundle}\n</script>`
  );

  await writeFile("dist/index.html", html, "utf8");
  console.log("Built dist/index.html (self-contained, ready for pagecrypt).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
