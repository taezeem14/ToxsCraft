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
  private isMobile = false;
  private targetElement: HTMLElement;
  private joystickActive = false;
  private joystickOrigin = { x: 0, y: 0 };

  // Virtual keys for mobile
  private virtualKeys: Map<string, boolean> = new Map();

  constructor(targetElement: HTMLElement) {
    this.targetElement = targetElement;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || ('ontouchstart' in window);
    this.initListeners();
    this.initMobileControls();
  }

  private initMobileControls(): void {
    const controls = document.getElementById('mobile-controls');
    if (!controls) return;
    
    if (this.isMobile) {
      controls.classList.remove('hidden');
    } else {
      return;
    }

    const setVirtualKey = (code: string, state: boolean) => {
      const wasDown = this.virtualKeys.get(code) || false;
      this.virtualKeys.set(code, state);
      if (state && !wasDown) eventBus.emit('keydown', code);
      if (!state && wasDown) eventBus.emit('keyup', code);
    };

    // Joystick logic
    const joystick = document.getElementById('joystick-move');
    const knob = document.getElementById('joystick-move-knob');
    if (joystick && knob) {
      joystick.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.joystickActive = true;
        const rect = joystick.getBoundingClientRect();
        this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.updateJoystick(e.touches[0], knob);
      }, { passive: false });

      joystick.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (this.joystickActive) this.updateJoystick(e.touches[0], knob);
      }, { passive: false });

      const stopJoystick = (e: TouchEvent) => {
        e.preventDefault();
        this.joystickActive = false;
        knob.style.transform = `translate(0px, 0px)`;
        ['KeyW', 'KeyS', 'KeyA', 'KeyD'].forEach(k => setVirtualKey(k, false));
      };
      joystick.addEventListener('touchend', stopJoystick, { passive: false });
      joystick.addEventListener('touchcancel', stopJoystick, { passive: false });
    }

    // Touch look tracking
    document.addEventListener('touchstart', (e) => {
      // If we touch on the right half of the screen and not hitting a specific button
      if ((e.target as HTMLElement).tagName !== 'BUTTON' && (e.target as HTMLElement).id !== 'joystick-move' && (e.target as HTMLElement).id !== 'joystick-move-knob') {
        const touch = e.changedTouches[0];
        if (touch.clientX > window.innerWidth / 2) {
          (this as any).lastTouchX = touch.clientX;
          (this as any).lastTouchY = touch.clientY;
        }
      }
    }, {passive: false});

    document.addEventListener('touchmove', (e) => {
      if ((this as any).lastTouchX !== undefined) {
        let touch: Touch | null = null;
        for (let i = 0; i < e.touches.length; i++) {
          if (e.touches[i].clientX > window.innerWidth / 2 && (e.target as HTMLElement).tagName !== 'BUTTON') {
             touch = e.touches[i];
             break;
          }
        }
        if (touch) {
          const deltaX = touch.clientX - (this as any).lastTouchX;
          const deltaY = touch.clientY - (this as any).lastTouchY;
          this.mouseDeltaX += deltaX * 2.0; // sensitivity multiplier
          this.mouseDeltaY += deltaY * 2.0;
          (this as any).lastTouchX = touch.clientX;
          (this as any).lastTouchY = touch.clientY;
        }
      }
    }, {passive: false});

    const endTouchLook = () => {
      (this as any).lastTouchX = undefined;
      (this as any).lastTouchY = undefined;
    };
    document.addEventListener('touchend', endTouchLook);
    document.addEventListener('touchcancel', endTouchLook);

    // Buttons
    const bindBtn = (id: string, code: string) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); setVirtualKey(code, true); });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); setVirtualKey(code, false); });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); setVirtualKey(code, false); });
    };

    bindBtn('btn-mobile-jump', 'Space');
    bindBtn('btn-mobile-sneak', 'ShiftLeft');
    
    // special buttons
    const btnFly = document.getElementById('btn-mobile-fly');
    if (btnFly) {
      btnFly.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('keydown', 'Space'); // Emit space twice quickly to fly
        setTimeout(() => eventBus.emit('keyup', 'Space'), 50);
        setTimeout(() => eventBus.emit('keydown', 'Space'), 100);
        setTimeout(() => eventBus.emit('keyup', 'Space'), 150);
      });
    }

    const btnInv = document.getElementById('btn-mobile-inv');
    if (btnInv) {
      btnInv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('keydown', 'KeyE');
        setTimeout(() => eventBus.emit('keyup', 'KeyE'), 50);
      });
    }

    const btnMenu = document.getElementById('btn-mobile-menu');
    if (btnMenu) {
      btnMenu.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('keydown', 'Escape');
        setTimeout(() => eventBus.emit('keyup', 'Escape'), 50);
      });
    }

    const btnBreak = document.getElementById('btn-mobile-break');
    if (btnBreak) {
      btnBreak.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('click_left');
        setTimeout(() => eventBus.emit('release_left'), 100);
      });
    }

    const btnPlace = document.getElementById('btn-mobile-place');
    if (btnPlace) {
      btnPlace.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('click_right');
        setTimeout(() => eventBus.emit('release_right'), 100);
      });
    }
  }

  private updateJoystick(touch: Touch, knob: HTMLElement) {
    const dx = touch.clientX - this.joystickOrigin.x;
    const dy = touch.clientY - this.joystickOrigin.y;
    const distance = Math.min(35, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);

    const nx = Math.cos(angle) * distance;
    const ny = Math.sin(angle) * distance;

    knob.style.transform = `translate(${nx}px, ${ny}px)`;

    // Convert to WASD
    const threshold = 15;
    const setVirtualKey = (code: string, state: boolean) => {
      const wasDown = this.virtualKeys.get(code) || false;
      this.virtualKeys.set(code, state);
      if (state && !wasDown) eventBus.emit('keydown', code);
      if (!state && wasDown) eventBus.emit('keyup', code);
    };

    setVirtualKey('KeyW', ny < -threshold);
    setVirtualKey('KeyS', ny > threshold);
    setVirtualKey('KeyA', nx < -threshold);
    setVirtualKey('KeyD', nx > threshold);
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
    return (this.keys.get(code) || false) || (this.virtualKeys?.get(code) || false);
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
