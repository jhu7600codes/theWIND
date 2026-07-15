import './style.css';
import { createEngine, GameLoop, type Engine, type GameMode, type ModeEvents } from './engine/Engine.ts';
import * as Storage from './engine/Storage.ts';
import { SKINS, type ModeId, type Settings } from './types.ts';
import { MODE_META, TUTORIALS } from './ui/tutorials.ts';
import { PLAYER_SCHEMES } from './modes/partyShared.ts';
import { NormalMode } from './modes/NormalMode.ts';
import { FreeRoamMode } from './modes/FreeRoamMode.ts';
import { BirdMode } from './modes/BirdMode.ts';
import { HumanMode } from './modes/HumanMode.ts';
import { StoryMode } from './modes/StoryMode.ts';
import { MultiplayerMode } from './modes/MultiplayerMode.ts';
import { BagPartyMode } from './modes/BagPartyMode.ts';

const MODE_ORDER: ModeId[] = ['normal', 'freeroam', 'bird', 'human', 'story', 'multiplayer', 'bagparty'];
const PARTY_MODES: ModeId[] = ['multiplayer', 'bagparty'];

function buildMode(id: ModeId, playerCount: number): GameMode {
  switch (id) {
    case 'normal':
      return new NormalMode();
    case 'freeroam':
      return new FreeRoamMode();
    case 'bird':
      return new BirdMode();
    case 'human':
      return new HumanMode();
    case 'story':
      return new StoryMode();
    case 'multiplayer':
      return new MultiplayerMode(playerCount);
    case 'bagparty':
      return new BagPartyMode(playerCount);
  }
}

function formatScore(score: number, label?: string): string {
  const s = Math.max(0, score);
  switch (label) {
    case 'distance':
      return `${Math.round(s)}m`;
    case 'time': {
      const total = Math.round(s);
      const m = Math.floor(total / 60);
      const r = total % 60;
      return `${m}:${r.toString().padStart(2, '0')}`;
    }
    case 'catches':
      return `${Math.round(s)} caught`;
    case 'posts':
      return `${Math.round(s)} posted`;
    case 'progress':
      return `${Math.round(s)}%`;
    default:
      return `${Math.round(s)}`;
  }
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

// ---------- App shell DOM ----------
const app = document.getElementById('app')!;
app.innerHTML = `
  <canvas id="game-canvas"></canvas>
  <div id="hud">
    <div id="hud-top">
      <div id="hud-score">0</div>
      <div id="hud-mode-label"></div>
      <button id="pause-btn" aria-label="Pause">II</button>
    </div>
    <div id="hud-objective" class="hidden"></div>
  </div>
  <button id="shutter-btn" aria-label="Take photo"></button>
  <div id="photo-popup"></div>
  <div id="toast"></div>
  <div id="overlay"><div class="screen" id="screen"></div></div>
`;

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudScore = document.getElementById('hud-score')!;
const hudModeLabel = document.getElementById('hud-mode-label')!;
const hudObjective = document.getElementById('hud-objective')!;
const pauseBtn = document.getElementById('pause-btn')!;
const shutterBtn = document.getElementById('shutter-btn')!;
const photoPopup = document.getElementById('photo-popup')!;
const overlay = document.getElementById('overlay')!;
const screenEl = document.getElementById('screen')!;
const toastEl = document.getElementById('toast')!;

// ---------- Persistent state ----------
const settings: Settings = Storage.loadSettings();
let skinId = Storage.loadSelectedSkin();
let unlocks = refreshUnlocks();

const engine: Engine = createEngine(canvas, settings, skinId);
const loop = new GameLoop(engine);

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  engine.width = w;
  engine.height = h;
  engine.camera.width = w;
  engine.camera.height = h;
}
window.addEventListener('resize', resize);
resize();

let audioUnlocked = false;
function unlockAudioOnce(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;
  void engine.audio.unlock();
}
window.addEventListener('pointerdown', unlockAudioOnce, { once: true });
window.addEventListener('keydown', unlockAudioOnce, { once: true });

// ---------- App state machine ----------
type ScreenName = 'main' | 'modes' | 'playercount' | 'tutorial' | 'settings' | 'leaderboard' | 'skins' | 'paused' | 'gameover';

let currentModeId: ModeId | null = null;
let currentPlayerCount = 2;
let tutorialStep = 0;
let lbTab: ModeId = 'normal';
let latestScore = 0;
let latestScoreLabel: string | undefined;
let toastTimer = 0;
let objectiveTimer = 0;
let lastGameOver = { score: 0, label: undefined as string | undefined, isHighScore: false };

function refreshUnlocks(): Set<string> {
  const board = Storage.loadLeaderboard();
  let best = 0;
  for (const key of Object.keys(board)) {
    for (const e of board[key]) best = Math.max(best, e.score);
  }
  const u = Storage.loadUnlocks();
  for (const skin of SKINS) if (best >= skin.unlockScore) u.add(skin.id);
  Storage.saveUnlocks(u);
  return u;
}

