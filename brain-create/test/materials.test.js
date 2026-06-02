import test from "node:test";
import assert from "node:assert/strict";
import { assertGroundedMaterials, buildGroundedPrompt, chunkSourcePackage, createProcessor, SourceError } from "../lib/materials.js";

const ai = {
  analyzeVisual: async (_image, prompt) => prompt.includes("sampled video") ? "Frame label: Population growth graph." : "Diagram title: Water Cycle. Labels: evaporation and condensation.",
  analyzeFile: async () => "Page 2 heading: Ecosystems. Producers make their own food. Table 1 lists consumers.",
  transcribe: async () => "At 00:05 the lesson explains carrying capacity and limited resources."
};

test("image OCR and visual analysis are included in source package", async () => {
  const processor = createProcessor({ ai });
  const result = await processor.processSources({ files: [{ name: "cycle.png", type: "image/png", buffer: Buffer.from("image") }] });
  assert.match(result.items[0].citations[0].text, /evaporation and condensation/);
  assert.equal(result.items[0].citations[0].location, "image visual analysis");
});

test("uploaded video processing combines transcript and sampled visual frames", async () => {
  const processor = createProcessor({
    ai,
    commandExists: async () => true,
    execFile: async (_command, args) => {
      const output = args.at(-1);
      if (output.endsWith(".mp3")) await import("node:fs/promises").then(fs => fs.writeFile(output, "audio"));
      if (output.endsWith(".jpg")) await import("node:fs/promises").then(fs => fs.writeFile(output, "frame"));
    }
  });
  const result = await processor.processSources({ files: [{ name: "lesson.mp4", type: "video/mp4", buffer: Buffer.from("video") }] });
  assert.match(result.items[0].citations[0].text, /carrying capacity/);
  assert.equal(result.items[0].citations.filter(c => c.location.includes("sampled frame")).length, 4);
});

test("captioned YouTube links process actual transcript", async () => {
  const fetch = async url => ({ text: async () => url.includes("type=list") ? '<track lang_code="en"/>' : "<transcript><text start=\"0\">Photosynthesis uses sunlight, water, and carbon dioxide to help plants produce glucose and oxygen.</text></transcript>" });
  const processor = createProcessor({ ai, fetch });
  const result = await processor.processSources({ urls: ["https://youtu.be/abc123"] });
  assert.match(result.items[0].citations[0].text, /Photosynthesis uses sunlight/);
  assert.equal(result.items[0].citations[0].location, "YouTube captions");
});

test("direct image links are fetched and analyzed", async () => {
  const fetch = async () => ({
    ok: true,
    headers: new Map([["content-type", "image/png"], ["content-length", "5"]]),
    arrayBuffer: async () => Buffer.from("image")
  });
  const processor = createProcessor({ ai, fetch });
  const result = await processor.processSources({ urls: ["https://example.com/cycle.png"] });
  assert.match(result.items[0].citations[0].text, /evaporation and condensation/);
  assert.equal(result.items[0].kind, "image");
});

test("direct video links are fetched and processed", async () => {
  const fetch = async () => ({
    ok: true,
    headers: new Map([["content-type", "video/mp4"], ["content-length", "5"]]),
    arrayBuffer: async () => Buffer.from("video")
  });
  const processor = createProcessor({
    ai,
    fetch,
    commandExists: async () => true,
    execFile: async (_command, args) => {
      const output = args.at(-1);
      if (output.endsWith(".mp3")) await import("node:fs/promises").then(fs => fs.writeFile(output, "audio"));
      if (output.endsWith(".jpg")) await import("node:fs/promises").then(fs => fs.writeFile(output, "frame"));
    }
  });
  const result = await processor.processSources({ urls: ["https://example.com/lesson.mp4"] });
  assert.match(result.items[0].citations[0].text, /carrying capacity/);
  assert.equal(result.items[0].kind, "video");
});

test("documents use extraction with structure and page references", async () => {
  const processor = createProcessor({ ai });
  const result = await processor.processSources({ files: [{ name: "ecosystems.pdf", type: "application/pdf", buffer: Buffer.from("pdf") }] });
  assert.match(result.items[0].citations[0].text, /Page 2 heading/);
});

test("fails when no usable source content is available", async () => {
  const processor = createProcessor({ ai: { analyzeVisual: async () => "short" } });
  await assert.rejects(() => processor.processSources({ files: [{ name: "blank.png", type: "image/png", buffer: Buffer.from("image") }] }), SourceError);
});

test("prompt construction grounds output in extracted source instead of topic", () => {
  const prompt = buildGroundedPrompt({ items: [{ citations: [{ source: "lesson.pdf", location: "page 3", text: "Mitosis creates two genetically identical daughter cells." }] }] }, { subject: "Science", instructions: "Make it challenging" });
  assert.match(prompt, /lesson\.pdf \| page 3/);
  assert.match(prompt, /Mitosis creates two genetically identical/);
  assert.match(prompt, /Use ONLY the SOURCE PACKAGE/);
  assert.match(prompt, /Make it challenging/);
});

test("grounded generation contract requests cited flashcards and quiz items", () => {
  const prompt = buildGroundedPrompt({ items: [{ citations: [{ source: "image.png", location: "diagram label", text: "The diagram labels the nucleus as the control center." }] }] });
  assert.match(prompt, /flashcards is an array of \{question,answer,citations\}/);
  assert.match(prompt, /quiz is an array of \{question,options,answer,citations\}/);
  assert.match(prompt, /Do not add facts that are absent/);
});

test("accepts grounded reviewer, flashcard, and quiz generation", () => {
  const sourcePackage = { items: [{ citations: [{ source: "lesson.pdf", location: "page 1", text: "A population is a group of organisms of the same species." }] }] };
  const citation = [{ source: "lesson.pdf", location: "page 1" }];
  const materials = { reviewer: [{ heading: "Population", body: "A population is a group of organisms.", citations: citation }], flashcards: [{ question: "What is a population?", answer: "A group of organisms of the same species.", citations: citation }], quiz: [{ question: "Which defines population?", options: ["A group of one species", "A habitat"], answer: "A group of one species", citations: citation }] };
  assert.equal(assertGroundedMaterials(materials, sourcePackage), materials);
});

test("rejects quiz or flashcard claims with unsupported citations", () => {
  const sourcePackage = { items: [{ citations: [{ source: "lesson.pdf", location: "page 1", text: "Supported source text." }] }] };
  const unsupported = [{ source: "internet", location: "unknown" }];
  assert.throws(() => assertGroundedMaterials({ reviewer: [{ citations: unsupported }], flashcards: [{ citations: unsupported }], quiz: [{ citations: unsupported }] }, sourcePackage), SourceError);
});

test("chunks long extracted sources while preserving references", () => {
  const chunks = chunkSourcePackage({ items: [{ citations: [{ source: "large.pdf", location: "page 1", text: "x".repeat(25000) }] }] }).items[0].citations;
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].location, "page 1, chunk 1");
});
