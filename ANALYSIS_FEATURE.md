# Repository Analysis Feature

## Overview

RepoTalk now includes advanced repository-level analysis with audience-specific document generation. This feature transforms GitHub repositories into clear, tailored explanations for different stakeholders.

## Features

### 1. Intelligent Repository Analysis

The system automatically:
- **Identifies important files** (README, package.json, Dockerfile, etc.)
- **Detects technologies and frameworks** from file structure and extensions
- **Analyzes architecture patterns** (frontend/backend separation, monorepo, testing, CI/CD)
- **Reads key files** to extract project information
- **Understands project purpose** from README and metadata

### 2. Audience-Specific Document Generation

Generate tailored documentation for 7 different audiences:

#### 👔 CEO / C-Level
- Business overview and strategic value
- Key metrics and market position
- ROI and investment recommendations
- High-level technology assessment

#### 📊 Product Manager
- Product overview and features
- Architecture and capabilities
- Market traction and adoption
- Roadmap insights and recommendations

#### ⚙️ Engineering Manager
- Technical stack details
- Architecture assessment
- Engineering practices (testing, CI/CD, Docker)
- Team collaboration metrics
- Technical recommendations

#### 💻 Software Engineer
- Complete tech stack breakdown
- Project structure and setup instructions
- Development workflow
- Testing and deployment details
- Code organization

#### 🎨 Designer
- UI/UX component overview
- Design system information
- Asset locations
- Frontend technologies
- Design collaboration workflow

#### 🎓 Beginner / Intern
- Simple, jargon-free explanations
- Learning opportunities
- Step-by-step getting started guide
- Technology introductions
- Encouragement and resources

#### 💰 Investor
- Executive summary
- Market validation metrics
- Technology risk assessment
- Business model potential
- Investment recommendation with risk analysis

## How It Works

### Backend Analysis Engine (`backend/src/analyzer.js`)

1. **File Identification**: Scans repository tree for important files
2. **Technology Detection**: Analyzes file extensions and patterns
3. **Architecture Analysis**: Identifies project structure and patterns
4. **Content Reading**: Fetches and parses key files (README, configs)
5. **Document Generation**: Creates audience-specific narratives

### API Endpoints (`backend/src/routes/analyze.js`)

- `POST /api/analyze` - Authenticated analysis (private repos)
- `POST /api/analyze/public` - Public analysis (no auth required)

Request body:
```json
{
  "owner": "facebook",
  "repo": "react",
  "audience": "software_engineer"
}
```

Response:
```json
{
  "success": true,
  "analysis": {
    "technologies": ["JavaScript", "TypeScript"],
    "frameworks": ["React"],
    "tools": ["Jest", "Webpack"],
    "architecture": {
      "hasBackend": false,
      "hasFrontend": true,
      "hasTests": true,
      "hasCI": true,
      "hasDocker": true
    },
    "importantFiles": [...]
  },
  "document": {
    "title": "Technical Deep Dive: React",
    "sections": [...]
  },
  "metadata": {
    "owner": "facebook",
    "repo": "react",
    "audience": "software_engineer",
    "analyzedAt": "2026-05-16T06:00:00.000Z"
  }
}
```

### Frontend UI (`frontend/analysis.html`)

After analyzing a repository:
1. **Analysis Panel** appears with 7 audience buttons
2. Click an audience to generate their document
3. **Loading state** shows while analyzing
4. **Document display** renders the generated content
5. **Export button** downloads as text file
6. **Change audience** button to try different perspectives

## Usage

### 1. Analyze a Repository

```bash
# Start the backend server
cd backend
npm install
npm run dev
```

Open http://localhost:3000/analysis.html

### 2. Enter Repository URL

Enter any public GitHub repository:
- `facebook/react`
- `microsoft/vscode`
- `nodejs/node`

Or connect GitHub to access private repositories.

### 3. Select Audience

After the repository loads, click "Analyze Repository" to see the analysis panel, then choose your target audience.

### 4. View Generated Document

The system will:
- Analyze the repository structure
- Read important files
- Detect technologies
- Generate a tailored document
- Display formatted content

### 5. Export Document

Click "Export" to download the analysis as a text file.

## Technology Detection

The analyzer automatically detects:

### Languages
- JavaScript, TypeScript, Python, Java, Go, Rust, Ruby, PHP, C/C++, Swift, Kotlin

### Frontend Frameworks
- React, Vue.js, Angular, Svelte, Next.js, Nuxt.js, Gatsby

### Backend Frameworks
- Django, Flask, FastAPI, Ruby on Rails, Spring Boot, Express

### Databases
- PostgreSQL, MySQL, MongoDB, Redis, Prisma, Sequelize

### DevOps Tools
- Docker, Kubernetes, GitHub Actions, GitLab CI, Terraform

### Testing Tools
- Jest, Pytest, Cypress

### Build Tools
- Webpack, Vite, Rollup

## Architecture Patterns

The analyzer identifies:
- **Frontend/Backend separation**
- **Monorepo structure**
- **Database integration**
- **Test coverage**
- **CI/CD pipelines**
- **Containerization**
- **Documentation**

## Document Formatting

Generated documents include:
- **Markdown-style formatting** (bold, code, lists)
- **Emoji icons** for visual appeal
- **Structured sections** with clear headings
- **Actionable recommendations**
- **Relevant metrics and statistics**

## API Rate Limits

- **Unauthenticated**: 60 requests/hour (GitHub API limit)
- **Authenticated**: 5,000 requests/hour (with GitHub OAuth)

## Error Handling

The system handles:
- Repository not found (404)
- Rate limit exceeded (403)
- Network errors
- Invalid audience selection
- Missing file content
- Large files (>1MB)

## Future Enhancements

- [ ] AI-powered analysis using LLMs
- [ ] Custom audience templates
- [ ] Multi-language document generation
- [ ] PDF export with styling
- [ ] Comparison between repositories
- [ ] Historical analysis tracking
- [ ] Team collaboration features
- [ ] Integration with project management tools

## Examples

### CEO Document for React
```
Executive Summary: React

🎯 Business Overview
A JavaScript library for building user interfaces...
This public repository has attracted 220,000 stars...

💼 Strategic Value
Technology Stack: JavaScript, TypeScript
Key Capabilities:
• Component-based architecture
• Virtual DOM for performance
• Large ecosystem of tools

Market Position: Industry-leading open source project
```

### Engineer Document for React
```
Technical Deep Dive: React

💻 Tech Stack
Language: JavaScript
Frameworks: React
Tools: Jest, Webpack, Babel

📁 Project Structure
Architecture Type: Standard repository
Main Directories:
• packages/
• scripts/
• fixtures/

Components:
• Frontend application
• Test suite
```

## Contributing

To add new audience types:
1. Add audience to `validAudiences` in `backend/src/routes/analyze.js`
2. Create generator function in `backend/src/analyzer.js`
3. Add button to `frontend/analysis.html`
4. Update documentation

## License

Part of the RepoTalk project.