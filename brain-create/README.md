# Brain Create

Brain Create turns submitted lesson sources into grounded reviewer notes, flashcards, and quiz questions.

## Requirements

- Node.js 20+
- `OPENAI_API_KEY`
- Optional: `ffmpeg` for uploaded-video audio extraction and sampled-frame analysis

## Run locally

```bash
set OPENAI_API_KEY=your-server-side-key
npm start
```

Then open `http://localhost:4174/brain-create/`.

The API key stays on the server and is never sent to the browser.

## Test

```bash
node --test
```

## Source processing

- Images: vision analysis extracts readable text, tables, labels, diagrams, and visual details.
- Documents: plain text files are read directly. PDFs, presentations, and Word files are sent for structured extraction and OCR where needed.
- Uploaded videos: the server uses `ffmpeg` to extract audio and sample frames, then combines transcription and visual analysis.
- YouTube links: the server uses accessible captions. Videos without accessible captions return a clear error.

Generated materials must use the processed source package. Unsupported or insufficient sources return an error instead of generic subject content.
