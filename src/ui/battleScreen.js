import { getPokemon, getRandomOpponent, getSpriteUrl, getTypeChart, TYPE_LABELS } from '../api/pokemonService.js';
import { chooseMove } from '../battle/ai.js';
import { advanceRound, createBattle, performAttack } from '../battle/battle.js';
import { calculateEffectiveness } from '../battle/typeChart.js';

const $ = (selector, root) => root.querySelector(selector);
const STRONG_MOVE_POWER = 80;
const wait = (ms, signal) => new Promise((resolve) => {
  if (signal.aborted) return resolve();
  const timer = setTimeout(done, ms);
  function done() { signal.removeEventListener('abort', cancel); resolve(); }
  function cancel() { clearTimeout(timer); resolve(); }
  signal.addEventListener('abort', cancel, { once: true });
});
function setMode(root, mode) {
  $('#battle-dialog', root).dataset.mode = mode;
}
function updateHealth(root, side, pokemon) {
  const bar = $('#' + side + '-hp-bar', root);
  const ratio = Math.max(0, pokemon.hp / pokemon.hpMax);
  bar.style.setProperty('--hp', ratio);
  bar.dataset.state = ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : 'high';
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  $('#' + side + '-hp-current', root).textContent = String(pokemon.hp);
  $('#' + side + '-hp-max', root).textContent = String(pokemon.hpMax);
}
function setSprite(root, side, pokemon) {
  const image = $('#' + side + '-sprite', root);
  const fallback = $('#' + side + '-sprite-fallback', root);
  const view = side === 'player' ? 'back' : 'front';
  image.hidden = false;
  fallback.hidden = true;
  image.alt = pokemon.name;
  image.src = pokemon.sprites?.[view] || getSpriteUrl(pokemon.id, view);
  image.onerror = () => {
    image.hidden = true;
    fallback.textContent = '✦ ' + pokemon.name;
    fallback.hidden = false;
  };
}
function animate(element, className, duration, signal) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  return wait(duration, signal).then(() => element.classList.remove(className));
}
function typeText(type) {
  return TYPE_LABELS[type] || type;
}
function showResult(root, battle) {
  const result = $('#battle-result', root);
  result.dataset.outcome = battle.winner === 'player' ? 'win' : 'lose';
  $('#result-title', root).textContent = battle.winner === 'player' ? 'VITÓRIA!' : 'DERROTA!';
  result.hidden = false;
  $('#btn-rematch', root).focus({ preventScroll: true });
}
function renderMoveInfo(root, move, battle) {
  const info = $('#move-info', root);
  const type = document.createElement('span');
  type.className = 'type-badge type--' + move.type;
  type.textContent = typeText(move.type);
  const power = document.createElement('span');
  power.textContent = 'POT ' + move.power;
  const accuracy = document.createElement('span');
  accuracy.textContent = 'PREC ' + move.accuracy + '%';
  const category = document.createElement('span');
  category.textContent = move.category === 'physical' ? 'F\u00cdSICO' : move.category === 'special' ? 'ESPECIAL' : 'STATUS';
  const effectiveness = calculateEffectiveness(move.type, battle.enemy.types, battle.typeChart);
  const note = document.createElement('span');
  note.className = 'move-info__effect';
  note.textContent = effectiveness > 1 ? 'SUPER EFETIVO' : effectiveness === 0 ? 'SEM EFEITO' : effectiveness < 1 ? 'POUCO EFETIVO' : 'DANO NORMAL';
  const cooldown = document.createElement('span');
  cooldown.className = 'move-info__cooldown';
  cooldown.textContent = move.power >= STRONG_MOVE_POWER ? 'RECARGA: 2 TURNOS' : '';
  info.replaceChildren(type, power, accuracy, category, note, cooldown);
}

