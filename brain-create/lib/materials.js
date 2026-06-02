import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const textTypes = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const documentExtensions = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class SourceError extends Error {
  constructor(message, status = 422) {
    super(message);
    this.status = status;
  }
}

const dataUrl = file => `data:${file.type};base64,${file.buffer.toString("base64")}`;
const citation = (source, location, text) => ({ source, location, text });
const cleanText = text => text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
const stripHtml = html => cleanText(html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " "));
const commandExists = async command => {
  const checks = process.platform === "win32" ? [["where.exe", [command]]] : [["which", [command]]];
  for (const [name, args] of checks) {
    try { await execFile(name, args); return true; } catch {}
  }
  return false;
};

export function validateFile(file) {
  if (!file?.buffer?.length) throw new SourceError("An uploaded file was empty. Please choose a file with usable lesson content.");
  if (file.buffer.length > MAX_FILE_BYTES) throw new SourceError(`${file.name} is larger than the 25 MB upload limit. Please upload a smaller file.`);
  const extension = extname(file.name).toLowerCase();
  if (![...textTypes, ...imageTypes, ...videoTypes].includes(file.type) && !documentExtensions.has(extension)) {
    throw new SourceError(`${file.name} is not a supported lesson file.`);
  }
}

export function buildGroundedPrompt(sourcePackage, options = {}) {
  const sourceText = chunkSourcePackage(sourcePackage).items.map(item => item.citations.map(c => `[${c.source} | ${c.location}] ${c.text}`).join("\n")).join("\n\n");
  return `Create grounded study materials for a Grade ${options.grade || 9} ${options.subject || "general"} student.
Use ONLY the SOURCE PACKAGE below. Do not add facts that are absent from it. If the package is insufficient, return {"error":"insufficient_source"}.
Optional student instructions: ${options.instructions || "None"}
Return strict JSON with: title, reviewer, flashcards, quiz. reviewer is an array of {heading,body,citations}. flashcards is an array of {question,answer,citations}. quiz is an array of {question,options,answer,citations}. Each citation must copy a source and location from the package. Use 15-20 flashcards and 5 answer choices per quiz question where the source supports them.

SOURCE PACKAGE
${sourceText}`;
}

export function chunkSourcePackage(sourcePackage, maxChars = 12000) {
  return { items: sourcePackage.items.map(item => ({ ...item, citations: item.citations.flatMap(c => c.text.length <= maxChars ? [c] : Array.from({ length: Math.ceil(c.text.length / maxChars) }, (_, i) => ({ ...c, location: `${c.location}, chunk ${i + 1}`, text: c.text.slice(i * maxChars, (i + 1) * maxChars) }))) })) };
}

export function assertGroundedMaterials(materials, sourcePackage) {
  const allowed = new Set(sourcePackage.items.flatMap(item => item.citations.map(c => `${c.source}|${c.location}`)));
  const groups = [materials.reviewer, materials.flashcards, materials.quiz];
  if (groups.some(group => !Array.isArray(group) || !group.length)) throw new SourceError("The AI response did not include a complete reviewer, flashcard set, and quiz.", 502);
  for (const entry of groups.flat()) {
    if (!Array.isArray(entry.citations) || !entry.citations.length) throw new SourceError("The AI returned an unsupported claim without a source reference.", 502);
    for (const ref of entry.citations) if (!allowed.has(`${ref.source}|${ref.location}`)) throw new SourceError("The AI returned a citation that is not present in the processed source package.", 502);
  }
  return materials;
}

