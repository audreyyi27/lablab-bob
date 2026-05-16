
# RepoTalk - AI-Powered Repository Interpreter

A functional GitHub repository reader that allows users to explore public GitHub repositories through a modern, intuitive interface.

![RepoTalk](https://img.shields.io/badge/Status-Functional-brightgreen)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)

## 🎯 Overview

RepoTalk is an AI-powered repository interpreter that transforms GitHub repository URLs into structured, easy-to-understand information. The first functional step includes a complete GitHub repository reader with real-time data fetching and visualization.

## ✨ Current Features

### Core Functionality
- **URL Input**: Paste any public GitHub repository URL
- **URL Validation**: Automatically validates and extracts owner/repo information
- **Repository Information Display**:
  - Repository name and link
  - Star count
  - Fork count
  - Last updated date
  - Description
  - Primary language
  - License information
- **File Structure Visualization**: Complete repository file tree with:
  - Folders and files organized hierarchically
  - File type icons (emojis)
  - Expandable structure
  - File count

### Design Features
- **Modern Dark Theme**: Sophisticated dark UI with purple/blue gradients
- **Glassmorphism Effects**: Frosted glass cards with backdrop blur
- **Smooth Animations**: Loading states, transitions, and entrance animations
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Error Handling**: Clear error messages for invalid URLs or API issues

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (for the backend server and GitHub OAuth)
- Modern web browser
- A [GitHub OAuth App](https://github.com/settings/developers) for “Connect GitHub” (optional for public URL-only analysis)

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
3. In GitHub OAuth app settings, set callback URL to `http://localhost:3000/api/auth/github/callback`
4. Start the server:

```bash
cd backend
npm install
npm run dev
```

5. Open [http://localhost:3000/analysis.html](http://localhost:3000/analysis.html)

**Public repos only (no OAuth):** you can still open `frontend/analysis.html` via a static server; analysis uses the public GitHub API from the browser (lower rate limits, no private repos).

### Usage

1. **Connect GitHub (optional):** Click **Connect GitHub**, authorize RepoTalk, then pick a repository from your list (includes private repos you can access)
2. **Or enter a GitHub URL**: Paste a public GitHub repository URL in the input field
   - Format: `https://github.com/owner/repository`
   - Also accepts: `owner/repository`

3. **Click "Analyze Repository"** or press Enter

4. **View Results**:
   - Repository information card with stats
   - Complete file structure tree

### Example URLs to Try

```
https://github.com/facebook/react
https://github.com/microsoft/vscode
https://github.com/torvalds/linux
https://github.com/nodejs/node
```

## 📁 Project Structure

```
RepoTalk/
├── frontend/
│   ├── index.html       # Landing page
│   ├── analysis.html    # Repository analysis UI
│   ├── css/
│   │   └── styles.css   # Styles, animations, responsive layout
│   └── js/
│       ├── script.js    # Landing page interactions
│       └── analysis.js  # GitHub API integration and file preview
├── backend/             # Express API, OAuth, GitHub proxy
│   ├── src/
│   └── package.json
├── .env.example         # GitHub OAuth credentials (copy to .env)
├── .vscode/
│   └── launch.json      # Debug: open frontend/index.html
└── README.md
```

## 🎨 Design System

### Color Palette
- **Background**: `#0a0a0f` (Primary), `#13131a` (Secondary)
- **Purple**: `#8B5CF6` (Primary brand color)
- **Blue**: `#3B82F6` (Secondary accent)
- **Text**: White with varying opacity levels

### Typography
- **Primary Font**: Inter (Sans-serif)
- **Code Font**: JetBrains Mono (Monospace)

## 🔧 Technical Details

### GitHub API Integration
- **Without login:** browser calls GitHub REST API directly (60 req/hr unauthenticated)
- **With OAuth:** backend proxies GitHub API using your token (5,000 req/hr); client secret never leaves the server
- OAuth scopes: `repo` (read private repos), `read:user`
- Endpoints used:
  - `/repos/{owner}/{repo}` - Repository information
  - `/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` - File tree

### URL Validation
Supports multiple URL formats:
- `https://github.com/owner/repo`
- `http://github.com/owner/repo`
- `github.com/owner/repo`
- `owner/repo`

### Error Handling
- Invalid URL format detection
- Repository not found (404)
- API rate limit exceeded (403)
- Network errors
- Branch fallback (tries 'main' then 'master')

## 🎭 Features Breakdown

### Repository Information Card
- **Full Name**: owner/repository format
- **Direct Link**: Opens repository on GitHub
- **Statistics**:
  - ⭐ Stars (formatted: 1.5k, 2.3k, etc.)
  - 🍴 Forks
  - 🕐 Last Updated (relative time)
- **Metadata**:
  - Description
  - Primary programming language
- AI pulse indicator
- Processing status updates
- Activity feed updates
- Stat increments

## 📱 Responsive Design

The dashboard is fully responsive with breakpoints at:
- **Desktop**: 1400px+ (Full layout)
- **Tablet**: 1024px - 1399px (Adjusted grid)
- **Mobile**: < 1024px (Stacked layout)

## 🎯 Target Audiences

The dashboard supports analysis tailored for:
1. **CEOs** - High-level business insights
2. **Product Managers** - Feature and roadmap analysis
3. **Designers** - UI/UX and design system insights
4. **Engineers** - Technical architecture details
5. **Beginners** - Simplified explanations
6. **Investors** - Business value and metrics

## 🔧 Customization

### Changing Colors
Edit CSS variables in `frontend/css/styles.css`:
```css
:root {
    --purple-500: #8B5CF6;
    --blue-500: #3B82F6;
    /* Add your colors */
}
```

### Adding New Stats
Add a new stat card in `frontend/index.html`:
```html
<div class="stat-card">
    <div class="stat-header">
        <div class="stat-icon purple">
            <!-- Your icon SVG -->
        </div>
        <span class="stat-trend positive">+X%</span>
    </div>
    <div class="stat-value">XXX</div>
    <div class="stat-label">Your Label</div>
</div>
```

## 🚧 Future Enhancements

- [x] Backend integration
- [x] GitHub OAuth login
- [ ] Persistent session store (Redis) for production
- [ ] Advanced search functionality
- [ ] Export reports feature
- [ ] Team collaboration tools
- [ ] Dark/Light theme toggle
- [ ] Customizable dashboard layouts

## 📄 License

This is a demo project created for hackathon purposes.

## 🤝 Contributing

This is a demo project, but suggestions and improvements are welcome!

## 📞 Support

For questions or feedback about RepoTalk Dashboard, please open an issue in the repository.

---

**Built with ❤️ for the developer community**

*Designed to impress at hackathons and showcase modern UI/UX capabilities*# lablab-bob
