import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromWeb = createRequire(path.join(ROOT, "web", "package.json"));
const ts = requireFromWeb("typescript/lib/typescript.js");

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  "dist",
  "coverage",
  "__pycache__",
  ".git",
  ".venv",
  "venv",
]);

const SKIP_FILE = new Set(["next-env.d.ts"]);

function scriptKind(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".tsx") return ts.ScriptKind.TSX;
  if (ext === ".jsx") return ts.ScriptKind.JSX;
  if (ext === ".ts") return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function stripTsLike(source, filePath) {
  const sf = ts.createSourceFile(
    path.basename(filePath),
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );
  const printer = ts.createPrinter({
    removeComments: true,
    newLine: ts.NewLineKind.LineFeed,
  });
  return printer.printFile(sf);
}

function stripHtmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

function stripSql(source) {
  return source
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("--");
      return i === -1 ? line : line.slice(0, i).trimEnd();
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function processFile(abs) {
  const base = path.basename(abs);
  if (SKIP_FILE.has(base)) return false;
  const ext = path.extname(abs).toLowerCase();
  const before = fs.readFileSync(abs, "utf8");
  let raw = before;

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    try {
      raw = stripTsLike(raw, abs);
    } catch {
      return false;
    }
    if (ext === ".tsx" || ext === ".jsx" || ext === ".md") {
      raw = stripHtmlComments(raw);
    }
  } else if (ext === ".sql") {
    raw = stripSql(raw);
  } else {
    return false;
  }

  if (raw !== before) {
    fs.writeFileSync(abs, raw, "utf8");
    return true;
  }
  return false;
}

function walk(dir, changed) {
  const rel = path.relative(ROOT, dir);
  if (rel.includes("next-upgrade") || /AppData[\\/]Local[\\/]Temp/i.test(rel)) {
    return;
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIR.has(ent.name)) walk(abs, changed);
    } else if (ent.isFile()) {
      if (processFile(abs)) changed.push(path.relative(ROOT, abs));
    }
  }
}

const changed = [];
for (const rel of ["api", "web", "workers", "mobile", "e2e"]) {
  const base = path.join(ROOT, rel);
  if (fs.existsSync(base)) walk(base, changed);
}

const webAgents = path.join(ROOT, "web", "AGENTS.md");
if (fs.existsSync(webAgents)) {
  const before = fs.readFileSync(webAgents, "utf8");
  const after = stripHtmlComments(before);
  if (after !== before) {
    fs.writeFileSync(webAgents, after, "utf8");
    changed.push("web/AGENTS.md");
  }
}

console.log(JSON.stringify({ changed: changed.length, files: changed }, null, 2));