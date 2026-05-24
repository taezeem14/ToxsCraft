# Tox'sCraft Deployment Guide

This guide details how to build, deploy, and package Tox'sCraft for various environments.

---

## 1. Production Build & Static Hosting

Vite compiles code, bundles shaders, and optimizes the assets into a highly compressed `dist` folder.

```bash
# Compile and build production files
npm run build
```

This output is a pure static client bundle that can be hosted on:
- **Vercel**: Import the repository and select `Vite` template (Output directory: `dist`, Build command: `npm run build`).
- **Netlify**: Deploy the `dist` folder directly or hook up Git hooks.
- **GitHub Pages**: Build and push the `dist` folder to a branch (e.g. using `gh-pages` packages).

---

## 2. Docker Deployment

To containerize the game and serve it using a lightweight Nginx web server:

1. Create a `Dockerfile` at the root of the project:

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

2. Build and run:
```bash
docker build -t toxscraft:latest .
docker run -d -p 8080:80 toxscraft:latest
```

---

## 3. PWA Configuration (Offline Mode)

Tox'sCraft is designed to run offline using a Service Worker to cache assets, shaders, and configurations.

1. Ensure the assets `public/manifest.json` and `public/sw.js` are in place.
2. In production, the service worker will intercept network requests and serve resources from the cache if offline.

---

## 4. Electron Desktop Packaging (Optional)

To wrap the web app as a native executable:

1. Install Electron dependencies:
```bash
pnpm install -D electron electron-builder
```

2. Add `electron.js` entry point:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load index.html in production, localhost in development
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    win.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

3. Update `package.json` with scripts:
```json
"electron:dist": "vite build && electron-builder"
```
