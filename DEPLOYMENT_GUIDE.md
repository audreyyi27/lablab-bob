# Continuous Delivery Setup Guide

## Overview

This guide explains how to set up and use the AI-powered Continuous Delivery (CD) system for the Engineer role using Watsonx Orchestrate.

## Features

✅ **AI-Powered Deployment Analysis** - Watsonx analyzes your repository and determines deployment readiness
✅ **One-Click Deployments** - Trigger deployments directly from the RepoTalk interface
✅ **Real-Time Status Tracking** - Monitor deployment progress with live updates
✅ **Deployment History** - View past deployments and their outcomes
✅ **Webhook Integration** - Automatic deployments on push to main/master branches
✅ **Role-Based Access** - Engineer-specific deployment controls

## Prerequisites

1. **Watsonx Orchestrate Account** - Already configured in `.env`
2. **GitHub OAuth** - For repository access
3. **Node.js 18+** - For running the backend server

## Configuration

### 1. Environment Variables

Your `.env` file already contains the Watsonx credentials:

```env
# Watsonx Orchestrate credentials
apikey=yIU4_cG0KwMt4eQkIBUvNlQ31UaHFHwnZH2qQ355z5vu
url=https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/cc7f1077-e59d-4fb2-b957-9d2203c85346
```

These are automatically loaded by the backend.

### 2. Start the Server

```bash
cd backend
npm install
npm run dev
```

The server will start on `http://localhost:3000`

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost:3000/analysis.html
```

## Using the CD System

### Step 1: Connect GitHub

1. Click **"Connect GitHub"** button
2. Authorize the application
3. Select a repository from your list, or paste a repository URL

### Step 2: View Deployment Panel

Once a repository is loaded, you'll see the **"Continuous Delivery (Engineer)"** panel with:
- AI-Powered badge indicating Watsonx integration
- **AI Analysis** button
- **Deploy Now** button

### Step 3: AI Deployment Analysis

Click **"AI Analysis"** to:
- Check deployment readiness
- Get confidence score
- View recommendations
- Identify potential risks
- See estimated deployment duration

The AI analyzes:
- Recent commits
- Code quality
- Test results
- Dependencies
- Repository health

### Step 4: Trigger Deployment

Click **"Deploy Now"** to:
1. Confirm deployment to production
2. Watsonx Orchestrate initiates the deployment workflow
3. Real-time status updates appear in the "Active Deployments" section

### Step 5: Monitor Progress

The deployment card shows:
- Deployment ID
- Current status (Initiated → Running → Completed/Failed)
- Branch being deployed
- Target environment
- Time since triggered
- Cancel button (if needed)

### Step 6: View History

The **"Recent Deployments"** section displays:
- Last 5 deployments
- Status of each deployment
- Branch and environment
- Time elapsed

## API Endpoints

### Trigger Deployment
```
POST /api/deployment/trigger
Body: {
  "owner": "username",
  "repo": "repository",
  "branch": "main",
  "environment": "production",
  "deploymentType": "manual"
}
```

### Get Deployment Status
```
GET /api/deployment/status/:executionId
```

### List Deployments
```
GET /api/deployment/list/:owner/:repo?limit=10
```

### Cancel Deployment
```
POST /api/deployment/cancel/:executionId
```

### AI Analysis
```
POST /api/deployment/analyze
Body: {
  "owner": "username",
  "repo": "repository"
}
```

## Webhook Setup (Optional)

For automatic deployments on push events:

### 1. Configure GitHub Webhook

In your GitHub repository settings:
1. Go to **Settings** → **Webhooks** → **Add webhook**
2. Set Payload URL: `http://your-domain.com/api/deployment/webhook`
3. Content type: `application/json`
4. Select events: **Push events**
5. Save webhook

### 2. Webhook Behavior

- Automatically triggers deployment on push to `main` or `master` branch
- Uses Watsonx Orchestrate for deployment execution
- Logs deployment initiation in console

## Watsonx Orchestrate Workflows

The system uses two main workflows:

### 1. `cd_deployment`
Main deployment workflow that:
- Receives repository information
- Executes deployment steps
- Reports status back to RepoTalk

### 2. `deployment_analysis`
AI analysis workflow that:
- Analyzes repository health
- Evaluates deployment readiness
- Provides recommendations and risk assessment

## Deployment Status Flow

```
Initiated → Running → Completed
                   ↘ Failed
                   ↘ Cancelled
```

- **Initiated**: Deployment request sent to Watsonx
- **Running**: Deployment in progress
- **Completed**: Deployment successful
- **Failed**: Deployment encountered errors
- **Cancelled**: User cancelled the deployment

## Troubleshooting

### Issue: "Failed to trigger deployment"

**Solution:**
- Check Watsonx API credentials in `.env`
- Verify network connectivity
- Check backend console for detailed errors

### Issue: "Session expired"

**Solution:**
- Reconnect GitHub by clicking "Connect GitHub"
- Refresh the page

### Issue: Deployment stuck in "Running"

**Solution:**
- Check Watsonx Orchestrate dashboard
- Verify workflow configuration
- Cancel and retry deployment

### Issue: Webhook not triggering

**Solution:**
- Verify webhook URL is publicly accessible
- Check webhook delivery in GitHub settings
- Review backend logs for webhook events

## Security Considerations

1. **API Keys**: Never commit `.env` file to version control
2. **Webhook Secret**: Consider adding webhook signature verification
3. **Authentication**: All deployment endpoints require GitHub OAuth
4. **Rate Limiting**: Implement rate limiting for production use
5. **HTTPS**: Use HTTPS in production for webhook endpoints

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (analysis.html)│
│                 │
│  - Deployment   │
│    Controls     │
│  - Status UI    │
│  - History      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │
│  (Express API)  │
│                 │
│  - Auth         │
│  - Deployment   │
│    Routes       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Watsonx       │
│  Orchestrate    │
│                 │
│  - Workflows    │
│  - AI Analysis  │
│  - Execution    │
└─────────────────┘
```

## Next Steps

1. **Configure Watsonx Workflows**: Set up `cd_deployment` and `deployment_analysis` workflows in Watsonx Orchestrate
2. **Test Deployments**: Try deploying a test repository
3. **Set Up Webhooks**: Enable automatic deployments
4. **Monitor**: Use deployment history to track success rates
5. **Customize**: Adjust deployment parameters for your needs

## Support

For issues or questions:
1. Check backend console logs
2. Review Watsonx Orchestrate execution logs
3. Verify GitHub OAuth connection
4. Check network connectivity

## License

This CD system is part of the RepoTalk project.