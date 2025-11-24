# Topiko Publish Worker

This Worker publishes a site by writing siteConfig.json to main branch and triggers the publish workflow.

## Required Cloudflare Secrets/Variables

### Secrets (Encrypted)
- **GITHUB_TOKEN**: GitHub Personal Access Token with full repository and workflow permissions
- **PREVIEW_SECRET**: Authentication secret for API access (same as preview worker)

### Variables (Plaintext)
- **GITHUB_OWNER**: `topikocrm`
- **GITHUB_REPO**: `topiko-site-builder`

## API Usage

### Endpoint
```
POST https://<worker-url>/api/publish
```

### Headers
- `Content-Type: application/json`
- `x-topiko-secret: <PREVIEW_SECRET>`

### Request Body
```json
{
  "siteId": "sample",
  "siteConfig": { 
    "businessName": "Live Biz",
    "themeId": "salon" 
  },
  "publishMessage": "Approve and publish"
}
```

### Example cURL
```bash
curl -X POST "https://<worker-url>/api/publish" \
  -H "Content-Type: application/json" \
  -H "x-topiko-secret: <PREVIEW_SECRET>" \
  -d '{
    "siteId": "sample",
    "siteConfig": { 
      "businessName":"Live Biz",
      "themeId":"salon" 
    },
    "publishMessage": "Approve and publish"
  }'
```

### Expected Success Response
```json
{
  "status": "published",
  "branch": "main",
  "commitSha": "abc123def456...",
  "filePath": "data/sites/sample/siteConfig.json"
}
```

## Branch Protection Notes

If main branch is protected, the token must have permission or you must use a different flow (merge via PR). 

**Migration Note**: If branch protection blocks direct commits, an alternative worker flow can open a PR and merge it via a maintainer with appropriate permissions.

## Testing Instructions

1. **Add/verify Cloudflare Worker secrets**: 
   - `GITHUB_TOKEN` (secret) - Personal Access Token with repo permissions
   - `PREVIEW_SECRET` (secret) - Authentication secret
   - Add plaintext vars `GITHUB_OWNER` and `GITHUB_REPO`

2. **Redeploy the Worker** (save & deploy) so new vars are applied

3. **Test via curl/Postman** using provided sample. Expect response showing commitSha

4. **Verify GitHub main branch** was updated and `publish.yml` workflow runs

## Security Notes

- **Rotate GITHUB_TOKEN** if leaked
- **Use least-privilege PAT** where possible (repo:contents write & workflows)
- **Consider enforcing a second confirmation step** for high-risk publishes
- Do not log token contents or secrets in worker logs