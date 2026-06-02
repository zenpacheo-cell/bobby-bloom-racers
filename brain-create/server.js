import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertGroundedMaterials, buildGroundedPrompt, createProcessor, SourceError } from "./lib/materials.js";
import { openai } from "./lib/openai.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const processor = createProcessor({ ai: openai });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const json = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

async function body(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 30 * 1024 * 1024) throw new SourceError("Request is larger than the 30 MB limit.", 413); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

function multipart(buffer, boundary) {
  const fields = {}, files = [];
  for (const part of buffer.toString("latin1").split(`--${boundary}`).slice(1, -1)) {
    const [rawHeaders, rawBody = ""] = part.split("\r\n\r\n");
    const name = rawHeaders.match(/name="([^"]+)"/)?.[1];
    const filename = rawHeaders.match(/filename="([^"]*)"/)?.[1];
    if (!name) continue;
    const content = rawBody.replace(/\r\n$/, "");
    if (filename) files.push({ name: filename, type: rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream", buffer: Buffer.from(content, "latin1") });
    else fields[name] = content;
  }
  return { fields, files };
}

async function generate(req, res) {
  const boundary = req.headers["content-type"]?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || req.headers["content-type"]?.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new SourceError("Expected a multipart form submission.", 400);
  const { fields, files } = multipart(await body(req), boundary);
  const urls = JSON.parse(fields.urls || "[]");
  const stages = [];
  const sourcePackage = await processor.processSources({ files, urls, onStage: stage => stages.push(stage) });
  stages.push("generating study materials");
  const materials = assertGroundedMaterials(await openai.generate(buildGroundedPrompt(sourcePackage, fields)), sourcePackage);
  if (materials.error === "insufficient_source") throw new SourceError("The source did not contain enough usable lesson content. Please upload a better source.");
  stages.push("completed");
  json(res, 200, { materials, sourcePackage, stages });
}

createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/generate") return await generate(req, res);
    const pathname = new URL(req.url, "http://localhost").pathname;
    const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
    const path = join(root, requested);
    const file = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" }); res.end(file);
  } catch (error) {
    if (req.url?.startsWith("/api/")) return json(res, error.status || 500, { error: error.message || "Processing failed." });
    res.writeHead(404); res.end("Not found");
  }
}).listen(process.env.PORT || 4174, () => console.log(`Brain Create running at http://localhost:${process.env.PORT || 4174}`));
