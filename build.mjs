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
