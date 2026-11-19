import { AppMode, MachinePhase, MachineProfile, PrizeCatalogItem } from '../types/machine';
import { InputManager } from '../game/inputManager';

export interface HudCallbacks {
  onSelectMachine: (index: number) => void;
  onExitMachine: () => void;
  onResetMachine: () => void;
  onResetCamera: () => void;
}

const PHASE_LABELS: Record<MachinePhase, string> = {
  AIM: '移動天車對位',
  DESCENT: '下爪中・再按可二收',
  BOTTOM_DWELL: '收爪夾取中',
  LIFT: '上升中',
  TOP_DWELL: '頂部停留',
  RETURN: '回洞口中',
  RELEASE: '鬆爪放開',
  SETTLE: '等待穩定',
};

/**
 * 極簡純玩家體驗介面：
 * - 店內走動模式：顯示靠近機台開玩提示、底部快速選台列、戰利品計數
 * - 機台遊玩模式：頂部機台名稱與返回／重置視角／重置機台按鈕、左下虛擬微動搖桿、右下紅色下爪／二收按鈕
 */
export class HudManager {
  private root: HTMLElement;
  private topLeftBadge!: HTMLElement;
  private topRightActions!: HTMLElement;
  private wonCountEl!: HTMLElement;
  private phasePill!: HTMLElement;
  private nearPromptEl!: HTMLButtonElement;
  private machineQuickBar!: HTMLElement;
  private playControlsEl!: HTMLElement;
  private dropBtnEl!: HTMLButtonElement;
  private dropSubEl!: HTMLElement;
  private joystickBase!: HTMLElement;
  private joystickKnob!: HTMLElement;
  private toastContainer!: HTMLElement;
  private hintBarEl!: HTMLElement;

  private joyPointerId: number | null = null;
  private nearMachineIndex: number | null = null;
  private wonCount = 0;

  constructor(
    container: HTMLElement,
    private readonly profiles: MachineProfile[],
    private readonly input: InputManager,
    private readonly callbacks: HudCallbacks
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud-root';
    container.appendChild(this.root);

    this.buildDom();
    this.bindJoystick();
    this.bindDropButton();
  }

