import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // OAuth helper
  const getRedirectUri = () => {
    const baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    return `${baseUrl}/auth/callback`;
  };

  // Auth URL
  app.get('/api/auth/url', (req, res) => {
    const clientId = process.env.FATHOM_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'FATHOM_CLIENT_ID not configured' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: 'recording:read recording:transcript:read team:recording:read', // Example scopes
    });

    const authUrl = `${process.env.FATHOM_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  });

  // OAuth Callback
  app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('No code provided');
    }

    try {
      const response = await fetch(process.env.FATHOM_TOKEN_URL || 'https://fathom.video/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.FATHOM_CLIENT_ID!,
          client_secret: process.env.FATHOM_CLIENT_SECRET!,
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: getRedirectUri(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Fathom Token Error:', errorData);
        return res.status(500).send('Failed to exchange token');
      }

      const data = await response.json();
      const accessToken = data.access_token;

      // Store in cookie (SameSite: none, Secure: true for iframe)
      res.cookie('fathom_token', accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>Authentication successful! Closing window...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('OAuth Callback Error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Check Auth
  app.get('/api/auth/check', (req, res) => {
    const token = req.cookies.fathom_token;
    res.json({ authenticated: !!token });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('fathom_token', {
      secure: true,
      sameSite: 'none',
    });
    res.json({ success: true });
  });

  // Fetch Meetings (My Calls and Team Calls)
  app.get('/api/meetings', async (req, res) => {
    const token = req.cookies.fathom_token;
    const type = req.query.type || 'me'; // 'me' or 'team'

    // If no token and not in local dev with mock disabled, return mock data for demonstration
    if (!token) {
      if (process.env.FATHOM_CLIENT_ID) {
         return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // DEMO MODE: Return mock 10 meetings
      const mockMeetings = Array.from({ length: 10 }).map((_, i) => ({
        id: `mock-${type}-${i}`,
        title: `${type === 'me' ? 'My' : 'Team'} Meeting ${i + 1}`,
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        duration: '45 min',
        preview: 'This is a mock meeting preview for development purposes...',
      }));
      return res.json(mockMeetings);
    }

    try {
      const visibility = type === 'me' ? 'me' : 'team';
      // Adjust this URL based on Fathom's actual API
      const response = await fetch(`${process.env.FATHOM_API_BASE_URL}/recordings?visibility=${visibility}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Fathom API returned an error');
      }

      const data = await response.json();
      res.json(data.recordings || data);
    } catch (error) {
      console.error('Fetch Meetings Error:', error);
      res.status(500).json({ error: 'Failed to fetch meetings' });
    }
  });

  // Fetch Transcript
  app.get('/api/meetings/:id/transcript', async (req, res) => {
    const token = req.cookies.fathom_token;
    const { id } = req.params;

    if (!token) {
       if (id.startsWith('mock-')) {
         return res.json({ transcript: "This is a mock transcript for testing the minutes generator. It contains a lot of discussion about project timelines, budgets, and resource allocation." });
       }
       return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const response = await fetch(`${process.env.FATHOM_API_BASE_URL}/recordings/${id}/transcript`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transcript');
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Fetch Transcript Error:', error);
      res.status(500).json({ error: 'Failed to fetch transcript' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
