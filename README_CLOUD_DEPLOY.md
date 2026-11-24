# Deploy PYQ to the cloud (GitHub + Render)

## A. Upload source to GitHub
1. Download and extract the PYQ ZIP.
2. Open your `PYQ_Finder_1` repository.
3. Choose **Add file → Upload files**.
4. Upload the contents of the extracted `PYQ` folder (not the ZIP itself). Ensure `package.json`, `server.js`, `public/`, `data/`, and `.env.example` are at repository root.
5. Commit to `main`.

## B. Create the Render service
1. Sign in to https://render.com.
2. Choose **New → Web Service**.
3. Connect GitHub and select `Naveen1234444/PYQ_Finder_1`.
4. Use:
   - Runtime: Node
   - Branch: `main`
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check path: `/api/health`
5. Choose a plan that supports a persistent disk if you want the server-side library metadata to survive restarts/deploys.
6. Add a persistent disk:
   - Mount path: `/var/data`
   - Size: start with 1 GB (adjust to your needs)
7. In **Environment**, add:
   - `OPENAI_API_KEY` = your secret API key
   - `OPENAI_MODEL` = a model ID enabled for your OpenAI API project
   - `DATA_DIR` = `/var/data`
   - `MAX_FILE_MB` = `50`
8. Save and deploy. Never commit your real API key to GitHub or put it in browser code.

Render supports Node/Express web services, environment variables, and persistent disks. The service must listen on `0.0.0.0` and the `PORT` environment variable; this code does that.

## C. Test after deployment
1. Open the Render URL, e.g. `https://your-service.onrender.com`.
2. Check `https://your-service.onrender.com/api/health`. It should show `ok: true` and `aiConfigured: true`.
3. In PYQ, open **AI Study Assistant**.
4. Upload one small, non-sensitive PDF first.
5. Ask a question that can be answered from that PDF and check the returned source list.

## Billing and privacy
- ChatGPT subscription and API billing are separate. API requests and vector-store storage may incur charges.
- Set usage limits/budget alerts in the OpenAI platform.
- Never share your API key in chat, screenshots, GitHub, or the browser.
- Upload only PDFs you have rights to use.
- PDF OCR, scanned pages, diagrams and tables need manual checking.
- Current implementation is a personal single-library prototype, not a multi-user authenticated product. Do not expose it publicly to other users until authentication, upload quotas, rate limiting and access controls are added.
