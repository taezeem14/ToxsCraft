/**
 * Tox'sCraft Entry Point
 * Initializes the Game instance, binds the UIManager, and runs the master requestAnimationFrame render loop.
 */

import { Game } from './Game';
import { UIManager } from './ui/UIManager';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error("Canvas element 'game-canvas' not found!");
    return;
  }

  // 1. Initialize master game coordinator
  const game = new Game(canvas);

  // 2. Bind HTML/CSS overlay manager
  new UIManager(game);

  // 3. Define main render loop
  function loop(now: number) {
    requestAnimationFrame(loop);
    game.update(now);
  }

  // Start loop
  requestAnimationFrame(loop);

  // Register Service Worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA ServiceWorker registered:', reg.scope))
      .catch(err => console.warn('PWA ServiceWorker failed to register:', err));
  }
});
