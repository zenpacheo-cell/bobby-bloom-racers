# Bobby Bloom Racers

A girly pixel-art kart racing website game built as a static Vercel-ready app.

## Play locally

Open `index.html` in a browser, or run a simple static server:

```bash
npx serve .
```

## Run Brain Create locally

Brain Create needs the Node server because uploads and lesson links are processed through `/api/generate`.

```bash
set OPENAI_API_KEY=your-server-side-key
npm start
```

Then open `http://localhost:4174/brain-create/`.

## Deploy on Vercel

Import this folder as a Vercel project. No build command is required because the game is static HTML, CSS, and JavaScript.
