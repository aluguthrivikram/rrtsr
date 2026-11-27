# GitHub upload and Node deployment

## Safe GitHub update

The supplied release ZIP does not contain `.git` history. The current GitHub branch and working tree were not inspected in this run, so do not overwrite an existing working directory blindly.

1. Make a backup of your current local repository.
2. Open Command Prompt in your existing repository.
3. Inspect your current state:

```bat
git status
git branch --show-current
git remote -v
```

4. If you have uncommitted work, commit it or make a separate backup before proceeding.
5. Create a new branch (choose a different name if this one already exists):

```bat
git switch -c promptwars-household-twin
```

6. Copy the contents of this release folder into the repository root, reviewing any same-name file replacements.
7. Review every change and run the checks:

```bat
git status
git diff --check
npm ci
npm test
npm run check
npm run smoke
```

8. Stage and commit:

```bat
git add .
git diff --cached --stat
git diff --cached
git commit -m "Add household pollution digital twin"
git push -u origin promptwars-household-twin
```

9. Open GitHub and create a Pull Request from `promptwars-household-twin` into the intended target branch. Review the file list and CI results before merging.

Never use `git push --force` for this update. Do not add `.env`, `node_modules`, `.git`, coverage output or secrets.

## Node-compatible deployment

ClearSkies needs its Node server for `/api/health`, `/api/air-quality` and `/api/assistant`; it is not a static-only website.

- Runtime: Node.js 20+ (Node 22 recommended)
- Install/build command: `npm ci && npm test && npm run check`
- Start command: `npm start`
- Health check: `/api/health`
- Host: set `HOST=0.0.0.0` if required by the platform
- Port: use the platform-provided `PORT`
- Optional secret: configure `GEMINI_API_KEY` only as a server-side environment secret
- Optional model: `GEMINI_MODEL=gemini-2.5-flash`

Use HTTPS provided by the hosting platform or a correctly configured reverse proxy. GitHub Pages cannot host the Node API routes. No deployment was performed as part of this source ZIP upgrade.
