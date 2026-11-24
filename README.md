# PYQ — UPSC Previous Year Questions

A browser-based UPSC Prelims PYQ workspace. This first version is a static web app and can be hosted on GitHub Pages.

## Run locally
Open `index.html` in a modern browser. PDF extraction and OCR use CDN libraries and therefore require an internet connection.

## Deploy on GitHub Pages
1. Create/open your GitHub repository.
2. Upload `index.html` and the `data/` folder (or upload the contents of this ZIP).
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main`, folder `/ (root)`, then Save.
6. Open the published Pages URL after deployment completes.

## Import format
Import a JSON array of records. Each record should include:
- `year`, `paper`, `question_number`
- `subject`, `topic`, `subtopic`
- `question`
- `options`: object with keys `A`, `B`, `C`, `D`
- `answer`: `A`, `B`, `C`, or `D`
- `explanation`, `source`, `tags`

Example is in `data/question-template.json`.

## Current capabilities
- Search question text, subject, topic, subtopic, tags and explanations
- Filter by year, subject and topic
- Question cards with four options, answer reveal and explanation
- Bookmark and revision list
- Topic/subject-based randomized practice tests
- Timed and untimed practice
- Scoring: +2 correct, −2/3 incorrect, 0 unanswered (editable in `index.html`)
- Attempt history and accuracy summary
- JSON/CSV import and JSON export
- PDF text extraction; OCR for scanned pages when Tesseract loads

## Important data integrity notes
- The app does not invent questions or answers. Start with your supplied UPSC PDFs and official answer keys.
- OCR output must be checked against the original PDF. OCR is extraction, not verification.
- Correct answers should be matched to the official answer key before import.
- Browser storage is local to that browser/device. Export backups regularly; cross-device sync and user accounts are not included in this first version.
- Search is text/tag based. Semantic concept matching and automated topic classification are planned for a later backend-powered version.
