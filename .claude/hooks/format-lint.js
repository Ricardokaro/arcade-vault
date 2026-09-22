#!/usr/bin/env node
// PostToolUse hook (Write|Edit): en archivos React (.tsx/.jsx) quita las
// líneas en blanco del código, aplica las correcciones del linter (ESLint)
// y por último formatea con Prettier al guardar. En Markdown (.md) solo
// se aplica Prettier, porque ahí las líneas en blanco son estructurales
// (separan párrafos/listas) y no deben tocarse.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TARGET_EXT = /\.(tsx|jsx|md)$/i;
const REACT_EXT = /\.(tsx|jsx)$/i;
const EXCLUDED_PREFIXES = ["references/", "node_modules/", ".next/"];

// Invocamos el entrypoint JS de cada CLI directamente con Node (en vez del
// shim .cmd/.bin) para no depender de `shell: true`, que en execFileSync
// concatena los argumentos sin escapar y puede permitir inyección de comandos.
const PRETTIER_CLI = path.join(
  PROJECT_ROOT,
  "node_modules",
  "prettier",
  "bin",
  "prettier.cjs",
);
const ESLINT_CLI = path.join(
  PROJECT_ROOT,
  "node_modules",
  "eslint",
  "bin",
  "eslint.js",
);

function runCli(entry, args) {
  execFileSync(process.execPath, [entry, ...args], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
  });
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// Quita las líneas vacías o de solo-espacios del código. Evita tocar las
// que caen dentro de un template literal (backticks), donde una línea en
// blanco puede ser parte del valor del string y no solo separación visual.
function stripBlankLines(content) {
  const lines = content.split("\n");
  const kept = [];
  let inTemplate = false;
  for (const line of lines) {
    const isBlank = line.trim() === "";
    if (!isBlank || inTemplate) kept.push(line);
    const backticks = (line.match(/`/g) || []).length;
    if (backticks % 2 === 1) inTemplate = !inTemplate;
  }
  return kept.join("\n");
}

function main() {
  const raw = readStdin();
  if (!raw) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath =
    payload?.tool_response?.filePath || payload?.tool_input?.file_path;
  if (!filePath || !fs.existsSync(filePath)) return;

  const rel = path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
  if (!TARGET_EXT.test(rel)) return;
  if (EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))) return;

  if (REACT_EXT.test(rel)) {
    const original = fs.readFileSync(filePath, "utf8");
    const stripped = stripBlankLines(original);
    if (stripped !== original) fs.writeFileSync(filePath, stripped);

    try {
      runCli(ESLINT_CLI, ["--fix", filePath]);
    } catch (err) {
      const output = `${err.stdout || ""}${err.stderr || ""}`.trim();
      block(
        `ESLint encontró errores en ${rel} que no se pudieron corregir automáticamente:\n\n${output || err.message}`,
      );
      return;
    }
  }

  try {
    runCli(PRETTIER_CLI, ["--write", filePath]);
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`.trim();
    block(`Prettier falló en ${rel}:\n\n${output || err.message}`);
  }
}

main();
