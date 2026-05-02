import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MODEL = process.env.CLAUDE_MODEL || "sonnet";
const PROMPT_TEXT =
  "添付画像には赤い線で囲まれた手書きの質問が含まれています。" +
  "赤い囲みの中の質問を読み取り、簡潔に（1〜3行程度・最大60文字）回答だけを返してください。" +
  "前置き・確認・質問の引用は一切不要。回答テキストのみ。";

const app = express();
app.use(express.json({ limit: "12mb" }));
app.use(express.static(PUBLIC_DIR, { index: "index.html" }));

function askClaudeWithImage(pngFilePath, cwd) {
  return new Promise((resolve, reject) => {
    const args = [
      "--print",
      "--model",
      MODEL,
      "--output-format",
      "text",
      "--setting-sources",
      "project",
      "--no-session-persistence",
      "--",
      `@${pngFilePath} ${PROMPT_TEXT}`,
    ];
    const child = spawn("claude", args, {
      env: process.env,
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Claude CLI timeout (60s)"));
    }, 60_000);

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

app.post("/ask", async (req, res) => {
  const dataUrl = req.body && req.body.image;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "image (data URL) is required" });
    return;
  }
  const commaIdx = dataUrl.indexOf(",");
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : "";
  if (!base64) {
    res.status(400).json({ error: "empty image data" });
    return;
  }

  let workDir;
  try {
    workDir = await mkdtemp(path.join(tmpdir(), "notes-ask-"));
    const filePath = path.join(workDir, "question.png");
    await writeFile(filePath, Buffer.from(base64, "base64"));

    const answer = await askClaudeWithImage(filePath, workDir);
    res.json({ answer });
  } catch (err) {
    console.error("[/ask] error:", err);
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    if (workDir) {
      rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`手書きノート × Claude server listening on http://localhost:${PORT}`);
  console.log(`  model: ${MODEL}`);
  console.log(`  static: ${PUBLIC_DIR}`);
});
