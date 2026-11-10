import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : (process.env.VITE_BASE_PATH || '/RobotCAD/'),
  plugins: [
    react(),
    {
      name: 'serve-robots',
      configureServer(server) {
        const localRobotsDir = path.resolve(__dirname, 'public/robots');
        const fallbackRobotsDir = path.resolve(__dirname, '../Undergraduate/robots');
        const robotsBaseDir = fs.existsSync(localRobotsDir) ? localRobotsDir : fallbackRobotsDir;
        
        server.middlewares.use('/robots', (req, res, next) => {
          if (!req.url) return next();
          
          // Decode URL in case of encoded characters
          const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
          const filePath = path.join(robotsBaseDir, decodedUrl);

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (filePath.endsWith('.stl')) {
              res.setHeader('Content-Type', 'application/octet-stream');
            } else if (filePath.endsWith('.xml')) {
              res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            } else if (filePath.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
          } else {
            next();
          }
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    fs: {
      allow: ['..', '.']
    }
  }
}));