function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 2400);
}

function setObjective(text: string | null): void {
  if (!text) {
    hudObjective.classList.add('hidden');
    return;
  }
  hudObjective.textContent = text;
  hudObjective.classList.remove('hidden');
  window.clearTimeout(objectiveTimer);
  objectiveTimer = window.setTimeout(() => hudObjective.classList.add('hidden'), 7000);
}

function showPhotoPopup(dataUrl: string, graded: { framed: boolean; message: string }): void {
  photoPopup.innerHTML = `
    <div class="polaroid">
      <img src="${dataUrl}" alt="captured bag photo" />
      <div class="caption">${graded.framed ? '✅' : '⚠️'} ${escapeHtml(graded.message)}</div>
    </div>`;
  photoPopup.classList.add('visible');
  window.setTimeout(() => photoPopup.classList.remove('visible'), 2200);
}

// ---------- Overlay show/hide ----------
function openOverlay(): void {
  overlay.classList.remove('hidden');
}
function closeOverlay(): void {
  overlay.classList.add('hidden');
}

function showScreen(name: ScreenName): void {
  openOverlay();
  screenEl.innerHTML = renderScreen(name);
}

function renderScreen(name: ScreenName): string {
  switch (name) {
    case 'main':
      return mainMenuScreen();
    case 'modes':
      return modesScreen();
    case 'playercount':
      return playerCountScreen();
    case 'tutorial':
      return tutorialScreen();
    case 'settings':
      return settingsScreen();
    case 'leaderboard':
      return leaderboardScreen();
    case 'skins':
      return skinsScreen();
    case 'paused':
      return pausedScreen();
    case 'gameover':
      return gameOverScreen();
  }
}

// ---------- Screens ----------
function mainMenuScreen(): string {
  return `
    <h1>theWIND 🍃</h1>
    <div class="subtitle">a chill and chaotic paper bag flying game</div>
    <button class="btn primary" data-action="goto" data-value="modes">▶ Play</button>
    <div class="row">
      <button class="btn secondary" data-action="goto" data-value="skins">🎨 Skins</button>
      <button class="btn secondary" data-action="goto" data-value="leaderboard">🏆 Scores</button>
    </div>
    <button class="btn secondary" data-action="goto" data-value="settings">⚙ Settings</button>
  `;
}

function modesScreen(): string {
  const items = MODE_ORDER.map((id) => {
    const meta = MODE_META[id];
    return `<button class="btn" data-action="pick-mode" data-value="${id}">
      <div class="mode-row">
        <div class="mode-icon">${meta.icon}</div>
        <div class="mode-text"><b>${meta.title}</b><span>${meta.blurb}</span></div>
      </div>
    </button>`;
  }).join('');
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="main">←</button>
      <h2>Choose a mode</h2>
    </div>
    ${items}
  `;
}

function playerCountScreen(): string {
  const modeId = currentModeId!;
  const isManagerMode = modeId === 'bagparty';
  currentPlayerCount = Math.max(2, Math.min(4, currentPlayerCount));
  const schemes = isManagerMode
    ? [`P1 (manager, wind): WASD`, ...PLAYER_SCHEMES.slice(1, currentPlayerCount).map((s, i) => `P${i + 2} (bag): ${s.toUpperCase()}`)]
    : PLAYER_SCHEMES.slice(0, currentPlayerCount).map((s, i) => `P${i + 1} (bag): ${s.toUpperCase()}`);
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="modes">←</button>
      <h2>${MODE_META[modeId].title} — how many players?</h2>
    </div>
    <div class="stepper">
      <button data-action="pc-delta" data-value="-1">−</button>
      <div class="count">${currentPlayerCount}</div>
      <button data-action="pc-delta" data-value="1">+</button>
    </div>
    <div class="scheme-list">${schemes.map((s) => `<div>${s}</div>`).join('')}</div>
    <div class="subtitle">Everyone plays together on this device/keyboard.</div>
    <button class="btn primary" data-action="pc-confirm">Continue</button>
  `;
}

