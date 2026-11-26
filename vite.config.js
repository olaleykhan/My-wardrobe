import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'wardrobe.json');

// Reads and writes wardrobe.json so edits made on the page are saved to disk.
function wardrobeFile() {
  return {
    name: 'wardrobe-file',
    configureServer(server) {
      server.middlewares.use('/api/wardrobe', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET') {
          res.end(fs.existsSync(DATA) ? fs.readFileSync(DATA, 'utf8') : '{}');
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('bad shape');
              fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
              res.end('{"ok":true}');
            } catch (e) {
              res.statusCode = 400;
              res.end('{"ok":false}');
            }
          });
          return;
        }
        res.statusCode = 405;
        res.end('{"ok":false}');
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), wardrobeFile()],
  server: { host: '127.0.0.1', port: 5173, watch: { ignored: ['**/wardrobe.json'] } },
});
