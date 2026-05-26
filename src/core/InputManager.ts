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
  // Joystick fields removed in favor of D-pad

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

    // Virtual Touch Joystick
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    
    if (joystickBase && joystickKnob) {
      let joystickActive = false;
      let startX = 0;
      let startY = 0;
      const maxDistance = 40; // max displacement in pixels

      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const rect = joystickBase.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
      });

      const handleJoystickMove = (clientX: number, clientY: number) => {
        if (!joystickActive) return;
        let deltaX = clientX - startX;
        let deltaY = clientY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > maxDistance) {
          deltaX = (deltaX / distance) * maxDistance;
          deltaY = (deltaY / distance) * maxDistance;
        }

        joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

        // Convert delta coordinates to virtual WASD keys
        const xPct = deltaX / maxDistance;
        const yPct = deltaY / maxDistance;

        // Reset
        setVirtualKey('KeyW', false);
        setVirtualKey('KeyS', false);
        setVirtualKey('KeyA', false);
        setVirtualKey('KeyD', false);

        // Apply deadzone and directions (threshold 0.3)
        if (yPct < -0.3) setVirtualKey('KeyW', true);
        if (yPct > 0.3) setVirtualKey('KeyS', true);
        if (xPct < -0.3) setVirtualKey('KeyA', true);
        if (xPct > 0.3) setVirtualKey('KeyD', true);
      };

      joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.targetTouches[0];
        handleJoystickMove(touch.clientX, touch.clientY);
      });

      const resetJoystick = () => {
        joystickActive = false;
        joystickKnob.style.transform = 'translate(0px, 0px)';
        setVirtualKey('KeyW', false);
        setVirtualKey('KeyS', false);
        setVirtualKey('KeyA', false);
        setVirtualKey('KeyD', false);
      };

      joystickBase.addEventListener('touchend', (e) => {
        e.preventDefault();
        resetJoystick();
      });

      joystickBase.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        resetJoystick();
      });
    }

    // Touch look tracking for right half of screen
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      // Do not look track if touch is on button or inside joystick container
      if (target.tagName !== 'BUTTON' && !target.closest('#joystick-container') && !target.closest('#joystick-base')) {
        const touch = e.changedTouches[0];
        if (touch.clientX > window.innerWidth / 2) {
          (this as any).lastTouchX = touch.clientX;
          (this as any).lastTouchY = touch.clientY;
        }
      }
    }, { passive: false });

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
          this.mouseDeltaX += deltaX * 2.0; // sensitivity scale
          this.mouseDeltaY += deltaY * 2.0;
          (this as any).lastTouchX = touch.clientX;
          (this as any).lastTouchY = touch.clientY;
        }
      }
    }, { passive: false });

    const endTouchLook = () => {
      (this as any).lastTouchX = undefined;
      (this as any).lastTouchY = undefined;
    };
    document.addEventListener('touchend', endTouchLook);
    document.addEventListener('touchcancel', endTouchLook);

    // Right Action Buttons
    const bindBtn = (id: string, code: string) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); setVirtualKey(code, true); });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); setVirtualKey(code, false); });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); setVirtualKey(code, false); });
    };

    bindBtn('btn-mobile-jump', 'Space');
    bindBtn('btn-mobile-sneak', 'ShiftLeft');
    bindBtn('btn-mobile-sprint', 'ControlLeft');

    // Fly button double taps space
    const btnFly = document.getElementById('btn-mobile-fly');
    if (btnFly) {
      btnFly.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('keydown', 'Space');
        setTimeout(() => eventBus.emit('keyup', 'Space'), 50);
        setTimeout(() => eventBus.emit('keydown', 'Space'), 100);
        setTimeout(() => eventBus.emit('keyup', 'Space'), 150);
      });
    }

    // Inventory button toggle
    const btnInv = document.getElementById('btn-mobile-inv');
    if (btnInv) {
      btnInv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('keydown', 'KeyE');
        setTimeout(() => eventBus.emit('keyup', 'KeyE'), 50);
      });
    }

    // Attack button clicks (Left Click)
    const btnAttack = document.getElementById('btn-mobile-attack');
    if (btnAttack) {
      btnAttack.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('click_left');
      });
      btnAttack.addEventListener('touchend', (e) => {
        e.preventDefault();
        eventBus.emit('release_left');
      });
      btnAttack.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        eventBus.emit('release_left');
      });
    }

    // Place button clicks (Right Click)
    const btnPlace = document.getElementById('btn-mobile-place');
    if (btnPlace) {
      btnPlace.addEventListener('touchstart', (e) => {
        e.preventDefault();
        eventBus.emit('click_right');
        setTimeout(() => eventBus.emit('release_right'), 100);
      });
    }
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
