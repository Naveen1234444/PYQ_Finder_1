import express from "express";
import multer from "multer";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.resolve("server-data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || 50);
fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    cb(isPdf ? null : new Error("Only PDF files are accepted."), isPdf);
  }
});

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("The server is missing OPENAI_API_KEY. Add it to backend environment variables; never put it in browser code or GitHub.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { vectorStoreId: null, files: [] };
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch { return { vectorStoreId: null, files: [] }; }
}
function writeConfig(config) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2)); }
async function getStore(client) {
  const config = readConfig();
  if (config.vectorStoreId) return config.vectorStoreId;
  const store = await client.vectorStores.create({ name: "PYQ UPSC PDF Library" });
  config.vectorStoreId = store.id;
  writeConfig(config);
  return store.id;
}
function ensureConfigured(res) {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "AI is not configured. Add OPENAI_API_KEY to the backend environment variables. Do not put the key in the frontend or GitHub." });
    return false;
  }
  return true;
}
function safeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map(item => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").slice(0, 6000)
  })).filter(item => item.content.trim());
}

app.get("/api/health", (_req, res) => {
  const config = readConfig();
  res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY), model: MODEL,
    pdfLibraryReady: Boolean(config.vectorStoreId), indexedPdfCount: (config.files || []).length });
});
app.get("/api/files", (_req, res) => {
  const config = readConfig();
  res.json({ files: config.files || [], ready: Boolean(config.vectorStoreId) });
});

app.post("/api/upload", upload.array("pdfs", 20), async (req, res) => {
  if (!ensureConfigured(res)) return;
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "Select at least one PDF file." });
  try {
    const client = getOpenAI();
    const storeId = await getStore(client);
    const added = [];
    for (const file of files) {
      try {
        const result = await client.vectorStores.files.uploadAndPoll(storeId, fs.createReadStream(file.path));
        added.push({ filename: file.originalname, fileId: result.id || result.file_id || null,
          status: result.status || "completed", uploadedAt: new Date().toISOString() });
      } finally {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }
    }
    const config = readConfig();
    config.files = [...(config.files || []), ...added];
    writeConfig(config);
    res.json({ uploaded: added, message: "PDF upload and indexing completed." });
  } catch (error) {
    for (const file of files) if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error("PYQ PDF upload error:", error);
    res.status(500).json({ error: error.message || "PDF indexing failed." });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!ensureConfigured(res)) return;
  const question = String(req.body?.question || "").trim();
  if (!question) return res.status(400).json({ error: "Enter a question." });
  if (question.length > 12000) return res.status(400).json({ error: "Please keep your question under 12,000 characters." });

  try {
    const client = getOpenAI();
    const config = readConfig();
    const history = safeHistory(req.body?.history);
    const instructions = `You are PYQ, an expert UPSC CSE study assistant inside a previous-year-question app.

HYBRID KNOWLEDGE RULE — ALWAYS FOLLOW:
1. Search the user's indexed UPSC PDFs first whenever a PDF library is available and relevant.
2. Use PDFs as the primary source for facts, exact PYQ wording, official answer keys, page references, and the user's study materials.
3. If PDFs contain a complete answer, explain it using those documents and identify the source file. Never invent a page number.
4. If PDFs contain only part of the answer, explain the supported part first, then supplement it with general knowledge. Clearly label the sections "From your PDFs" and "Additional explanation (general knowledge)".
5. If PDFs do not contain the answer, still help from general knowledge. Explicitly say "Not found in your uploaded PDFs — answering from general knowledge."
6. If no PDFs have been uploaded, answer from general knowledge and tell the user no indexed PDFs were available for this response.
7. Never invent UPSC question wording, exam year, question number, official answer, source title, quotation, or page number.
8. For PYQ answer keys, distinguish an official answer key found in a source from your own reasoned answer. State uncertainty where appropriate.
9. For MCQs, evaluate all four options and explain why the correct option is best and why the others are incorrect where possible.
10. For current affairs or changing facts, disclose that they need up-to-date verification.

RESPONSE STYLE:
- Use clear headings and concise, structured explanations at UPSC level.
- Keep source-derived statements separate from general knowledge and inference.
- End with a short source note naming only PDF files actually retrieved. Do not fabricate page numbers.`;
    const tools = config.vectorStoreId
      ? [{ type: "file_search", vector_store_ids: [config.vectorStoreId], max_num_results: 10 }]
      : [];
    const response = await client.responses.create({
      model: MODEL,
      instructions,
      input: [...history, { role: "user", content: question }],
      ...(tools.length ? { tools, include: ["file_search_call.results"] } : {})
    });
    const sources = [];
    for (const item of response.output || []) {
      if (item.type === "file_search_call") {
        for (const result of item.results || []) {
          if (result.filename) sources.push(result.filename + (result.page_number ? `, page ${result.page_number}` : ""));
        }
      }
    }
    res.json({ answer: response.output_text || "I could not generate a text response. Please try again.",
      sources: [...new Set(sources)], usedPdfLibrary: Boolean(config.vectorStoreId), model: MODEL });
  } catch (error) {
    console.error("PYQ chat error:", error);
    res.status(500).json({ error: error.message || "Chat request failed." });
  }
});

app.use((error, _req, res, _next) => {
  const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  res.status(status).json({ error: error.message || "Request error." });
});
app.listen(PORT, "0.0.0.0", () => console.log(`PYQ server listening on port ${PORT}; model: ${MODEL}`));
