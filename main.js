import { mountSelection } from './src/ui/selection.js';
import { mountBattle } from './src/ui/battleScreen.js';

const STORAGE_KEY = 'pba:settings:v1';
const DIFFICULTIES = [
  { id: 'easy', label: 'FÁCIL' },
  { id: 'normal', label: 'NORMAL' },
  { id: 'hard', label: 'DIFÍCIL' },
];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function loadSettings() {
  const defaults = { difficulty: 'normal', muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      difficulty: DIFFICULTIES.some((item) => item.id === saved?.difficulty) ? saved.difficulty : defaults.difficulty,
      muted: Boolean(saved?.muted),
    };
  } catch {
    return defaults;
  }
}

const state = { screen: 'title', playerId: null, settings: loadSettings() };
const screens = Object.fromEntries($$('.screen').map((screen) => [screen.dataset.screen, screen]));
const controllers = { selection: null, battle: null };
const music = $('#battle-music');
let busy = false;
let musicUnlocked = false;
let navigationToken = 0;
let battleGeneration = 0;
let pendingBattleAbort = null;

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  } catch {}
}

function syncMusic() {
  if (!music) return;
  music.volume = 0.28;
  if (state.settings.muted) music.pause();
  else if (musicUnlocked) music.play()?.catch?.(() => {});
}

function unlockMusic() {
  musicUnlocked = true;
  syncMusic();
}

function applySettings() {
  const difficulty = DIFFICULTIES.find((item) => item.id === state.settings.difficulty);
  $('#difficulty-label').textContent = difficulty.label;
  $('#sound-label').textContent = state.settings.muted ? 'DESLIGADA' : 'LIGADA';
  document.documentElement.dataset.difficulty = difficulty.id;
  document.documentElement.dataset.muted = String(state.settings.muted);
  syncMusic();
}

function focusScreen(name) {
  const root = screens[name];
  const target = $('[data-autofocus]', root) ?? $('button:not([disabled])', root);
  target?.focus({ preventScroll: true });
}

function destroyController(name) {
  if (name === 'battle') {
    battleGeneration += 1;
    pendingBattleAbort?.abort();
    pendingBattleAbort = null;
  }
  try {
    controllers[name]?.destroy?.();
  } catch (error) {
    console.warn('[main] Não foi possível limpar ' + name + ':', error);
  }
  controllers[name] = null;
}

async function enterSelection() {
  state.playerId = null;
  $('#btn-confirm').disabled = true;
  if (controllers.selection) {
    controllers.selection.reset?.();
    return;
  }
  try {
    controllers.selection = await mountSelection(screens.selection, {
      onSelect(id) {
        state.playerId = id;
        $('#btn-confirm').disabled = false;
      },
      onConfirm(id) {
        state.playerId = id;
        startBattle();
      },
    });
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'preview__hint';
    message.textContent = error.message || 'Não foi possível carregar os Pokémon.';
    $('#selection-preview').replaceChildren(message);
  }
}

async function enterBattle() {
  destroyController('battle');
  const generation = ++battleGeneration;
  const mountAbort = new AbortController();
  pendingBattleAbort = mountAbort;
  $('#battle-result').hidden = true;
  $('#battle-result').dataset.outcome = '';
  $$('.sprite', screens.battle).forEach((sprite) => {
    sprite.classList.remove('is-entering', 'is-attacking-player', 'is-attacking-enemy', 'is-hit', 'is-fainting');
    sprite.style.opacity = '';
    sprite.style.translate = '';
  });
  $('#player-sprite-fallback').hidden = true;
  $('#enemy-sprite-fallback').hidden = true;
  $('#battle-dialog').dataset.mode = 'text';
  $('#battle-text').textContent = 'Preparando a batalha…';
  $('#move-buttons').replaceChildren();
  $('#move-info').replaceChildren();

  try {
    const controller = await mountBattle(screens.battle, {
      playerId: state.playerId,
      difficulty: state.settings.difficulty,
      onExit: () => go('menu'),
      signal: mountAbort.signal,
    });
    if (generation !== battleGeneration || state.screen !== 'battle') {
      controller?.destroy?.();
      return;
    }
    controllers.battle = controller;
  } catch (error) {
    if (generation === battleGeneration && state.screen === 'battle') {
      $('#battle-text').textContent = error.message || 'Não foi possível iniciar a batalha.';
      $('#battle-dialog').dataset.mode = 'actions';
      $('#btn-fight').hidden = true;
      $('#btn-quit').focus({ preventScroll: true });
    }
  } finally {
    if (pendingBattleAbort === mountAbort) pendingBattleAbort = null;
  }
}