  private buildDom(): void {
    // 1. 頂部列
    const topBar = document.createElement('div');
    topBar.className = 'hud-top-bar';

    this.topLeftBadge = document.createElement('div');
    this.topLeftBadge.className = 'hud-pill hud-title-pill';
    this.topLeftBadge.innerHTML = `<span class="dot-live"></span><span class="title-text">台灣 24H 夾娃娃店</span>`;

    const rightWrap = document.createElement('div');
    rightWrap.className = 'hud-top-right';

    const prizeCounter = document.createElement('div');
    prizeCounter.className = 'hud-pill hud-prize-pill';
    prizeCounter.innerHTML = `🎁 已夾出 <strong class="won-count">0</strong>`;
    this.wonCountEl = prizeCounter.querySelector('.won-count')!;

    this.topRightActions = document.createElement('div');
    this.topRightActions.className = 'hud-play-actions hidden';
    this.topRightActions.innerHTML = `
      <button type="button" class="hud-btn" data-act="cam">正視鏡頭</button>
      <button type="button" class="hud-btn" data-act="reset">重置機台</button>
      <button type="button" class="hud-btn hud-btn-primary" data-act="exit">離開機台</button>
    `;

    this.topRightActions.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === 'cam') this.callbacks.onResetCamera();
      if (act === 'reset') this.callbacks.onResetMachine();
      if (act === 'exit') this.callbacks.onExitMachine();
    });

    rightWrap.append(prizeCounter, this.topRightActions);
    topBar.append(this.topLeftBadge, rightWrap);

    // 2. 機台狀態小膠囊（遊玩時顯示）
    this.phasePill = document.createElement('div');
    this.phasePill.className = 'hud-phase-pill hidden';

    // 3. 靠近機台互動提示（店內走動時）
    this.nearPromptEl = document.createElement('button');
    this.nearPromptEl.type = 'button';
    this.nearPromptEl.className = 'hud-near-prompt hidden';
    this.nearPromptEl.addEventListener('click', () => {
      if (this.nearMachineIndex !== null) {
        this.callbacks.onSelectMachine(this.nearMachineIndex);
      }
    });

    // 4. 店內底部機台快速選單（可走動靠近，也可直接點選跳台）
    this.machineQuickBar = document.createElement('div');
    this.machineQuickBar.className = 'hud-quick-bar';
    this.profiles.forEach((p, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hud-quick-chip';
      b.innerHTML = `<span class="chip-num">0${idx + 1}</span><span class="chip-tag">${p.shortTag}</span>`;
      b.addEventListener('click', () => this.callbacks.onSelectMachine(idx));
      this.machineQuickBar.appendChild(b);
    });

    // 5. 操作控制層（左下虛擬搖桿＋右下紅色下爪大按鈕）
    this.playControlsEl = document.createElement('div');
    this.playControlsEl.className = 'hud-controls';

    const joyWrap = document.createElement('div');
    joyWrap.className = 'joystick-wrap';
    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'joystick-base';
    this.joystickBase.innerHTML = `
      <span class="joy-arrow up">▲</span>
      <span class="joy-arrow down">▼</span>
      <span class="joy-arrow left">◀</span>
      <span class="joy-arrow right">▶</span>
    `;
    this.joystickKnob = document.createElement('div');
    this.joystickKnob.className = 'joystick-knob';
    this.joystickBase.appendChild(this.joystickKnob);
    joyWrap.appendChild(this.joystickBase);

    const dropWrap = document.createElement('div');
    dropWrap.className = 'drop-btn-wrap';
    this.dropBtnEl = document.createElement('button');
    this.dropBtnEl.type = 'button';
    this.dropBtnEl.className = 'red-drop-btn';
    this.dropBtnEl.innerHTML = `<span class="drop-main">下爪</span><span class="drop-sub">SPACE</span>`;
    this.dropSubEl = this.dropBtnEl.querySelector('.drop-sub')!;
    dropWrap.appendChild(this.dropBtnEl);

    this.playControlsEl.append(joyWrap, dropWrap);

    // 6. 底部極簡鍵盤/手勢提示
    this.hintBarEl = document.createElement('div');
    this.hintBarEl.className = 'hud-hint-bar';
    this.hintBarEl.textContent = 'WASD 走動・拖曳轉視角・點擊任一機台或按 E 開玩';

    // 7. 獎品出貨通知
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'hud-toast-container';

    this.root.append(
      topBar,
      this.phasePill,
      this.nearPromptEl,
      this.toastContainer,
      this.playControlsEl,
      this.machineQuickBar,
      this.hintBarEl
    );
  }

  private bindJoystick(): void {
    const maxRadius = 42;

    const updateStick = (clientX: number, clientY: number) => {
      const rect = this.joystickBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.setVirtualStick(dx / maxRadius, dy / maxRadius);
    };

    const resetStick = () => {
      this.joyPointerId = null;
      this.joystickKnob.style.transform = 'translate(0px, 0px)';
      this.input.setVirtualStick(0, 0);
    };

    this.joystickBase.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.joyPointerId = e.pointerId;
      this.joystickBase.setPointerCapture(e.pointerId);
      updateStick(e.clientX, e.clientY);
    });

    this.joystickBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.stopPropagation();
      updateStick(e.clientX, e.clientY);
    });

    this.joystickBase.addEventListener('pointerup', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      e.stopPropagation();
      resetStick();
    });

    this.joystickBase.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== this.joyPointerId) return;
      resetStick();
    });
  }

  private bindDropButton(): void {
    this.dropBtnEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dropBtnEl.classList.add('pressed');
      this.input.triggerVirtualDrop(true);
    });
    const release = (e: Event) => {
      e.stopPropagation();
      this.dropBtnEl.classList.remove('pressed');
      this.input.triggerVirtualDrop(false);
    };
    this.dropBtnEl.addEventListener('pointerup', release);
    this.dropBtnEl.addEventListener('pointerleave', release);
    this.dropBtnEl.addEventListener('pointercancel', release);
  }

  public setMode(mode: AppMode, activeProfile?: MachineProfile): void {
    const inMachine = mode === 'MACHINE_PLAY' || mode === 'TRANSITION_IN';
    this.topRightActions.classList.toggle('hidden', !inMachine);
    this.phasePill.classList.toggle('hidden', mode !== 'MACHINE_PLAY');
    this.machineQuickBar.classList.toggle('hidden', inMachine);
    this.dropBtnEl.parentElement!.classList.toggle('hidden', !inMachine);

    // 搖桿在店內（手機走動）與機台內（天車控制）皆可使用
    this.playControlsEl.classList.toggle('walk-only', !inMachine);

    const titleText = this.topLeftBadge.querySelector('.title-text')!;
    if (inMachine && activeProfile) {
      titleText.textContent = activeProfile.displayName;
      this.nearPromptEl.classList.add('hidden');
      this.hintBarEl.textContent = 'WASD／方向鍵移天車・Space 下爪／二收・拖曳畫面 360° 觀察洞口・Esc 返回走道';
    } else {
      titleText.textContent = '台灣 24H 夾娃娃店';
      this.hintBarEl.textContent = 'WASD／搖桿走動・拖曳轉視角・點擊機台或按 E 開玩';
    }
  }

  public updateMachinePhase(phase: MachinePhase, midAirEnabled: boolean): void {
    this.phasePill.textContent = PHASE_LABELS[phase];
    const mainSpan = this.dropBtnEl.querySelector('.drop-main')!;
    if (phase === 'DESCENT' && midAirEnabled) {
      mainSpan.textContent = '二收';
      this.dropSubEl.textContent = '空中收爪';
      this.dropBtnEl.classList.add('midair-ready');
    } else {
      mainSpan.textContent = '下爪';
      this.dropSubEl.textContent = 'SPACE';
      this.dropBtnEl.classList.remove('midair-ready');
    }
  }

  public setNearestMachine(profile: MachineProfile | null, index: number | null): void {
    this.nearMachineIndex = index;
    if (!profile || index === null) {
      this.nearPromptEl.classList.add('hidden');
      return;
    }
    this.nearPromptEl.classList.remove('hidden');
    this.nearPromptEl.innerHTML = `
      <span class="near-title">${profile.displayName}</span>
      <span class="near-sub">${profile.shortTag}・點擊開玩（或按 E）</span>
    `;
  }

  public notifyPrizeWon(prize: PrizeCatalogItem): void {
    this.wonCount += 1;
    this.wonCountEl.textContent = String(this.wonCount);

    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.innerHTML = `
      <div class="toast-icon">🎉</div>
      <div class="toast-body">
        <div class="toast-title">出貨成功！</div>
        <div class="toast-name">${prize.displayName}</div>
      </div>
    `;
    this.toastContainer.appendChild(toast);
    window.setTimeout(() => {
      toast.classList.add('fade-out');
      window.setTimeout(() => toast.remove(), 350);
    }, 3200);
  }
}
