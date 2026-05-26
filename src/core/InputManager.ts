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

    // Bind classic D-pad direction buttons
    const bindDpad = (id: string, code: string) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      
      const onStart = (e: TouchEvent) => {
        e.preventDefault();
        setVirtualKey(code, true);
        btn.classList.add('active');
      };
      
      const onEnd = (e: TouchEvent) => {
        e.preventDefault();
        setVirtualKey(code, false);
        btn.classList.remove('active');
      };
      
      btn.addEventListener('touchstart', onStart);
      btn.addEventListener('touchend', onEnd);
      btn.addEventListener('touchcancel', onEnd);
    };

    bindDpad('btn-dpad-up', 'KeyW');
    bindDpad('btn-dpad-left', 'KeyA');
    bindDpad('btn-dpad-right', 'KeyD');
    bindDpad('btn-dpad-down', 'KeyS');

    // Bind D-pad Center crouch toggle button
    const btnCenter = document.getElementById('btn-dpad-center');
    if (btnCenter) {
      let isCrouching = false;
      btnCenter.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isCrouching = !isCrouching;
        setVirtualKey('ShiftLeft', isCrouching);
        
        if (isCrouching) {
          btnCenter.classList.add('active');
          btnCenter.textContent = '◆'; // filled diamond when crouching
        } else {
          btnCenter.classList.remove('active');
          btnCenter.textContent = '◇'; // hollow diamond when standing
        }
      });
    }

    // Touch look tracking outside D-pad and Hotbar
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && !target.closest('#classic-dpad') && !target.closest('.hotbar-wrapper')) {
        const touch = e.changedTouches[0];
        (this as any).lastTouchX = touch.clientX;
        (this as any).lastTouchY = touch.clientY;
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if ((this as any).lastTouchX !== undefined) {
        let touch: Touch | null = null;
        for (let i = 0; i < e.touches.length; i++) {
          const t = e.touches[i];
          const target = t.target as HTMLElement;
          if (target.tagName !== 'BUTTON' && !target.closest('#classic-dpad') && !target.closest('.hotbar-wrapper')) {
            touch = t;
            break;
          }
        }
        if (touch) {
          const deltaX = touch.clientX - (this as any).lastTouchX;
          const deltaY = touch.clientY - (this as any).lastTouchY;
          this.mouseDeltaX += deltaX * 1.5; // sensitivity scale
          this.mouseDeltaY += deltaY * 1.5;
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

    // Generic Action Button binder
    const bindBtn = (id: string, code: string) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); setVirtualKey(code, true); });
      btn.addEventListener('touchend', (e) => { e.preventDefault(); setVirtualKey(code, false); });
      btn.addEventListener('touchcancel', (e) => { e.preventDefault(); setVirtualKey(code, false); });
    };

    bindBtn('btn-mobile-sprint', 'ControlLeft');
    bindBtn('btn-flight-higher', 'Space');
    bindBtn('btn-flight-lower', 'ShiftLeft');

    // Jump button with double-tap flying toggle
    const btnJump = document.getElementById('btn-mobile-jump');
    if (btnJump) {
      let lastJumpTap = 0;
      btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setVirtualKey('Space', true);
        const now = performance.now();
        if (now - lastJumpTap < 300) {
          // Double tap detected: simulate a quick space press sequence to toggle flight
          setTimeout(() => {
            setVirtualKey('Space', false);
            setTimeout(() => {
              setVirtualKey('Space', true);
              setTimeout(() => {
                setVirtualKey('Space', false);
              }, 50);
            }, 50);
          }, 50);
        }
        lastJumpTap = now;
      });
      btnJump.addEventListener('touchend', (e) => {
        e.preventDefault();
        setVirtualKey('Space', false);
      });
      btnJump.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        setVirtualKey('Space', false);
      });
    }

    // Stop flight button simulation
    const btnStop = document.getElementById('btn-flight-stop');
    if (btnStop) {
      btnStop.addEventListener('touchstart', (e) => {
        e.preventDefault();
        // Simulate double-press on Space to toggle flight off
        setVirtualKey('Space', true);
        setTimeout(() => {
          setVirtualKey('Space', false);
          setTimeout(() => {
            setVirtualKey('Space', true);
            setTimeout(() => {
              setVirtualKey('Space', false);
            }, 50);
          }, 50);
        }, 50);
      });
    }

    // Inventory Triple Dot toggling E key
    const btnDots = document.getElementById('btn-mobile-dots');
    if (btnDots) {
      btnDots.addEventListener('touchstart', (e) => {
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

    // Listen to status messages to show/hide flight panel
    eventBus.on('status_message', (msg: string) => {
      const flightPanel = document.getElementById('flight-controls-panel');
      if (flightPanel) {
        if (msg === 'Flight Enabled') {
          flightPanel.classList.remove('hidden');
        } else if (msg === 'Flight Disabled') {
          flightPanel.classList.add('hidden');
        }
      }
    });
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
