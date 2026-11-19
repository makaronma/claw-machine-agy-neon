/**
 * 桌機／手機統一輸入管理器：
 * - 桌機：WASD / 方向鍵移動、Space 下爪/二收、滑鼠拖曳轉視角、滾輪縮放、E/Esc 進出機台
 * - 手機：螢幕虛擬搖桿（強制量化為與真實微動開關一致之數位方向開關）、紅色下爪鈕、雙指縮放與滑動轉視角
 */
export class InputManager {
  private keys = new Set<string>();
  private virtualX = 0;
  private virtualZ = 0;

  private dropQueued = false;
  private dropHeld = false;
  private interactQueued = false;
  private exitQueued = false;

  // 視角拖曳與滾輪增量
  private lookDeltaX = 0;
  private lookDeltaY = 0;
  private wheelDelta = 0;
  private isDraggingCanvas = false;
  private activePointerId: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistSq = 0;
  private clickTarget: { x: number; y: number } | null = null;

  // 雙指縮放追蹤
  private activeTouches = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
    if (code === 'Space' && !this.keys.has('Space')) {
      this.dropQueued = true;
      this.dropHeld = true;
    }
    if ((code === 'KeyE' || code === 'Enter') && !this.keys.has(code)) {
      this.interactQueued = true;
    }
    if (code === 'Escape' && !this.keys.has('Escape')) {
      this.exitQueued = true;
    }
    this.keys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'Space') {
      this.dropHeld = false;
    }
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.virtualX = 0;
    this.virtualZ = 0;
    this.dropHeld = false;
    this.isDraggingCanvas = false;
    this.activePointerId = null;
    this.activeTouches.clear();
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activeTouches.size === 2) {
      const pts = Array.from(this.activeTouches.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.isDraggingCanvas = false;
      return;
    }

    this.isDraggingCanvas = true;
    this.activePointerId = e.pointerId;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragDistSq = 0;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.activeTouches.has(e.pointerId)) {
      this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.activeTouches.size === 2) {
      const pts = Array.from(this.activeTouches.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.lastPinchDist > 0) {
        this.wheelDelta += (this.lastPinchDist - dist) * 4.2;
      }
      this.lastPinchDist = dist;
      return;
    }

    if (!this.isDraggingCanvas || e.pointerId !== this.activePointerId) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.dragDistSq += dx * dx + dy * dy;
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.activeTouches.delete(e.pointerId);
    if (this.activeTouches.size < 2) {
      this.lastPinchDist = 0;
    }

    if (e.pointerId === this.activePointerId) {
      if (this.dragDistSq < 36) {
        // 視為短點擊（用於店內點擊機台開玩）
        this.clickTarget = { x: e.clientX, y: e.clientY };
      }
      this.isDraggingCanvas = false;
      this.activePointerId = null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelDelta += e.deltaY;
  };

  /**
   * 虛擬搖桿輸入：依 chat.md 要求，強制轉換為與台灣機台微動開關一致的數位方向 (-1 / 0 / +1)
   */
  public setVirtualStick(normX: number, normY: number): void {
    const deadzone = 0.24;
    this.virtualX = Math.abs(normX) >= deadzone ? Math.sign(normX) : 0;
    this.virtualZ = Math.abs(normY) >= deadzone ? Math.sign(normY) : 0;
  }

  public triggerVirtualDrop(pressed: boolean): void {
    if (pressed && !this.dropHeld) {
      this.dropQueued = true;
    }
    this.dropHeld = pressed;
  }

  public getDigitalMove(): { x: number; z: number } {
    let kx = 0;
    let kz = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) kz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) kz += 1;

    return {
      x: kx !== 0 ? kx : this.virtualX,
      z: kz !== 0 ? kz : this.virtualZ,
    };
  }

  public isDropHeld(): boolean {
    return this.dropHeld;
  }

  public consumeDropPressed(): boolean {
    const v = this.dropQueued;
    this.dropQueued = false;
    return v;
  }

  public consumeInteractPressed(): boolean {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  public consumeExitPressed(): boolean {
    const v = this.exitQueued;
    this.exitQueued = false;
    return v;
  }

  public consumeLookDelta(): { dx: number; dy: number; wheel: number } {
    const res = { dx: this.lookDeltaX, dy: this.lookDeltaY, wheel: this.wheelDelta };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.wheelDelta = 0;
    return res;
  }

  public consumeCanvasClick(): { x: number; y: number } | null {
    const c = this.clickTarget;
    this.clickTarget = null;
    return c;
  }
}