const onEnter = {
  menu() { $('#menu-hint').textContent = ''; },
  selection: enterSelection,
  battle: enterBattle,
};

async function go(name, { force = false } = {}) {
  if (busy || !screens[name] || (name === state.screen && !force)) return;
  busy = true;
  const token = ++navigationToken;
  const fade = $('#fade');
  try {
    if (!reducedMotion.matches) {
      fade.classList.add('is-on');
      await wait(180);
    }
    if (state.screen === 'battle') destroyController('battle');
    Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });
    state.screen = name;
  } finally {
    fade.classList.remove('is-on');
    busy = false;
  }

  try {
    await onEnter[name]?.();
  } finally {
    if (token === navigationToken && state.screen === name) focusScreen(name);
  }
}

function startBattle() {
  if (state.playerId != null) go('battle', { force: true });
}

const actions = {
  play: () => go('selection'),
  difficulty() {
    const current = DIFFICULTIES.findIndex((item) => item.id === state.settings.difficulty);
    state.settings.difficulty = DIFFICULTIES[(current + 1) % DIFFICULTIES.length].id;
    applySettings();
    saveSettings();
  },
  sound() {
    state.settings.muted = !state.settings.muted;
    applySettings();
    saveSettings();
  },
  confirm: startBattle,
  rematch: startBattle,
};

function navigate(event) {
  const group = event.target.closest?.('[data-nav]');
  if (!group) return;
  const columns = Math.max(1, Number(group.dataset.cols) || 1);
  const keys = {
    vertical: { ArrowUp: -1, ArrowDown: 1 },
    horizontal: { ArrowLeft: -1, ArrowRight: 1 },
    grid: { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns },
  }[group.dataset.nav];
  const step = keys?.[event.key];
  if (!step) return;
  const items = $$('button:not([disabled]):not([hidden])', group);
  const current = items.indexOf(document.activeElement);
  if (current < 0 || items.length < 2) return;
  if (group.dataset.nav === 'grid') {
    if (event.key === 'ArrowLeft' && current % columns === 0) return;
    if (event.key === 'ArrowRight' && (current + 1) % columns === 0) return;
    if (current + step < 0 || current + step >= items.length) return;
  } else if (group.dataset.nav === 'vertical') {
    event.preventDefault();
    items[(current + step + items.length) % items.length].focus({ preventScroll: true });
    return;
  } else if (current + step < 0 || current + step >= items.length) return;
  event.preventDefault();
  items[current + step]?.focus({ preventScroll: true });
}

function bindEvents() {
  screens.title.addEventListener('click', () => {
    unlockMusic();
    go('menu');
  });
  document.addEventListener('pointerdown', unlockMusic, { once: true });
  document.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-goto], [data-action]');
    if (!control || control.disabled) return;
    if (control.dataset.goto) go(control.dataset.goto);
    else actions[control.dataset.action]?.();
  });
  screens.menu.addEventListener('mouseover', (event) => {
    event.target.closest?.('.menu-item')?.focus({ preventScroll: true });
  });
  screens.menu.addEventListener('focusin', (event) => {
    const item = event.target.closest?.('.menu-item');
    if (item) $('#menu-hint').textContent = item.dataset.hint || '';
  });
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat && event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    if (state.screen === 'title' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      unlockMusic();
      go('menu');
      return;
    }
    if (event.key === 'Escape' || (event.key === 'Backspace' && !typing)) {
      if (typing) {
        event.target.blur();
        return;
      }
      const back = screens[state.screen]?.dataset.back;
      if (back) {
        event.preventDefault();
        go(back);
      }
      return;
    }
    if (!typing) navigate(event);
  });
}

function init() {
  applySettings();
  bindEvents();
  $('#btn-start').focus({ preventScroll: true });
  const params = new URLSearchParams(window.location.search);
  const target = params.get('screen');
  if (target && target !== 'title' && screens[target]) {
    const id = Number(params.get('pokemon'));
    state.playerId = Number.isInteger(id) && id >= 1 && id <= 151 ? id : 25;
    go(target);
  }
}

init();
