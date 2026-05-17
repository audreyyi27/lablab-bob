# RepoTalk Backend

Express server for GitHub OAuth and authenticated GitHub API proxying.

## Security

- `GITHUB_CLIENT_SECRET` is read from the environment only — never sent to the browser.
- OAuth authorization codes are exchanged for access tokens on the server.
- Access tokens are stored in an HTTP-only session cookie, not in `localStorage`.

## Setup

1. Create a [GitHub OAuth App](https://github.com/settings/developers):
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/github/callback`

2. Copy environment variables:

```bash
cp ../.env.example ../.env
# Edit ../.env with your Client ID and Client Secret
```

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000/analysis.html](http://localhost:3000/analysis.html).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/github/login` | Redirect to GitHub authorization |
| GET | `/api/auth/github/callback` | OAuth callback (GitHub → server) |
| GET | `/api/auth/session` | Current login state |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/repos` | List repositories for the signed-in user |
| GET | `/api/github/repos/:owner/:repo` | Repo metadata + file tree (auth required) |
| GET | `/api/github/repos/:owner/:repo/contents/*` | File contents (auth required) |

Public repositories can still be analyzed by URL without signing in (browser → GitHub API directly).
