import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// Enable CORS for the frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));

// Parse JSON bodies
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Dynamic proxy endpoint
app.all('/proxy', async (req, res) => {
  const targetUrl = req.headers['x-target-url'];

  if (!targetUrl) {
    return res.status(400).json({
      error: 'Missing X-Target-URL header',
      message: 'Please provide the target URL in the X-Target-URL header',
    });
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${targetUrl}`);

  try {
    // Prepare headers (exclude host and other problematic headers)
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['x-target-url'];
    delete headers.connection;
    delete headers['content-length'];

    // Prepare fetch options
    const options = {
      method: req.method,
      headers,
    };

    // Add body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = JSON.stringify(req.body);
    }

    // Make the request to the target
    const response = await fetch(targetUrl, options);

    // Handle SSE/streaming responses
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Stream SSE responses
      res.writeHead(response.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      response.body.pipe(res);

      response.body.on('end', () => {
        res.end();
      });

      response.body.on('error', (err) => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      // Handle regular responses
      const data = await response.text();

      // Copy response headers
      response.headers.forEach((value, key) => {
        // Skip problematic headers
        if (!['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });

      // Send response
      res.status(response.status).send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(502).json({
      error: 'Bad Gateway',
      message: error.message,
      target: targetUrl,
    });
  }
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   A2A Proxy Server                     ║
║   Running on http://localhost:${PORT}    ║
╚════════════════════════════════════════╝

Ready to proxy requests to any agent!
`);
});
