# Windows CMD setup — ClearSkies

## Requirements

- Windows 10 or 11
- Node.js 20+ (Node.js 22 recommended)
- Internet connection for live CAMS model lookups
- Gemini key is optional

## Start the application

1. Extract the ZIP file.
2. Open **Command Prompt**.
3. Change directory to the extracted project folder (the folder containing `package.json`).

```bat
cd /d C:\Users\Admin\Desktop\ClearSkies-AI
node --version
npm --version
npm ci
copy .env.example .env
notepad .env
npm start
```

If you do not want to configure Gemini, leave `GEMINI_API_KEY=` blank. The deterministic assistant works without a key. The `.env` file is optional; you can also skip the copy and Notepad steps.

Open:

```text
http://127.0.0.1:3000
```

Stop the server with `Ctrl+C`.

## Validate the release

Run these commands from the project folder:

```bat
npm test
npm run check
npm run smoke
```

Expected v2.2.1 test suite: 89 tests, all passing (verify using the output from your exact release).

## Optional Gemini configuration

Edit `.env` locally and set:

```dotenv
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Do not paste the key into chat, frontend files, screenshots, GitHub commits or public issue reports. Restart the server after changing `.env`.

## Troubleshooting

- `'node' is not recognized`: install Node.js LTS, close and reopen Command Prompt, then retry `node --version`.
- `EADDRINUSE` / port 3000 already in use: close the other server process or change `PORT` in `.env`.
- Air data unavailable: retry later; the model provider may be temporarily unavailable. Demo data is explicitly labelled and is not real AQI.
- Gemini unavailable: the local deterministic assistant should continue to work.
