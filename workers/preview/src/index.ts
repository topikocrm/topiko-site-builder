/**
 * Topiko Preview Worker
 * 
 * Cloudflare Worker that triggers preview builds by creating/updating
 * siteConfig.json files in preview-* branches, which automatically
 * triggers GitHub Actions workflows.
 */

interface Env {
  GITHUB_TOKEN: string;
  PREVIEW_SECRET: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
}

interface PreviewRequest {
  siteId: string;
  siteConfig: Record<string, any>;
}

interface GitHubRef {
  ref: string;
  node_id: string;
  url: string;
  object: {
    sha: string;
    type: string;
    url: string;
  };
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  content: string;
  encoding: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Allow GET (favicon, browser checks)
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'preview' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-topiko-secret',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, x-topiko-secret',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const url = new URL(request.url);
    
    // Only handle /api/preview endpoint
    if (url.pathname !== '/api/preview') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    try {
      // Validate secret header
      const secret = request.headers.get('x-topiko-secret');
      if (!secret || secret !== env.PREVIEW_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Parse and validate request body
      let body: PreviewRequest;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (!body.siteId || typeof body.siteId !== 'string') {
        return new Response(JSON.stringify({ error: 'siteId must be a string' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (!body.siteConfig || typeof body.siteConfig !== 'object') {
        return new Response(JSON.stringify({ error: 'siteConfig must be an object' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Compute branch and file paths
      const branch = `preview-${body.siteId}`;
      const filePath = `data/sites/${body.siteId}/siteConfig.json`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const commitMessage = `Preview update for ${body.siteId} (${timestamp})`;

      // GitHub API helper functions
      const githubApi = {
        headers: {
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'topiko-preview-worker',
          'Content-Type': 'application/json',
        },

        async getRef(refName: string): Promise<GitHubRef | null> {
          const response = await fetch(
            `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/${refName}`,
            { headers: this.headers }
          );
          
          if (response.status === 404) {
            return null;
          }
          
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
          }
          
          return await response.json();
        },

        async createBranch(branch: string, fromSha: string): Promise<void> {
          const response = await fetch(
            `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs`,
            {
              method: 'POST',
              headers: this.headers,
              body: JSON.stringify({
                ref: `refs/heads/${branch}`,
                sha: fromSha,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Failed to create branch: ${response.status}`);
          }
        },

        async getFileSha(path: string, branch: string): Promise<string | null> {
          const response = await fetch(
            `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`,
            { headers: this.headers }
          );

          if (response.status === 404) {
            return null;
          }

          if (!response.ok) {
            throw new Error(`Failed to get file SHA: ${response.status}`);
          }

          const file: GitHubFile = await response.json();
          return file.sha;
        },

        async putFile(path: string, branch: string, base64Content: string, shaIfExists?: string): Promise<string> {
          const body: any = {
            message: commitMessage,
            content: base64Content,
            branch: branch,
          };

          if (shaIfExists) {
            body.sha = shaIfExists;
          }

          const response = await fetch(
            `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`,
            {
              method: 'PUT',
              headers: this.headers,
              body: JSON.stringify(body),
            }
          );

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update file: ${response.status} - ${error}`);
          }

          const result = await response.json();
          return result.commit?.sha || '';
        }
      };

      // Main logic
      try {
        // Check if preview branch exists
        let branchRef = await githubApi.getRef(`heads/${branch}`);
        
        // If branch doesn't exist, create it from main
        if (!branchRef) {
          const mainRef = await githubApi.getRef('heads/main');
          if (!mainRef) {
            throw new Error('Main branch not found');
          }
          
          await githubApi.createBranch(branch, mainRef.object.sha);
        }

        // Prepare base64 content
        const jsonContent = JSON.stringify(body.siteConfig, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));

        // Try to get existing file SHA (for updates)
        let existingSha: string | null = null;
        try {
          existingSha = await githubApi.getFileSha(filePath, branch);
        } catch {
          // File doesn't exist, that's okay
        }

        // Update/create the file
        const commitSha = await githubApi.putFile(filePath, branch, base64Content, existingSha || undefined);

        // Return success response
        return new Response(JSON.stringify({
          status: 'preview-triggered',
          branch: branch,
          commitSha: commitSha,
          filePath: filePath,
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });

      } catch (error) {
        console.error('GitHub API error:', error);
        return new Response(JSON.stringify({
          error: 'GitHub API error',
          details: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};