export function createProcessor(deps = {}) {
  const ai = deps.ai;
  const fetchImpl = deps.fetch || fetch;
  const run = deps.execFile || execFile;
  const exists = deps.commandExists || commandExists;

  async function processImage(file) {
    const analysis = await ai.analyzeVisual(dataUrl(file), `Analyze this lesson image. Extract readable text, diagrams, labels, tables, and important visual details. Return concise grounded notes with visible labels.`);
    return { kind: "image", name: file.name, citations: [citation(file.name, "image visual analysis", cleanText(analysis))] };
  }

  async function processDocument(file) {
    if (textTypes.has(file.type)) {
      const text = cleanText(file.buffer.toString("utf8"));
      if (!text) throw new SourceError(`${file.name} did not contain readable text.`);
      return { kind: "document", name: file.name, citations: [citation(file.name, "document text", text)] };
    }
    const analysis = await ai.analyzeFile(file, "Extract actual lesson content. Preserve headings, lists, tables, and page or slide references. Use OCR for scanned pages. Return grounded notes with page or slide labels.");
    return { kind: "document", name: file.name, citations: [citation(file.name, "document extraction with page or slide references", cleanText(analysis))] };
  }

  async function processVideo(file) {
    if (!await exists("ffmpeg")) throw new SourceError("Uploaded video processing needs ffmpeg on the server. Install ffmpeg, then try again.");
    const dir = await mkdtemp(join(tmpdir(), "brain-create-video-"));
    try {
      const input = join(dir, file.name.replace(/[^a-z0-9._-]/gi, "_"));
      const audio = join(dir, "audio.mp3");
      await writeFile(input, file.buffer);
      await run("ffmpeg", ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", audio]);
      const transcript = await ai.transcribe(await readFile(audio), "audio.mp3");
      const citations = [citation(file.name, "audio transcript", cleanText(transcript))];
      for (let i = 0; i < 4; i++) {
        const frame = join(dir, `frame-${i}.jpg`);
        await run("ffmpeg", ["-y", "-ss", String(i * 30), "-i", input, "-frames:v", "1", frame]);
        try {
          const notes = await ai.analyzeVisual(`data:image/jpeg;base64,${(await readFile(frame)).toString("base64")}`, "Describe lesson-relevant text, diagrams, labels, and visual details in this sampled video frame.");
          citations.push(citation(file.name, `sampled frame near ${i * 30}s`, cleanText(notes)));
        } catch {}
      }
      return { kind: "video", name: file.name, citations };
    } finally { await rm(dir, { recursive: true, force: true }); }
  }

  async function youtubeTranscript(url) {
    const id = new URL(url).searchParams.get("v") || new URL(url).pathname.split("/").filter(Boolean).pop();
    if (!id) throw new SourceError("The YouTube link does not include a valid video id.");
    const list = await fetchImpl(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(id)}`);
    const xml = await list.text();
    const lang = xml.match(/lang_code="([^"]+)"/)?.[1];
    if (!lang) throw new SourceError("This YouTube video has no accessible captions. Please use a captioned video or upload the source file.");
    const captions = await (await fetchImpl(`https://www.youtube.com/api/timedtext?v=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`)).text();
    const text = cleanText(captions.replace(/<text[^>]*>/g, "").replace(/<\/text>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, " "));
    if (!text) throw new SourceError("The linked video's captions could not be read. Please upload the video file instead.");
    return { kind: "video-link", name: url, citations: [citation(url, "YouTube captions", text)] };
  }

  async function fetchLinkedSource(url, parsed) {
    const response = await fetchImpl(url);
    if (!response.ok) throw new SourceError(`The linked lesson source could not be fetched (${response.status}). Please check the link or upload the file.`);
    const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
    const length = Number(response.headers.get("content-length") || "0");
    if (length > MAX_FILE_BYTES) throw new SourceError("The linked source is larger than the 25 MB limit. Please upload a smaller file.");
    const buffer = Buffer.from(await response.arrayBuffer());
    const name = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname).replace(/[^a-z0-9._-]/gi, "_");
    if (buffer.length > MAX_FILE_BYTES) throw new SourceError("The linked source is larger than the 25 MB limit. Please upload a smaller file.");

    if (imageTypes.has(type)) return processImage({ name, type, buffer });
    if (videoTypes.has(type)) return processVideo({ name, type, buffer });
    if (textTypes.has(type) || type === "text/html") {
      const raw = buffer.toString("utf8");
      const text = type === "text/html" ? stripHtml(raw) : cleanText(raw);
      if (!text) throw new SourceError("The linked page did not contain readable lesson text.");
      return { kind: "document-link", name: url, citations: [citation(url, type === "text/html" ? "page text" : "linked text", text)] };
    }

    throw new SourceError("This link is not a supported lesson source. Use a direct image, video, text page, or captioned YouTube link.");
  }

  async function processUrl(url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new SourceError("Please enter a valid http or https lesson URL.", 400); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new SourceError("Only http and https lesson links are supported.", 400);
    if (/youtu\.be$|youtube\.com$/i.test(parsed.hostname)) return youtubeTranscript(url);
    return fetchLinkedSource(url, parsed);
  }

  async function processSources({ files = [], urls = [], onStage = () => {} }) {
    if (!files.length && !urls.length) throw new SourceError("Add at least one lesson file or link before generating study materials.");
    const items = [];
    for (const file of files) {
      validateFile(file);
      if (imageTypes.has(file.type)) { onStage("analyzing visuals"); items.push(await processImage(file)); }
      else if (videoTypes.has(file.type)) { onStage("transcribing audio"); items.push(await processVideo(file)); }
      else { onStage("extracting text"); items.push(await processDocument(file)); }
    }
    for (const url of urls) { onStage("extracting linked captions"); items.push(await processUrl(url)); }
    if (!items.some(item => item.citations.some(c => c.text.length > 40))) throw new SourceError("The submitted material did not contain enough usable lesson content. Please upload a clearer or more complete source.");
    return { items };
  }

  return { processSources };
}
