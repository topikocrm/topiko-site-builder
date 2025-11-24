# Topiko Preview Worker

## Purpose

This Cloudflare Worker triggers preview builds for the Topiko Static Site Builder by writing siteConfig.json files to preview branches in the GitHub repository. When a preview branch is created or updated, GitHub Actions automatically builds the site and creates preview artifacts.

## How It Works

1. **Receives a POST request** with site configuration data
2. **Creates or updates a preview branch** named `preview-{siteId}`
3. **Writes siteConfig.json** to `data/sites/{siteId}/siteConfig.json` in that branch
4. **GitHub Actions automatically triggers** the preview workflow on branch push
5. **Preview artifacts are built** and made available for download

## Required Secrets

The worker requires these environment variables/secrets to be configured:

### `GITHUB_TOKEN`
- **Type**: GitHub Personal Access Token or Fine-grained token
- **Permissions Required**:
  - Repository access: `topikocrm/topiko-site-builder`
  - Scopes: `repo` (for classic tokens) or `Contents: Write, Metadata: Read, Actions: Read` (for fine-grained tokens)
- **How to create**: 
  - Go to GitHub Settings → Developer settings → Personal access tokens
  - Generate new token with repository permissions

### `PREVIEW_SECRET`
- **Type**: Random secret string for API authentication
- **Purpose**: Protects the worker endpoint from unauthorized access
- **Example**: `preview_secret_2024_secure_random_string`
- **How to generate**: Use any secure random string generator

## API Usage

### Endpoint
```
POST https://topiko-preview-worker.<your-subdomain>.workers.dev/api/preview
```

### Headers
- `Content-Type: application/json`
- `x-topiko-secret: <PREVIEW_SECRET>`

### Request Body
```json
{
  "siteId": "sample",
  "siteConfig": {
    "businessName": "Test Business",
    "themeId": "salon",
    "colorPreset": "pink",
    "logoUrl": "/logo.png",
    "sections": [
      { "type": "hero" },
      { "type": "about" },
      { "type": "services", "props": { "limit": 4 } },
      { "type": "footer" }
    ]
  }
}
```

### Example cURL Request
```bash
curl -X POST https://topiko-preview-worker.<your-subdomain>.workers.dev/api/preview \
  -H "Content-Type: application/json" \
  -H "x-topiko-secret: <PREVIEW_SECRET>" \
  -d '{
    "siteId": "sample",
    "siteConfig": {
      "businessName": "Test Business",
      "themeId": "salon",
      "colorPreset": "blue"
    }
  }'
```

### Success Response
```json
{
  "status": "preview-triggered",
  "branch": "preview-sample",
  "commitSha": "abc123def456...",
  "filePath": "data/sites/sample/siteConfig.json"
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

#### 400 Bad Request
```json
{
  "error": "siteId must be a string"
}
```

#### 500 Internal Server Error
```json
{
  "error": "GitHub API error",
  "details": "Failed to create branch: 403"
}
```

## File Path Structure

The worker writes siteConfig.json files using this path pattern:
```
data/sites/{siteId}/siteConfig.json
```

Examples:
- `data/sites/sample/siteConfig.json`
- `data/sites/client-123/siteConfig.json`
- `data/sites/demo-site/siteConfig.json`

## Branch Management

### Branch Naming
- **Pattern**: `preview-{siteId}`
- **Examples**: `preview-sample`, `preview-client-123`, `preview-demo-site`

### Branch Creation
- **Source**: Branches are created from the latest `main` branch SHA
- **Behavior**: If a preview branch already exists, it's updated in place
- **GitHub Actions**: Automatically triggers on any push to `preview-*` branches

## GitHub Actions Integration

When the worker updates a preview branch:

1. **GitHub Actions detects** the push to `preview-*` branch
2. **Preview workflow runs** (`.github/workflows/preview.yml`)
3. **Site is built** with the new siteConfig.json
4. **Artifacts are uploaded** for download and review
5. **Preview is ready** for testing and approval

## Deployment

### Deploy to Cloudflare Workers
```bash
# Navigate to worker directory
cd workers/preview

# Install Wrangler CLI (if not installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy the worker
wrangler deploy

# Set required secrets
wrangler secret put GITHUB_TOKEN
wrangler secret put PREVIEW_SECRET
```

### Local Development
```bash
# Start local development server
wrangler dev

# Test locally
curl -X POST http://localhost:8787/api/preview \
  -H "Content-Type: application/json" \
  -H "x-topiko-secret: test-secret" \
  -d '{"siteId":"test","siteConfig":{"businessName":"Local Test"}}'
```

## Error Handling

The worker includes comprehensive error handling:

- **Method validation**: Only POST requests allowed
- **Authentication**: Validates x-topiko-secret header
- **Input validation**: Validates siteId and siteConfig structure
- **GitHub API errors**: Catches and reports GitHub API failures
- **CORS support**: Handles preflight OPTIONS requests
- **Detailed logging**: Console logs errors for debugging

## Security Features

- **Secret authentication**: All requests require valid x-topiko-secret
- **CORS headers**: Properly configured for web applications
- **Input sanitization**: Validates all input parameters
- **GitHub token scoping**: Uses minimal required permissions
- **Error message filtering**: Doesn't expose sensitive information

## Integration with CMS

This worker is designed to integrate with content management systems:

1. **CMS Preview Button** → POST to `/api/preview`
2. **Worker updates GitHub** → Creates preview branch
3. **GitHub Actions builds** → Creates preview artifacts
4. **CMS shows preview link** → User can review changes
5. **CMS Publish Button** → Merges to main branch

The worker provides a clean API for CMS systems to trigger previews without needing direct GitHub access or complex Git operations.