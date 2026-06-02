const processingStatus = document.querySelector("#processingStatus");
const fileInput = document.querySelector("#fileInput");
const stageLabels = ["uploading", "extracting text", "transcribing audio", "analyzing visuals", "generating study materials", "completed", "failed"];

function showStatus(stage, detail = "") {
  processingStatus.classList.remove("hidden");
  processingStatus.innerHTML = `<p class="eyebrow">Processing status</p><div class="status-track">${stageLabels.map(label => `<span class="${label === stage ? "active" : ""}">${label}</span>`).join("")}</div>${detail ? `<small>${detail}</small>` : ""}`;
}

function sourceList(sourcePackage) {
  return sourcePackage.items.map(item => ({ label: item.name }));
}

function groundedCards(materials) {
  return (materials.flashcards || []).map(card => [card.question, `${card.answer}${card.citations?.length ? ` [${card.citations.map(c => `${c.source}: ${c.location}`).join("; ")}]` : ""}`]);
}

document.addEventListener("click", async event => {
  const button = event.target.closest('button[data-action="generate"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const urls = lessonLinks.map(link => link.href);
  const files = [...fileInput.files];
  if (!files.length && !urls.length) {
    toast("Add a lesson file or link before generating.");
    step(2);
    return;
  }
  button.disabled = true;
  try {
    showStatus("uploading", "Sending your lesson source securely...");
    const form = new FormData();
    files.forEach(file => form.append("files", file));
    form.append("urls", JSON.stringify(urls));
    form.append("grade", String(selectedGrade));
    form.append("subject", subject(selectedSubject)[1]);
    form.append("instructions", document.querySelector("#studyInstructions").value.trim());
    setTimeout(() => showStatus("extracting text", "Reading source content and preserving useful references..."), 300);
    const response = await fetch("/api/generate", { method: "POST", body: form });
    const type = response.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw new Error("Brain Create's processing server is not running. Start it with: node server.js");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Processing failed.");
    showStatus("generating study materials", "Creating grounded reviewer notes, flashcards, and quiz questions...");
    const cards = groundedCards(result.materials);
    if (!cards.length) throw new Error("The processed source did not support any flashcards. Please add a clearer source.");
    const id = `set-${Date.now()}`;
    sets.unshift({ id, title: result.materials.title || `${subject(selectedSubject)[1]} Source Review`, subject: selectedSubject, grade: selectedGrade, count: cards.length, progress: 0, sources: sourceList(result.sourcePackage), cards, reviewer: result.materials.reviewer, quiz: result.materials.quiz });
    renderSets();
    showStatus("completed", "Your grounded study set is ready.");
    toast("Study tools generated from your uploaded source.");
    startStudy(id, selectedMode);
  } catch (error) {
    showStatus("failed", error.message);
    toast(error.message);
    step(2);
  } finally {
    button.disabled = false;
  }
}, true);
