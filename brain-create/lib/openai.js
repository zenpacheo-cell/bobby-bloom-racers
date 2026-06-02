import { SourceError } from "./materials.js";

const apiKey = () => process.env.OPENAI_API_KEY;
const model = () => process.env.OPENAI_MODEL || "gpt-5-mini";

async function request(path, options) {
  if (!apiKey()) throw new SourceError("The server is missing OPENAI_API_KEY. Add it before processing lesson materials.", 503);
  const response = await fetch(`https://api.openai.com/v1${path}`, { ...options, headers: { Authorization: `Bearer ${apiKey()}`, ...options.headers } });
  if (!response.ok) throw new SourceError(`AI processing failed (${response.status}). Please try again or upload a different source.`, 502);
  return response.json();
}

const outputText = response => response.output?.flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text).join("\n") || response.output_text || "";

export const openai = {
  async analyzeVisual(imageUrl, prompt) {
    return outputText(await request("/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model(), input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageUrl, detail: "high" }] }] }) }));
  },
  async analyzeFile(file, prompt) {
    return outputText(await request("/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model(), input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_file", filename: file.name, file_data: `data:${file.type || "application/octet-stream"};base64,${file.buffer.toString("base64")}` }] }] }) }));
  },
  async transcribe(buffer, filename) {
    const form = new FormData();
    form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
    form.append("file", new Blob([buffer]), filename);
    const response = await request("/audio/transcriptions", { method: "POST", body: form });
    return response.text;
  },
  async generate(prompt) {
    const response = await request("/responses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model(), input: prompt, text: { format: { type: "json_object" } } }) });
    const text = outputText(response);
    try { return JSON.parse(text); } catch { throw new SourceError("The AI returned an invalid study-material response. Please try again.", 502); }
  }
};
