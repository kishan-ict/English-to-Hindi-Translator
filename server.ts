import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API: POST /api/translate
  // Delegates translation execution to the Python core logic
  app.post('/api/translate', (req, res) => {
    const payload = JSON.stringify(req.body);
    const pythonProcess = spawn('python3', ['src/main.py', '--json', payload]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (code === 0 && parsed.success !== false && !parsed.error) {
          return res.status(200).json(parsed);
        } else {
          return res.status(400).json(parsed);
        }
      } catch (e) {
        return res.status(500).json({
          error: 'Translation processing failed',
          details: stderrData || stdoutData
        });
      }
    });
  });

  // API: GET /api/languages
  // Retrieves the supported languages dictionary from Python (src/languages.py)
  app.get('/api/languages', (req, res) => {
    const pythonProcess = spawn('python3', ['src/main.py', '--languages']);

    let stdoutData = '';
    pythonProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdoutData.trim());
        return res.status(200).json(parsed);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to retrieve languages' });
      }
    });
  });

  // API: GET /api/health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'English-Hindi-Translator' });
  });

  // In development, integrate Vite middlewares to serve frontend assets
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`English-to-Hindi Translator server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
