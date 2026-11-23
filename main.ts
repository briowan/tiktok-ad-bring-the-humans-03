// Entry program for make.fun bring-the-humans-03 (TikTok ad bounty).
// The house reads the TikTok video itself; this program only hands over
// VIDEO.json, which names the video's full address on TikTok.
import {copyFileSync, mkdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

const botDir = process.env.MAKEFUN_BOT_DIR ?? "/bot";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Fail loudly here if VIDEO.json is malformed, instead of handing the
// grader a file it must refuse.
const source = join(botDir, "VIDEO.json");
const parsed: unknown = JSON.parse(readFileSync(source, "utf8"));
const url =
  typeof parsed === "object" && parsed !== null && "url" in parsed
    ? String((parsed as {url: unknown}).url)
    : "";
if (!/^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+$/.test(url)) {
  throw new Error(`VIDEO.json url is not a TikTok video address: ${url}`);
}

mkdirSync(outputDir, {recursive: true});
copyFileSync(source, join(outputDir, "VIDEO.json"));
console.log(`VIDEO.json copied to output (${url})`);
