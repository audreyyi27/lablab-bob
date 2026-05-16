# Quick Start: IBM watsonx.ai Integration

Get RepoTalk running with AI-powered document generation in 5 minutes!

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your credentials
nano .env  # or use your favorite editor
```

**Minimum required for basic functionality:**
```env
# GitHub OAuth (required for private repos)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your-random-secret-string
PORT=3000
```

**Add these for AI-powered generation:**
```env
# IBM watsonx.ai (optional - enables AI generation)
WATSONX_API_KEY=your_watsonx_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_REGION=us-south
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Open RepoTalk
Open your browser to: **http://localhost:3000/analysis.html**

## 🎯 Test It Out

### Without AI (Template Mode)
1. Don't set watsonx.ai credentials
2. Enter a GitHub URL: `facebook/react`
3. Click "Analyze Repository"
4. Select an audience (e.g., "Software Engineer")
5. View the generated document (template-based)

### With AI (watsonx.ai Mode)
1. Set watsonx.ai credentials in `.env`
2. Restart the server
3. Enter a GitHub URL: `facebook/react`
4. Click "Analyze Repository"
5. Select an audience (e.g., "CEO / C-Level")
6. View the AI-generated document (powered by watsonx.ai)

## 🔍 Verify AI is Working

Check the browser console or server logs for:
```
Generating document with watsonx.ai for audience: ceo
Calling watsonx.ai for document generation...
Document generated successfully with watsonx.ai
```

Or check the API response metadata:
```json
{
  "metadata": {
    "generatedBy": "watsonx.ai",
    "model": "IBM watsonx.ai Runtime / WML"
  }
}
```

## 📋 Get IBM watsonx.ai Credentials

### Step 1: Create IBM Cloud Account
1. Go to [cloud.ibm.com](https://cloud.ibm.com)
2. Sign up for a free account (no credit card required for lite plan)

### Step 2: Create API Key
1. Go to [IBM Cloud API Keys](https://cloud.ibm.com/iam/apikeys)
2. Click "Create an IBM Cloud API key"
3. Name it "RepoTalk watsonx.ai"
4. Copy and save the API key

### Step 3: Create watsonx.ai Project
1. Go to [watsonx.ai](https://dataplatform.cloud.ibm.com/wx/home)
2. Click "Create a project" or open existing project
3. Go to "Manage" tab → "General"
4. Copy the "Project ID"

### Step 4: Note Your Region
Common regions:
- `us-south` (Dallas, USA)
- `eu-gb` (London, UK)
- `eu-de` (Frankfurt, Germany)
- `jp-tok` (Tokyo, Japan)

Check your project's region in the watsonx.ai console URL.

## 🎨 Choose Your Model

RepoTalk supports any model available in your watsonx.ai project:

| Model | Best For | Speed | Quality |
|-------|----------|-------|---------|
| `ibm/granite-13b-chat-v2` | General use | Fast | Good |
| `meta-llama/llama-3-70b-instruct` | High quality | Slower | Excellent |
| `mistralai/mixtral-8x7b-instruct-v01` | Balanced | Medium | Very Good |

Set in `.env`:
```env
WATSONX_MODEL_ID=ibm/granite-13b-chat-v2
```

## 🔧 Troubleshooting

### "watsonx.ai is not configured"
- Check that `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are set in `.env`
- Restart the server after changing `.env`

### "Failed to generate document"
- Verify your API key is valid
- Check your project ID is correct
- Ensure the model is available in your project
- Check IBM Cloud service status

### Slow Generation
- AI generation takes 3-10 seconds (normal)
- Larger models (70B) are slower but higher quality
- Consider using a smaller model for faster responses

## 📚 Next Steps

- Read [WATSONX_INTEGRATION.md](WATSONX_INTEGRATION.md) for detailed documentation
- Explore different audience types
- Try different models
- Export generated documents
- Customize prompts in `backend/src/watsonx.js`

## 💡 Tips

1. **Start with templates** - Test without watsonx.ai first to ensure basic functionality works
2. **Use lite plan** - IBM Cloud offers free tier for testing
3. **Monitor usage** - Check IBM Cloud dashboard for API usage
4. **Cache results** - Consider caching to reduce API calls
5. **Fallback works** - If AI fails, templates automatically take over

## 🎉 Success!

You now have RepoTalk running with AI-powered document generation!

Try analyzing different repositories with different audiences to see the AI in action.

---

**Need help?** Check [WATSONX_INTEGRATION.md](WATSONX_INTEGRATION.md) for comprehensive documentation.