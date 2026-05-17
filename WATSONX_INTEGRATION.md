# IBM watsonx.ai Integration Guide

## Overview

RepoTalk now integrates with **IBM watsonx.ai Runtime / WML** to generate AI-powered, audience-specific documentation from GitHub repository analysis. The system intelligently uses watsonx.ai when configured, with automatic fallback to template-based generation.

## Features

✅ **AI-Powered Document Generation** - Uses IBM watsonx.ai to create tailored documentation  
✅ **Intelligent Context Building** - Extracts and structures repository metadata, tech stack, and architecture  
✅ **Audience-Specific Prompts** - Customized prompts for 7 different personas  
✅ **Automatic Fallback** - Seamlessly falls back to templates if AI is unavailable  
✅ **Flexible Configuration** - Easy setup with environment variables  

## Prerequisites

1. **IBM Cloud Account** - Sign up at [cloud.ibm.com](https://cloud.ibm.com)
2. **watsonx.ai Project** - Create a project in watsonx.ai
3. **API Key** - Generate an IBM Cloud API key
4. **Node.js 18+** - Required for the backend

## Setup Instructions

### Step 1: Get IBM Cloud Credentials

1. **Create an IBM Cloud API Key:**
   - Go to [IBM Cloud API Keys](https://cloud.ibm.com/iam/apikeys)
   - Click "Create an IBM Cloud API key"
   - Give it a name (e.g., "RepoTalk watsonx.ai")
   - Copy and save the API key securely

2. **Get your watsonx.ai Project ID:**
   - Go to [watsonx.ai](https://dataplatform.cloud.ibm.com/wx/home)
   - Open or create a project
   - Go to "Manage" tab → "General"
   - Copy the "Project ID"

3. **Note your IBM Cloud Region:**
   - Common regions: `us-south`, `eu-gb`, `eu-de`, `jp-tok`
   - Check your project's region in the watsonx.ai console

### Step 2: Configure RepoTalk

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and add your watsonx.ai credentials:**
   ```bash
   # IBM watsonx.ai Configuration
   WATSONX_API_KEY=your_actual_api_key_here
   WATSONX_PROJECT_ID=your_actual_project_id_here
   WATSONX_REGION=us-south
   WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
   ```

3. **Choose a model** (optional):
   - Default: `ibm/granite-13b-chat-v2` (IBM Granite)
   - Alternative: `meta-llama/llama-3-70b-instruct` (Meta Llama 3)
   - Or any other model available in your watsonx.ai project

### Step 3: Install Dependencies

```bash
cd backend
npm install
```

The `@ibm-cloud/watsonx-ai` SDK is already included in package.json.

### Step 4: Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3000`

## How It Works

### 1. Repository Analysis
When a user clicks "Analyze Repository", RepoTalk:
- Fetches repository metadata from GitHub
- Identifies important files (README, package.json, etc.)
- Detects technologies, frameworks, and tools
- Analyzes architecture patterns
- Reads key file contents

### 2. Context Building
The system builds a comprehensive context including:
- Repository information (name, stars, forks, description)
- README summary and features
- Technology stack (languages, frameworks, tools)
- Architecture details (frontend, backend, database, CI/CD)
- Important files list

### 3. AI Generation
For each audience type, RepoTalk:
- Creates an audience-specific prompt with the repository context
- Calls watsonx.ai Runtime / WML API
- Parses the AI-generated JSON response
- Returns a structured document with title and sections

### 4. Fallback Mechanism
If watsonx.ai is not configured or fails:
- Automatically falls back to template-based generation
- No user-facing errors
- Consistent document structure maintained

## Audience Types

RepoTalk generates tailored documentation for:

| Audience | Focus | Tone |
|----------|-------|------|
| 👔 CEO / C-Level | Business value, ROI, strategic insights | Executive, strategic |
| 📊 Product Manager | Features, market fit, roadmap | Product-focused, analytical |
| ⚙️ Engineering Manager | Tech stack, practices, team metrics | Technical leadership |
| 💻 Software Engineer | Code structure, setup, implementation | Technical, practical |
| 🎨 Designer | UI/UX, design system, assets | Design-focused, creative |
| 🎓 Beginner / Intern | Simple explanations, learning resources | Educational, encouraging |
| 💰 Investor | Market validation, risk, ROI | Investment-focused, analytical |

## API Response Format

The analyze endpoint returns:

```json
{
  "success": true,
  "analysis": {
    "technologies": ["JavaScript", "Python"],
    "frameworks": ["React", "Express"],
    "tools": ["Docker", "GitHub Actions"],
    "architecture": { ... },
    "importantFiles": [ ... ]
  },
  "document": {
    "title": "Executive Summary: Project Name",
    "sections": [
      {
        "heading": "🎯 Business Overview",
        "content": "Detailed content with markdown..."
      }
    ],
    "generatedBy": "watsonx.ai",
    "model": "IBM watsonx.ai Runtime / WML"
  },
  "metadata": {
    "owner": "facebook",
    "repo": "react",
    "audience": "ceo",
    "analyzedAt": "2024-01-15T10:30:00.000Z",
    "generatedBy": "watsonx.ai",
    "model": "IBM watsonx.ai Runtime / WML"
  }
}
```

## Testing

### Test Without watsonx.ai (Template Mode)

1. Don't set watsonx.ai credentials in `.env`
2. Start the server: `npm run dev`
3. Open `http://localhost:3000/analysis.html`
4. Analyze a repository (e.g., `facebook/react`)
5. Select an audience type
6. Document will be generated using templates

### Test With watsonx.ai (AI Mode)

1. Set watsonx.ai credentials in `.env`
2. Start the server: `npm run dev`
3. Open `http://localhost:3000/analysis.html`
4. Analyze a repository
5. Select an audience type
6. Document will be generated using watsonx.ai
7. Check the browser console or server logs for "Generating document with watsonx.ai"

### Verify AI Generation

Check the metadata in the response:
- `generatedBy: "watsonx.ai"` = AI-generated
- `generatedBy: "template"` = Template-based fallback

## Troubleshooting

### Issue: "watsonx.ai is not configured"

**Solution:** Ensure `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set in `.env`

### Issue: "Failed to generate document with watsonx.ai"

**Possible causes:**
1. Invalid API key or Project ID
2. Incorrect region
3. Model not available in your project
4. Network connectivity issues
5. API rate limits

**Solution:** Check server logs for detailed error messages. The system will automatically fall back to templates.

### Issue: AI response is not valid JSON

**Solution:** The system has built-in fallback parsing. If JSON parsing fails, it wraps the raw response in a simple document structure.

### Issue: Slow response times

**Cause:** AI generation takes longer than templates (typically 3-10 seconds)

**Solution:** This is expected. The UI shows a loading indicator during generation.

## Configuration Options

### Model Selection

Different models have different characteristics:

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `ibm/granite-13b-chat-v2` | 13B | Fast | Good | General purpose |
| `meta-llama/llama-3-70b-instruct` | 70B | Slower | Excellent | High-quality output |

### Generation Parameters

In `backend/src/watsonx.js`, you can adjust:

```javascript
parameters: {
  max_new_tokens: 2000,    // Maximum response length
  temperature: 0.7,         // Creativity (0.0-1.0)
  top_p: 0.9,              // Nucleus sampling
  top_k: 50,               // Top-k sampling
  repetition_penalty: 1.1, // Avoid repetition
}
```

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (analysis.js)  │
└────────┬────────┘
         │ POST /api/analyze
         ▼
┌─────────────────┐
│  Analyze Route  │
│ (analyze.js)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│   Analyzer      │─────▶│  watsonx.ai      │
│ (analyzer.js)   │      │  (watsonx.js)    │
└─────────────────┘      └──────────────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │ IBM watsonx.ai   │
         │               │ Runtime / WML    │
         │               └──────────────────┘
         │
         ▼ (fallback)
┌─────────────────┐
│   Templates     │
│ (built-in)      │
└─────────────────┘
```

## Cost Considerations

- watsonx.ai charges based on tokens processed
- Each document generation uses ~500-2000 tokens
- Monitor usage in IBM Cloud dashboard
- Template fallback is free (no API calls)

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use environment variables** - Don't hardcode API keys
3. **Rotate API keys regularly** - Generate new keys periodically
4. **Limit API key permissions** - Use least-privilege principle
5. **Monitor API usage** - Set up alerts for unusual activity

## Next Steps

- ✅ Basic integration complete
- 🔄 Add PDF export with AI-generated content
- 🔄 Implement caching to reduce API calls
- 🔄 Add support for custom prompts
- 🔄 Create comparison mode (AI vs Templates)
- 🔄 Add streaming responses for real-time generation

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Verify IBM Cloud credentials and permissions
3. Test with template mode first (no watsonx.ai)
4. Review watsonx.ai documentation: [IBM watsonx.ai Docs](https://www.ibm.com/docs/en/watsonx-as-a-service)

## License

This integration is part of the RepoTalk project.

---

**Built with ❤️ using IBM watsonx.ai Runtime / WML**