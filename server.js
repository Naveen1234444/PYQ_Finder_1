import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.resolve("server-data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 50);
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    cb(ok ? null : new Error("Only PDF files are accepted."), ok);
  }
});

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { vectorStoreId: null, files: [] };
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}
function writeConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2)); }
async function getStore() {
  const c = readConfig();
  if (c.vectorStoreId) return c.vectorStoreId;
  const store = await openai.vectorStores.create({ name: "PYQ Personal UPSC PDF Library" });
  c.vectorStoreId = store.id;
  writeConfig(c);
  return store.id;
}
function ensureConfigured(res) {
  if (!process.env.OPENAI_API_KEY) { res.status(503).json({ error: "Backend is missing OPENAI_API_KEY. Configure it on the server, never in browser code." }); return false; }
  if (!MODEL) { res.status(503).json({ error: "Backend is missing OPENAI_MODEL. Set a model ID available to your API project." }); return false; }
  return true;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY && MODEL) }));
app.get("/api/files", (_req, res) => res.json({ files: readConfig().files || [] }));

app.post("/api/upload", upload.array("pdfs", 20), async (req, res) => {
  if (!ensureConfigured(res)) return;
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "Select at least one PDF." });
  const added = [];
  try {
    const storeId = await getStore();
    for (const file of files) {
      try {
        const result = await openai.vectorStores.files.uploadAndPoll(
          storeId,
          fs.createReadStream(file.path)
        );
        const entry = {
          filename: file.originalname,
          fileId: result.id || result.file_id || null,
          status: result.status || "completed",
          uploadedAt: new Date().toISOString()
        };
        added.push(entry);
      } finally {
        fs.existsSync(file.path) && fs.unlinkSync(file.path);
      }
    }
    const c = readConfig();
    c.files = [...(c.files || []), ...added];
    writeConfig(c);
    res.json({ uploaded: added });
  } catch (err) {
    for (const f of files) if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
    res.status(500).json({ error: err.message || "PDF indexing failed." });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!ensureConfigured(res)) return;
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Enter a question." });
  const storeId = readConfig().vectorStoreId;
  if (!storeId) return res.status(400).json({ error: "Upload and index PDFs before asking questions." });

  const history = Array.isArray(req.body.history) ? req.body.history.slice(-8) : [];
  const historyText = history.map(m => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.content || "").slice(0, 6000)}`).join("\n");
  const instructions = `You are PYQ, an evidence-grounded UPSC study assistant. Prioritize the user's indexed PDFs. Do not invent PYQ wording, years, question numbers, answer keys, quotations, or page references. Clearly separate (1) what the uploaded sources state, (2) your explanation or inference, and (3) any information not found in the sources. If the PDFs do not support an answer, say so and ask for a relevant source or permission to use general knowledge. Preserve exact question wording when quoting. When source annotations are available, name the PDF and page. Explain options carefully and flag uncertain OCR or ambiguous scans.`;
  try {
    const response = await openai.responses.create({
      model: MODEL,
      instructions,
      input: `${historyText ? "Conversation so far:\n" + historyText + "\n\n" : ""}User question: ${question}`,
      tools: [{ type: "file_search", vector_store_ids: [storeId], max_num_results: 8 }],
      include: ["file_search_call.results"]
    });
    const sources = [];
    for (const item of (response.output || [])) {
      if (item.type === "file_search_call") {
        for (const result of (item.results || [])) {
          if (result.filename) sources.push(result.filename + (result.page_number ? `, page ${result.page_number}` : ""));
        }
      }
    }
    res.json({ answer: response.output_text || "No text response was returned.", sources: [...new Set(sources)] });
  } catch (err) {
    res.status(500).json({ error: err.message || "Chat request failed." });
  }
});

app.use((err, _req, res, _next) => res.status(400).json({ error: err.message || "Request error." }));
app.listen(PORT, "0.0.0.0", () => console.log(`PYQ server listening on port ${PORT}`));
