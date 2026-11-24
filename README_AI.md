# PYQ with ChatGPT PDF assistant

This version adds a backend-powered AI Study Assistant to the existing PYQ app.

## Architecture
- Browser: existing PYQ question search/practice app plus PDF upload and chat screen.
- Server: Node.js + Express. Holds the OpenAI API key and accepts PDF uploads.
- Knowledge base: OpenAI vector store with hosted file search (semantic + keyword retrieval).
- Chat: OpenAI Responses API with `file_search`; the assistant is instructed not to invent source facts.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add an OpenAI API key and an API model ID enabled for your API project to `.env`.
5. Run `npm start`.
6. Open `http://localhost:3000`.

## Important
- ChatGPT subscription and OpenAI API billing are separate. API use may incur charges.
- Never put the API key in `index.html`, GitHub, or client-side JavaScript.
- PDF indexing uses OpenAI vector stores and file search. Vector-store storage and model usage may incur charges.
- A single request's direct PDF input limits are not the same as vector-store ingestion; check current API limits and pricing for your project.
- This starter stores vector-store ID and uploaded-file metadata in `server-data/config.json` on the server. Back up that directory. The actual indexed files are held in the OpenAI vector store.
- LocalStorage in the browser still holds the manually imported PYQ JSON bank; it is not yet synced to a user account.
- Do not upload copyrighted books or restricted documents unless you have the right to use them.
- OCR/scanned PDFs and tables/figures should be checked against the original pages. File search may not perfectly parse every scan or layout.
- The app must be deployed with a persistent backend and secure environment variables. GitHub Pages alone cannot run this Node backend.
