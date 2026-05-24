/**
 * Tox'sCraft InputManager
 * Tracks keyboard and mouse inputs, scrolling, and cursor lock states.
 */

import { eventBus } from '../EventBus';

export class InputManager {
  private keys: Map<string, boolean> = new Map();
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  private isPointerLocked = false;
  private targetElement: HTMLElement;

  constructor(targetElement: HTMLElement) {
    this.targetElement = targetElement;
    this.initListeners();
  }

  private initListeners(): void {
    // Keyboard listeners
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse lock change
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Mouse movement
    document.addEventListener('mousemove', this.onMouseMove);

    // Mouse clicks
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);

    // Scroll wheel (hotbar selection)
    window.addEventListener('wheel', this.onWheel, { passive: false });
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Prevent default scroll behavior for arrow keys, space, and backspace in game
    if (this.isPointerLocked && ['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }

    const wasDown = this.keys.get(e.code) || false;
    this.keys.set(e.code, true);

    if (!wasDown) {
      eventBus.emit('keydown', e.code);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
    eventBus.emit('keyup', e.code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.isPointerLocked) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.isPointerLocked) return;

    if (e.button === 0) {
      eventBus.emit('click_left');
    } else if (e.button === 2) {
      eventBus.emit('click_right');
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.isPointerLocked) return;

    if (e.button === 0) {
      eventBus.emit('release_left');
    } else if (e.button === 2) {
      eventBus.emit('release_right');
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.isPointerLocked) return;
    e.preventDefault();

    // Positive delta means scroll down, negative means scroll up
    const direction = Math.sign(e.deltaY);
    eventBus.emit('scroll', direction);
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.targetElement;
    eventBus.emit('pointerlockchange', this.isPointerLocked);
  };

  /**
   * Request to lock pointer in target canvas
   */
  public requestLock(): void {
    if (!this.isPointerLocked) {
      this.targetElement.requestPointerLock();
    }
  }

  /**
   * Check if a specific key is currently held down
   */
  public isKeyDown(code: string): boolean {
    return this.keys.get(code) || false;
  }

  /**
   * Get accumulated mouse deltas and reset them
   */
  public getAndResetMouseDeltas(): { x: number; y: number } {
    const deltas = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return deltas;
  }

  /**
   * Is pointer lock currently active
   */
  public getLocked(): boolean {
    return this.isPointerLocked;
  }
}