function tutorialScreen(): string {
  const modeId = currentModeId!;
  const steps = TUTORIALS[modeId];
  tutorialStep = Math.max(0, Math.min(steps.length - 1, tutorialStep));
  const step = steps[tutorialStep];
  const isLast = tutorialStep === steps.length - 1;
  const dots = steps.map((_, i) => `<span class="${i === tutorialStep ? 'active' : ''}"></span>`).join('');
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="modes">←</button>
      <h2>${MODE_META[modeId].icon} ${MODE_META[modeId].title}</h2>
    </div>
    <div class="tutorial-step">
      <h2>${escapeHtml(step.title)}</h2>
      <p>${escapeHtml(step.body)}</p>
    </div>
    <div class="tutorial-dots">${dots}</div>
    <button class="btn primary" data-action="tutorial-next">${isLast ? "Let's fly →" : 'Next'}</button>
    <button class="btn secondary" data-action="tutorial-skip">Skip tutorial</button>
  `;
}

function settingsScreen(): string {
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="main">←</button>
      <h2>Settings</h2>
    </div>
    <div class="field">
      <label><span>Sensitivity</span><span>${settings.sensitivity.toFixed(2)}x</span></label>
      <input type="range" min="0.4" max="2" step="0.05" value="${settings.sensitivity}" data-field="sensitivity" />
    </div>
    <div class="field">
      <label><span>Volume</span><span>${Math.round(settings.volume * 100)}%</span></label>
      <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-field="volume" />
    </div>
    <div class="field toggle-row">
      <span>Muted</span>
      <button class="switch ${settings.muted ? 'on' : ''}" data-action="toggle" data-value="muted"></button>
    </div>
    <div class="field toggle-row">
      <span>Show tutorials before each mode</span>
      <button class="switch ${settings.showTutorials ? 'on' : ''}" data-action="toggle" data-value="showTutorials"></button>
    </div>
    <div class="field toggle-row">
      <span>Reduced motion</span>
      <button class="switch ${settings.reducedMotion ? 'on' : ''}" data-action="toggle" data-value="reducedMotion"></button>
    </div>
  `;
}

function guessLabel(id: ModeId): string {
  if (id === 'normal' || id === 'multiplayer') return 'distance';
  if (id === 'freeroam' || id === 'bagparty') return 'time';
  if (id === 'bird') return 'catches';
  if (id === 'human') return 'posts';
  return '';
}

