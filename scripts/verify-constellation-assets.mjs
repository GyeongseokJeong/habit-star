#!/usr/bin/env node
/**
 * Validate actual image file formats and approved PNG SHA-256 values.
 * Run after uploading assets to public/assets/constellation/.
 * No external dependencies.
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const filesRoot = join(process.cwd(), "public/assets/constellation");
const expected = [
  { stage: 1, sha: "654cc20d0d42bb2a9731e03278d0726cfe6eae0c70c9d8e7b769e43aa8a920d4", width: 1024, height: 1536 },
  { stage: 2, sha: "5eaf44c4ee62497deadfb94142506eae42eb933212da4b28e1164900753618aa", width: 1024, height: 1536 },
  { stage: 3, sha: "3fcb7360b2148bbb6006547ff902ac4a8ea7d90763c2f44eddac486ccf8d98c6", width: 1024, height: 1536 },
  { stage: 4, sha: "9c3e4a702520755eb8356c666a38068d17af37af884c585c8880ef03ad16c419", width: 1024, height: 1536 },
  { stage: 5, sha: "0e13d38fab74bf530a9f22f6c57c0f116d58033101eae6d2743a5b374af9ad54", width: 1024, height: 1536 },
  { stage: 6, sha: "72c91f59cbe695b10b2fd28376d21c9ac2eeff09318f6e9b5a45f0b0ea95a80e", webpSha: "e6b1b060e6c917a9d0a32bf2613db9090a3361262f2d9d682e21ec6c92a1c6ef", width: 1024, height: 1536 },
];

function validatePng(data, exp, path) {
  const sig = Buffer.from("89504e470d0a1a0a", "hex");
  if (!data.subarray(0, 8).equals(sig)) throw new Error(`Not genuine PNG: ${path}`);
  if (data.length < 24 || data.toString("ascii", 12, 16) !== "IHDR") throw new Error(`Invalid PNG header: ${path}`);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== exp.width || height !== exp.height) throw new Error(`Incorrect PNG dimensions: ${path}: ${width}×${height}`);
  const digest = createHash("sha256").update(data).digest("hex");
  if (digest !== exp.sha) throw new Error(`PNG checksum mismatch: ${path} (received ${digest})`);
}
function validateWebp(data, exp, path) {
  if (data.length < 20 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Not genuine WebP: ${path}`);
  }
  // The newly approved Stage 6 portrait must match the precise derived WEBP bytes.
  if (exp.webpSha && createHash("sha256").update(data).digest("hex") !== exp.webpSha) {
    throw new Error(`Approved WebP checksum mismatch: ${path}`);
  }
  // WebP decoder/dimensions checked in visual preview; signature is mandatory here.
}
let failures = 0;
for (const item of expected) {
  const name = `stage-${String(item.stage).padStart(2, "0")}`;
  for (const [kind, path] of [
    ["png", join(filesRoot, "originals", name + ".png")],
    ["webp", join(filesRoot, name + ".webp")],
  ]) {
    try {
      if (!existsSync(path)) throw new Error(`Missing required ${kind.toUpperCase()} file: ${path}`);
      const data = readFileSync(path);
      if (kind === "png") validatePng(data, item, path);
      else validateWebp(data, item, path);
      console.log(`PASS ${name} ${kind}`);
    } catch (err) {
      console.error(`FAIL ${name} ${kind}: ${err.message}`);
      failures++;
    }
  }
}
if (failures) {
  console.error(`FAIL: ${failures} missing, incorrect or mismatched assets`);
  process.exitCode = 1;
} else console.log("PASS: all 6 true PNG + 6 genuine WebP artwork files verified");
