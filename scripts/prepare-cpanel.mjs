#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const root = path.resolve(process.cwd());
  const clientDir = path.join(root);
  console.log('[CPANEL] Building client (vite build)');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: clientDir });
  } catch (e) {
    console.error('[CPANEL] Client build failed', e);
    process.exit(1);
  }

  const distSrc = path.join(root, 'dist');
  const backendDist = path.join(root, 'pilgrim-backend', 'dist');
  if (!fs.existsSync(distSrc)) {
    console.error('[CPANEL] Expected dist/ after build but not found');
    process.exit(1);
  }
  // Remove existing backend dist if present
  try {
    if (fs.existsSync(backendDist)) {
      console.log('[CPANEL] Removing existing pilgrim-backend/dist');
      // simple rm -rf behavior
      fs.rmSync(backendDist, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[CPANEL] Could not remove existing backend dist', e.message || e);
  }

  console.log('[CPANEL] Copying dist/ to pilgrim-backend/dist');
  copyRecursive(distSrc, backendDist);
  console.log('[CPANEL] Prepared pilgrim-backend/dist for cPanel upload');
}

main().catch(e => { console.error(e); process.exit(1); });