function leaderboardScreen(): string {
  const board = Storage.loadLeaderboard();
  const tabs = MODE_ORDER.map((id) => `<button class="lb-tab ${id === lbTab ? 'active' : ''}" data-action="lb-tab" data-value="${id}">${MODE_META[id].title}</button>`).join('');
  const list = (board[lbTab] ?? []).slice(0, 10);
  const rows = list.length
    ? list.map((e, i) => `<div class="lb-row"><span class="rank">#${i + 1}</span><span>${formatScore(e.score, guessLabel(lbTab))}</span><span>${new Date(e.date).toLocaleDateString()}</span></div>`).join('')
    : `<div class="subtitle">No runs yet — go fly!</div>`;
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="main">←</button>
      <h2>Leaderboard</h2>
    </div>
    <div class="lb-tabs">${tabs}</div>
    ${rows}
  `;
}

function skinsScreen(): string {
  const cards = SKINS.map((s) => {
    const unlocked = unlocks.has(s.id);
    const selected = s.id === skinId;
    return `<div class="skin-card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-action="${unlocked ? 'set-skin' : 'noop'}" data-value="${s.id}">
      <div class="skin-swatch" style="background:${s.colors.main}"></div>
      <div>${s.name}</div>
      ${unlocked ? '' : `<div style="opacity:.7">🔒 ${s.unlockScore}pt</div>`}
    </div>`;
  }).join('');
  return `
    <div class="top-nav">
      <button class="back" data-action="goto" data-value="main">←</button>
      <h2>Bag Skins</h2>
    </div>
    <div class="skin-grid">${cards}</div>
    <div class="subtitle" style="margin-top:14px">Unlock skins by setting high scores in any mode.</div>
  `;
}

function pausedScreen(): string {
  const showEndRun = currentModeId !== null && currentModeId !== 'freeroam';
  return `
    <h2>Paused</h2>
    <button class="btn primary" data-action="resume">▶ Resume</button>
    <button class="btn secondary" data-action="restart">⟲ Restart</button>
    ${showEndRun ? `<button class="btn secondary" data-action="end-run">🏁 End Run &amp; Save Score</button>` : ''}
    <button class="btn secondary" data-action="goto" data-value="settings">⚙ Settings</button>
    <button class="btn secondary" data-action="main-menu">🏠 Main Menu</button>
  `;
}

function gameOverScreen(): string {
  const { score, label, isHighScore } = lastGameOver;
  return `
    <h2>${currentModeId === 'story' ? 'The End' : 'Run over'}</h2>
    ${isHighScore ? `<div class="high-badge">🎉 New high score!</div>` : ''}
    <div class="score-big">${formatScore(score, label)}</div>
    <button class="btn primary" data-action="play-again">↻ Play Again</button>
    <button class="btn secondary" data-action="goto" data-value="modes">🔀 Change Mode</button>
    <button class="btn secondary" data-action="main-menu">🏠 Main Menu</button>
  `;
}

// ---------- Game flow ----------
function pickMode(id: ModeId): void {
  currentModeId = id;
  if (PARTY_MODES.includes(id)) {
    currentPlayerCount = id === 'bagparty' ? 3 : 2;
    showScreen('playercount');
    return;
  }
  proceedToTutorialOrGame();
}

function proceedToTutorialOrGame(): void {
  const modeId = currentModeId!;
  const seenKey = 'tutorial:' + modeId;
  const seen = Storage.loadFlag(seenKey);
  if (settings.showTutorials || !seen) {
    tutorialStep = 0;
    showScreen('tutorial');
  } else {
    startGame();
  }
}

function startGame(): void {
  const modeId = currentModeId!;
  Storage.saveFlag('tutorial:' + modeId, true);
  closeOverlay();
  hudModeLabel.textContent = `${MODE_META[modeId].icon} ${MODE_META[modeId].title}`;
  shutterBtn.classList.toggle('visible', modeId === 'human');
  latestScore = 0;
  latestScoreLabel = undefined;
  hudScore.textContent = '0';

  const events: ModeEvents = {
    onScoreUpdate: (score, label) => {
      latestScore = score;
      latestScoreLabel = label;
      hudScore.textContent = formatScore(score, label);
    },
    onGameOver: (score) => endRun(score),
    onObjective: (text) => setObjective(text),
    onDialogue: (text) => {
      if (text) engine.audio.uiClick();
    },
    onPhoto: (dataUrl, graded) => showPhotoPopup(dataUrl, graded),
  };

  engine.skinId = skinId;
  const mode = buildMode(modeId, currentPlayerCount);
  loop.setMode(mode, events);
  loop.start();
}

function endRun(score: number): void {
  loop.stop();
  const modeId = currentModeId!;
  const { isHighScore } = Storage.submitScore(modeId, score);
  unlocks = refreshUnlocks();
  lastGameOver = { score, label: latestScoreLabel, isHighScore };
  window.setTimeout(() => showScreen('gameover'), modeId === 'normal' ? 500 : 150);
}

function togglePause(): void {
  if (!loop.running) return;
  loop.stop();
  showScreen('paused');
}

function resumeGame(): void {
  closeOverlay();
  loop.start();
}

// ---------- Event delegation ----------
overlay.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
  if (!target) return;
  const action = target.dataset.action!;
  const value = target.dataset.value;
  switch (action) {
    case 'goto':
      showScreen(value as ScreenName);
      break;
    case 'pick-mode':
      pickMode(value as ModeId);
      break;
    case 'pc-delta':
      currentPlayerCount = Math.max(2, Math.min(4, currentPlayerCount + Number(value)));
      showScreen('playercount');
      break;
    case 'pc-confirm':
      proceedToTutorialOrGame();
      break;
    case 'tutorial-next': {
      const steps = TUTORIALS[currentModeId!].length;
      if (tutorialStep < steps - 1) {
        tutorialStep++;
        showScreen('tutorial');
      } else {
        startGame();
      }
      break;
    }
    case 'tutorial-skip':
      startGame();
      break;
    case 'toggle': {
      const key = value as keyof Settings;
      (settings[key] as boolean) = !settings[key];
      Storage.saveSettings(settings);
      if (key === 'muted') engine.audio.setMuted(settings.muted);
      showScreen('settings');
      break;
    }
    case 'set-skin':
      skinId = value!;
      engine.skinId = skinId;
      Storage.saveSelectedSkin(skinId);
      showScreen('skins');
      break;
    case 'lb-tab':
      lbTab = value as ModeId;
      showScreen('leaderboard');
      break;
    case 'resume':
      resumeGame();
      break;
    case 'restart':
      startGame();
      break;
    case 'end-run':
      endRun(latestScore);
      break;
    case 'play-again':
      startGame();
      break;
    case 'main-menu':
      loop.stop();
      loop.teardownMode();
      currentModeId = null;
      shutterBtn.classList.remove('visible');
      hudScore.textContent = '0';
      setObjective(null);
      showScreen('main');
      break;
    case 'noop':
      toast('Keep playing to unlock this skin!');
      break;
  }
});

overlay.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  const field = target.dataset.field;
  if (!field) return;
  const v = Number(target.value);
  if (field === 'sensitivity') settings.sensitivity = v;
  if (field === 'volume') {
    settings.volume = v;
    engine.audio.setVolume(v);
  }
  Storage.saveSettings(settings);
  const label = target.parentElement?.querySelector('label span:last-child');
  if (label) label.textContent = field === 'sensitivity' ? `${v.toFixed(2)}x` : `${Math.round(v * 100)}%`;
});

pauseBtn.addEventListener('click', togglePause);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && loop.running) togglePause();
});

shutterBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  engine.input.simulatePress('Space');
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && loop.running) togglePause();
});

// apply persisted settings to audio immediately
engine.audio.setVolume(settings.volume);
engine.audio.setMuted(settings.muted);

showScreen('main');