export async function mountBattle(root, { playerId, difficulty, onExit, signal: ownerSignal }) {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  if (ownerSignal?.aborted) cancel();
  else ownerSignal?.addEventListener('abort', cancel, { once: true });
  const { signal } = abort;
  const controllerHandle = { destroy() { ownerSignal?.removeEventListener('abort', cancel); abort.abort(); } };
  const quit = $('#btn-quit', root);
  const fight = $('#btn-fight', root);
  let battle;
  let busy = false;
  const cooldowns = new Map();
  const buttonMoves = new Map();
  quit.hidden = false;
  fight.hidden = false;
  quit.addEventListener('click', onExit, { signal });

  try {
    const [playerData, enemyData, chart] = await Promise.all([
      getPokemon(playerId), getRandomOpponent(playerId), getTypeChart(),
    ]);
    if (signal.aborted) return controllerHandle;
    battle = createBattle(playerData, enemyData, chart, { level: 50 });
    $('#player-name', root).textContent = battle.player.name;
    $('#enemy-name', root).textContent = battle.enemy.name;
    $('#player-level', root).textContent = '50';
    $('#enemy-level', root).textContent = '50';
    setSprite(root, 'player', battle.player);
    setSprite(root, 'enemy', battle.enemy);
    updateHealth(root, 'player', battle.player);
    updateHealth(root, 'enemy', battle.enemy);

    [$('#player-sprite', root), $('#enemy-sprite', root)].forEach((sprite) => {
      sprite.classList.add('is-entering');
      sprite.addEventListener('animationend', () => sprite.classList.remove('is-entering'), { once: true, signal });
    });

    const moveButtons = $('#move-buttons', root);
    battle.player.moves.forEach((move) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'move-btn type--' + move.type;
      const name = document.createElement('span');
      name.className = 'move-btn__name';
      name.textContent = move.name;
      const stats = document.createElement('span');
      stats.className = 'move-btn__stats';
      stats.textContent = 'POT ' + move.power + ' - PREC ' + move.accuracy + '%';
      const cooldown = document.createElement('span');
      cooldown.className = 'move-btn__cooldown';
      button.append(name, stats, cooldown);
      button.setAttribute('aria-label', move.name + ', tipo ' + typeText(move.type) + ', poder ' + move.power + ', precisao ' + move.accuracy + '%');
      button.addEventListener('focus', () => renderMoveInfo(root, move, battle), { signal });
      button.addEventListener('mouseenter', () => renderMoveInfo(root, move, battle), { signal });
      button.addEventListener('click', () => takeTurn(move), { signal });
      buttonMoves.set(button, move);
      moveButtons.append(button);
    });

    function refreshMoveButtons() {
      buttonMoves.forEach((move, button) => {
        const turns = cooldowns.get(move) || 0;
        button.disabled = turns > 0;
        button.querySelector('.move-btn__cooldown').textContent = turns
          ? 'RECARGA ' + turns + (turns === 1 ? ' TURNO' : ' TURNOS')
          : '';
      });
    }
    function hasAvailableMove() {
      return [...buttonMoves.keys()].some((button) => !button.disabled);
    }
    refreshMoveButtons();

    function actionMenu() {
      if (battle.over) return showResult(root, battle);
      fight.textContent = hasAvailableMove() ? 'LUTAR' : 'AGUARDAR';
      $('#battle-text', root).textContent = hasAvailableMove()
        ? 'O que ' + battle.player.name + ' vai fazer?'
        : 'Os golpes fortes estao recarregando.';
      setMode(root, 'actions');
    }
    async function executeMove(side, move) {
      if (!move) {
        $('#battle-text', root).textContent = battle.player.name + ' aguardou a recarga.';
        return;
      }
      const attacker = battle[side];
      const targetSide = side === 'player' ? 'enemy' : 'player';
      const attackerSprite = $('#' + side + '-sprite', root);
      const targetSprite = $('#' + targetSide + '-sprite', root);
      $('#battle-text', root).textContent = attacker.name + ' usou ' + move.name + '!';
      await animate(attackerSprite, side === 'player' ? 'is-attacking-player' : 'is-attacking-enemy', 600, signal);
      if (signal.aborted) return;

      const action = performAttack(battle, side, move);
      if (!action) return;
      if (side === 'player' && move.power >= STRONG_MOVE_POWER) cooldowns.set(move, 3);
      if (action.missed) {
        $('#battle-text', root).textContent = attacker.name + ' errou o ataque!';
      } else {
        updateHealth(root, targetSide, action.defender);
        if (action.damage > 0) await animate(targetSprite, 'is-hit', 650, signal);
        let message = action.damage > 0 ? 'Causou ' + action.damage + ' de dano.' : 'O golpe não causou dano.';
        if (action.effectiveness > 1) message += ' Foi super efetivo!';
        else if (action.effectiveness > 0 && action.effectiveness < 1) message += ' Não foi muito efetivo…';
        else if (action.effectiveness === 0) message += ' Não teve efeito!';
        if (action.critical) message += ' Acerto crítico!';
        $('#battle-text', root).textContent = message;
      }
      if (battle.over) {
        await animate(targetSprite, 'is-fainting', 800, signal);
        $('#battle-text', root).textContent = battle[side === 'player' ? 'enemy' : 'player'].name + ' foi derrotado!';
        await wait(650, signal);
      } else {
        await wait(650, signal);
      }
    }
    async function takeTurn(playerMove) {
      if (busy || battle.over || signal.aborted) return;
      if (playerMove && cooldowns.has(playerMove)) return;
      if (!playerMove && hasAvailableMove()) return;
      busy = true;
      setMode(root, 'text');
      moveButtons.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      const enemyMove = chooseMove({
        moves: battle.enemy.moves, attacker: battle.enemy, defender: battle.player,
        difficulty, typeChart: battle.typeChart,
      }) || battle.enemy.moves[0];
      const order = battle.player.speed === battle.enemy.speed
        ? (Math.random() < 0.5 ? ['player', 'enemy'] : ['enemy', 'player'])
        : battle.player.speed > battle.enemy.speed ? ['player', 'enemy'] : ['enemy', 'player'];
      const choices = { player: playerMove, enemy: enemyMove };
      for (const side of order) {
        if (signal.aborted || battle.over) break;
        await executeMove(side, choices[side]);
      }
      if (!signal.aborted) {
        if (battle.over) showResult(root, battle);
        else {
          advanceRound(battle);
          cooldowns.forEach((turns, move) => {
            if (turns <= 1) cooldowns.delete(move);
            else cooldowns.set(move, turns - 1);
          });
          refreshMoveButtons();
          actionMenu();
        }
      }
      busy = false;
    }

    fight.addEventListener('click', () => {
      if (busy || battle.over) return;
      if (!hasAvailableMove()) {
        takeTurn(null);
        return;
      }
      fight.textContent = 'LUTAR';
      setMode(root, 'moves');
      const first = [...buttonMoves.keys()].find((button) => !button.disabled);
      if (first) {
        renderMoveInfo(root, buttonMoves.get(first), battle);
        first.focus({ preventScroll: true });
      }
    }, { signal });

    $('#move-info', root).textContent = 'Escolha um golpe.';
    $('#battle-text', root).textContent = 'Um ' + battle.enemy.name + ' apareceu!';
    await wait(800, signal);
    if (!signal.aborted) actionMenu();
  } catch (error) {
    if (!signal.aborted) {
      $('#battle-text', root).textContent = error.message || 'Falha ao carregar a batalha.';
      setMode(root, 'actions');
      fight.hidden = true;
      quit.focus({ preventScroll: true });
    }
  }
  return controllerHandle;
}
