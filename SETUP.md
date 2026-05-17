# RepoTalk Setup Guide

## Prerequisites

### Required Software
- **Node.js** 18.x or higher
- **npm** 9.x or higher (comes with Node.js)
- **Git** (for cloning the repository)
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)

### Optional
- **GitHub Account** (for OAuth and private repository access)

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd RepoTalk
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# This will install:
# - express (^4.21.2) - Web framework
# - express-session (^1.18.1) - Session management
# - dotenv (^16.4.7) - Environment variable management
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# GitHub OAuth (optional - only needed for private repos)
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# Server Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your_random_secret_key_here

# Frontend URL (for OAuth callback)
FRONTEND_URL=http://localhost:3000
```

### 4. GitHub OAuth Setup (Optional)

If you want to access private repositories:

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: RepoTalk (or your choice)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/github/callback`
4. Click "Register application"
5. Copy the **Client ID** and **Client Secret** to your `.env` file

### 5. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start at http://localhost:3000

### 6. Access the Application

Open your browser and navigate to:
- **Main Dashboard**: http://localhost:3000/index.html
- **Analysis Page**: http://localhost:3000/analysis.html

## Project Structure

```
RepoTalk/
├── backend/
│   ├── src/
│   │   ├── server.js           # Express server setup
│   │   ├── config.js           # Configuration management
│   │   ├── github.js           # GitHub API wrapper
│   │   ├── analyzer.js         # Repository analysis engine
│   │   ├── middleware/
│   │   │   └── requireAuth.js  # Authentication middleware
│   │   └── routes/
│   │       ├── auth.js         # OAuth routes
│   │       ├── github.js       # GitHub API routes
│   │       └── analyze.js      # Analysis API routes
│   ├── package.json            # Backend dependencies
│   └── package-lock.json
├── frontend/
│   ├── index.html              # Landing page
│   ├── analysis.html           # Repository analysis UI
│   ├── css/
│   │   └── styles.css          # All styles
│   └── js/
│       ├── config.js           # Frontend configuration
│       ├── auth.js             # OAuth client logic
│       ├── script.js           # Landing page scripts
│       └── analysis.js         # Analysis page logic
├── .env.example                # Environment template
├── .gitignore
├── README.md
├── ANALYSIS_FEATURE.md         # Analysis feature docs
└── SETUP.md                    # This file
```

## Dependencies

### Backend (Node.js)

All dependencies are managed via npm and listed in `backend/package.json`:

```json
{
  "dependencies": {
    "dotenv": "^16.4.7",        // Environment variables
    "express": "^4.21.2",       // Web framework
    "express-session": "^1.18.1" // Session management
  }
}
```

### Frontend

No build process required! The frontend uses:
- Vanilla JavaScript (ES6+)
- Native Fetch API
- CSS3 with custom properties
- Google Fonts (Inter, JetBrains Mono)

## Usage

### Analyzing Public Repositories

1. Open http://localhost:3000/analysis.html
2. Enter a GitHub repository URL (e.g., `facebook/react`)
3. Click "Analyze Repository"
4. Select your target audience
5. View the generated document

### Analyzing Private Repositories

1. Click "Connect GitHub" button
2. Authorize the application
3. Select a repository from your list
4. Follow steps 4-5 above

### Available Audiences

- 👔 **CEO / C-Level** - Business overview and strategic insights
- 📊 **Product Manager** - Features and market analysis
- ⚙️ **Engineering Manager** - Technical stack and practices
- 💻 **Software Engineer** - Code structure and setup
- 🎨 **Designer** - UI/UX and design system
- 🎓 **Beginner / Intern** - Simple explanations
- 💰 **Investor** - Market validation and ROI

## Troubleshooting

### Port Already in Use

If port 3000 is already in use:

```bash
# Change PORT in .env file
PORT=3001

# Or kill the process using port 3000
# On macOS/Linux:
lsof -ti:3000 | xargs kill -9

# On Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### GitHub OAuth Not Working

1. Verify your `.env` file has correct credentials
2. Check callback URL matches: `http://localhost:3000/api/auth/github/callback`
3. Ensure your GitHub OAuth app is not suspended
4. Clear browser cookies and try again

### Analysis Fails

1. **Rate Limit**: GitHub API has rate limits
   - Unauthenticated: 60 requests/hour
   - Authenticated: 5,000 requests/hour
   - Solution: Connect GitHub or wait for rate limit reset

2. **Repository Not Found**: Verify the repository exists and is public (or you have access)

3. **Network Error**: Check your internet connection

### Module Not Found Errors

```bash
# Reinstall dependencies
cd backend
rm -rf node_modules package-lock.json
npm install
```

## Development

### Running in Development Mode

```bash
cd backend
npm run dev
```

This uses Node.js `--watch` flag for automatic restart on file changes.

### Making Changes

1. **Backend changes**: Server auto-restarts in dev mode
2. **Frontend changes**: Just refresh the browser
3. **CSS changes**: Refresh browser (no build step needed)

### Adding New Features

See [ANALYSIS_FEATURE.md](ANALYSIS_FEATURE.md) for details on the analysis system architecture.

## Production Deployment

### Environment Variables

Update `.env` for production:

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
SESSION_SECRET=<strong-random-secret>
```

### Security Considerations

1. Use HTTPS in production
2. Set secure session cookies
3. Implement rate limiting
4. Add CORS configuration
5. Use environment-specific secrets
6. Consider Redis for session storage

### Deployment Options

- **Heroku**: Add `Procfile` with `web: node backend/src/server.js`
- **Vercel**: Configure as Node.js project
- **AWS/GCP/Azure**: Use container or VM deployment
- **Docker**: Create Dockerfile for containerization

## API Rate Limits

### GitHub API Limits

- **Unauthenticated**: 60 requests/hour per IP
- **Authenticated**: 5,000 requests/hour per user
- **Search API**: 10 requests/minute (authenticated)

### Best Practices

1. Connect GitHub for higher limits
2. Cache analysis results
3. Implement request throttling
4. Show rate limit status to users

## Support

For issues or questions:
1. Check this setup guide
2. Review [README.md](README.md)
3. Check [ANALYSIS_FEATURE.md](ANALYSIS_FEATURE.md)
4. Open an issue in the repository

## License

See LICENSE file in the repository.