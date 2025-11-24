/**
 * Topiko Publish Worker
 * 
 * Cloudflare Worker that publishes sites by writing siteConfig.json 
 * to the main branch, which automatically triggers the publish workflow.
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-topiko-secret',
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
    
    // Only handle /api/publish endpoint
    if (url.pathname !== '/api/publish') {
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
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ 
          error: 'validation', 
          details: 'Invalid JSON body' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (!body.siteId || typeof body.siteId !== 'string') {
        return new Response(JSON.stringify({ 
          error: 'validation', 
          details: 'siteId must be a string' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (!body.siteConfig || typeof body.siteConfig !== 'object') {
        return new Response(JSON.stringify({ 
          error: 'validation', 
          details: 'siteConfig must be an object' 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Compute branch and file paths
      const branch = 'main';
      const filePath = `data/sites/${body.siteId}/siteConfig.json`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const commitMessage = body.publishMessage || `Publish for ${body.siteId} at ${timestamp}`;

      // GitHub API headers
      const githubHeaders = {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'topiko-publish-worker',
        'Content-Type': 'application/json',
      };

      try {
        // Get existing file SHA (if file exists)
        let existingSha = null;
        const getFileResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}?ref=${branch}`,
          { headers: githubHeaders }
        );

        if (getFileResponse.ok) {
          const fileData = await getFileResponse.json();
          existingSha = fileData.sha;
        } else if (getFileResponse.status !== 404) {
          throw new Error(`Failed to check file: ${getFileResponse.status}`);
        }

        // Prepare base64 content
        const jsonContent = JSON.stringify(body.siteConfig, null, 2);
        const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));

        // Update/create the file
        const putBody = {
          message: commitMessage,
          content: base64Content,
          branch: branch,
        };

        if (existingSha) {
          putBody.sha = existingSha;
        }

        const putResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: githubHeaders,
            body: JSON.stringify(putBody),
          }
        );

        if (!putResponse.ok) {
          const errorText = await putResponse.text();
          
          // Handle specific GitHub API errors
          if (putResponse.status === 403) {
            if (errorText.includes('resource not accessible')) {
              return new Response(JSON.stringify({
                error: 'GitHub API error',
                details: 'Token permission error - insufficient repository access'
              }), {
                status: 403,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            }
            
            if (errorText.includes('protected')) {
              return new Response(JSON.stringify({
                error: 'GitHub API error',
                details: 'Branch protection prevents direct write to main branch'
              }), {
                status: 409,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                },
              });
            }
          }

          throw new Error(`Failed to update file: ${putResponse.status} - ${errorText}`);
        }

        const result = await putResponse.json();
        const commitSha = result.commit?.sha || '';

        // Return success response
        return new Response(JSON.stringify({
          status: 'published',
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
          details: error.message || 'Unknown GitHub API error',
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
        details: error.message || 'Unknown error',
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