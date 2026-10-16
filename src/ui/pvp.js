import { getCatalog, getSpriteUrl } from '../api/pokemonService.js';
import { createPvpRoom, getPvpState, joinPvpRoom, setPvpTeam, submitPvpAction } from '../api/pvpClient.js';

const $ = (selector, root) => root.querySelector(selector);
function connectSignal(ownerSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (ownerSignal?.aborted) cancel();
  else ownerSignal?.addEventListener('abort', cancel, { once: true });
  return {
    signal: controller.signal,
    destroy() { ownerSignal?.removeEventListener('abort', cancel); controller.abort(); },
  };
}

export function mountPvpLobby(root, { onRoom, signal: ownerSignal }) {
  const lifetime = connectSignal(ownerSignal);
  const { signal } = lifetime;
  const create = $('#pvp-create-room', root);
  const join = $('#pvp-join-room', root);
  const input = $('#pvp-room-code', root);
  const status = $('#pvp-lobby-status', root);
  let busy = false;
  async function enter(action) {
    if (busy || signal.aborted) return;
    busy = true;
    create.disabled = true;
    join.disabled = true;
    status.textContent = action === 'create' ? 'Criando sala…' : 'Entrando na sala…';
    try {
      const session = action === 'create' ? await createPvpRoom() : await joinPvpRoom(input.value.trim());
      if (!signal.aborted) onRoom(session);
    } catch (error) {
      status.textContent = error.message;
      busy = false;
      create.disabled = false;
      join.disabled = false;
    }
  }
  create.addEventListener('click', () => enter('create'), { signal });
  join.addEventListener('click', () => enter('join'), { signal });
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); }, { signal });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') enter('join'); }, { signal });
  return { destroy: lifetime.destroy };
}

export async function mountPvpTeam(root, { session, onBattle, signal: ownerSignal }) {
  const lifetime = connectSignal(ownerSignal);
  const { signal } = lifetime;
  const grid = $('#pvp-catalog', root);
  const party = $('#pvp-party-list', root);
  const message = $('#pvp-team-message', root);
  const ready = $('#pvp-team-ready', root);
  const code = $('#pvp-team-code', root);
  code.textContent = session.roomCode;
  const selected = [];
  let locked = false;
  let transitioned = false;
  let timer = null;

  function renderParty() {
    party.replaceChildren();
    selected.forEach((pokemonId, index) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      const pokemon = grid.querySelector(`.poke-tile[data-id="${pokemonId}"]`);
      label.textContent = `${index + 1}. ${pokemon?.dataset.name || `Pokémon #${pokemonId}`}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'pvp-party__remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remover ${label.textContent}`);
      remove.disabled = locked;
      remove.addEventListener('click', () => toggle(pokemonId), { signal });
      item.append(label, remove);
      party.append(item);
    });
    ready.disabled = selected.length !== 6 || locked;
    grid.querySelectorAll('.poke-tile').forEach((tile) => { tile.disabled = locked; });
    ready.textContent = locked ? 'EQUIPE PRONTA' : `PRONTO (${selected.length}/6)`;
  }
  function toggle(id) {
    if (locked || signal.aborted) return;
    const existing = selected.indexOf(id);
    if (existing >= 0) selected.splice(existing, 1);
    else if (selected.length < 6) selected.push(id);
    grid.querySelectorAll('.poke-tile').forEach((tile) => tile.setAttribute('aria-pressed', String(selected.includes(Number(tile.dataset.id)))));
    renderParty();
  }
  function renderCatalog(items) {
    grid.replaceChildren();
    items.forEach((pokemon) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'poke-tile';
      tile.dataset.id = String(pokemon.id);
      tile.dataset.name = pokemon.name;
      tile.setAttribute('aria-pressed', 'false');
      const art = document.createElement('span');
      art.className = 'poke-tile__art';
      art.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.src = getSpriteUrl(pokemon.id);
      image.addEventListener('error', () => { image.hidden = true; }, { once: true });
      art.append(image);
      const name = document.createElement('span');
      name.className = 'poke-tile__name';
      name.textContent = pokemon.name;
      const number = document.createElement('span');
      number.className = 'poke-tile__number';
      number.textContent = '#' + String(pokemon.id).padStart(3, '0');
      tile.append(art, name, number);
      tile.addEventListener('click', () => toggle(pokemon.id), { signal });
      grid.append(tile);
    });
  }
  async function poll() {
    if (signal.aborted || transitioned) return;
    try {
      const state = await getPvpState(session, signal);
      if (signal.aborted) return;
      const mine = state.players[session.seat];
      const opponent = state.players[1 - session.seat];
      if (state.phase === 'battle') {
        transitioned = true;
        onBattle();
        return;
      }
      if (state.phase === 'finished') {
        message.textContent = 'A sala foi encerrada. Saia e crie outra para jogar.';
      } else if (mine?.ready) {
        locked = true;
        message.textContent = opponent?.ready ? 'Equipes prontas. Iniciando…' : 'Equipe confirmada. Aguardando o adversário…';
        renderParty();
      } else {
        message.textContent = opponent ? 'Adversário conectado. Escolha 6 Pokémon e confirme sua equipe.' : 'Compartilhe o código da sala para encontrar um adversário.';
      }
    } catch (error) {
      if (!signal.aborted) message.textContent = error.message;
    }
    if (!signal.aborted && !transitioned) timer = setTimeout(poll, 1200);
  }

  ready.addEventListener('click', async () => {
    if (selected.length !== 6 || locked) return;
    locked = true;
    renderParty();
    message.textContent = 'Confirmando equipe…';
    try {
      await setPvpTeam(session, selected);
      if (!signal.aborted) poll();
    } catch (error) {
      locked = false;
      renderParty();
      message.textContent = error.message;
    }
  }, { signal });
  try {
    renderCatalog(await getCatalog());
    renderParty();
    if (!signal.aborted) poll();
  } catch (error) {
    message.textContent = error.message;
  }
  return {
    destroy() { clearTimeout(timer); lifetime.destroy(); },
  };
}

function updateHealth(root, side, pokemon) {
  const ratio = Math.max(0, pokemon.hp / pokemon.hpMax);
  const bar = $('#' + side + '-hp-bar', root);
  bar.style.setProperty('--hp', ratio);
  bar.dataset.state = ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'mid' : 'high';
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
  $('#' + side + '-hp-current', root).textContent = String(pokemon.hp);
  $('#' + side + '-hp-max', root).textContent = String(pokemon.hpMax);
}
function setSprite(root, side, pokemon, loaded) {
  if (loaded[side] === pokemon.id) return;
  loaded[side] = pokemon.id;
  const image = $('#' + side + '-sprite', root);
  const fallback = $('#' + side + '-sprite-fallback', root);
  image.hidden = false;
  fallback.hidden = true;
  image.alt = pokemon.name;
  image.src = getSpriteUrl(pokemon.id, side === 'player' ? 'back' : 'front');
  image.onerror = () => {
    image.hidden = true;
    fallback.textContent = '✦ ' + pokemon.name;
    fallback.hidden = false;
  };
}
function makeChoiceButton(text, detail, onClick, type = 'normal') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'move-btn type--' + type;
  const name = document.createElement('span');
  name.className = 'move-btn__name';
  name.textContent = text;
  const stats = document.createElement('span');
  stats.className = 'move-btn__stats';
  stats.textContent = detail;
  button.append(name, stats);
  button.addEventListener('click', onClick);
  return button;
}
export function mountPvpBattle(root, { session, onExit, signal: ownerSignal }) {
  const lifetime = connectSignal(ownerSignal);
  const { signal } = lifetime;
  const fight = $('#btn-fight', root);
  const switchButton = $('#btn-switch', root);
  const quit = $('#btn-quit', root);
  const choices = $('#move-buttons', root);
  const loadedSprites = { player: null, enemy: null };
  let timer = null;
  let lastControl = '';
  let lastEvent = 0;
  let sending = false;
  let ended = false;
  let currentSnapshot = null;

  quit.textContent = 'SAIR';
  $('#btn-rematch', root).hidden = true;
  $('#btn-result-menu', root).dataset.action = 'pvp-exit';
  quit.addEventListener('click', onExit, { signal });
  fight.addEventListener('click', () => {
    if (ended || sending) return;
    const current = currentSnapshot;
    const active = current?.players[session.seat]?.team?.[current.players[session.seat].activeIndex];
    if (!active) return;
    choices.replaceChildren();
    active.moves.forEach((move, index) => {
      choices.append(makeChoiceButton(move.name, `POT ${move.power} · PREC ${move.accuracy}%`, () => send({ type: 'move', index }), move.type));
    });
    $('#battle-dialog', root).dataset.mode = 'moves';
  }, { signal });
  switchButton.addEventListener('click', () => {
    if (ended || sending) return;
    const current = currentSnapshot;
    const mine = current?.players[session.seat];
    if (!mine?.team) return;
    choices.replaceChildren();
    mine.team.forEach((pokemon, index) => {
      if (index === mine.activeIndex || pokemon.hp <= 0) return;
      choices.append(makeChoiceButton(pokemon.name, `HP ${pokemon.hp}/${pokemon.hpMax} · TROCAR`, () => send({ type: 'switch', index }), pokemon.types[0] || 'normal'));
    });
    $('#battle-dialog', root).dataset.mode = 'moves';
  }, { signal });
  async function send(action) {
    if (sending || signal.aborted) return;
    sending = true;
    $('#battle-dialog', root).dataset.mode = 'text';
    $('#battle-text', root).textContent = 'Ação enviada. Aguardando o adversário…';
    try {
      await submitPvpAction(session, action);
      if (!signal.aborted) await poll();
    } catch (error) {
      if (!signal.aborted) {
        $('#battle-text', root).textContent = error.message;
        lastControl = '';
      }
    } finally {
      sending = false;
    }
  }
  function showResult(state) {
    if (ended) return;
    ended = true;
    const won = state.winnerSeat === session.seat;
    const result = $('#battle-result', root);
    result.dataset.outcome = won ? 'win' : 'lose';
    result.hidden = false;
    $('#result-title', root).textContent = won ? 'VITÓRIA!' : 'DERROTA!';
    $('#result-message', root).textContent = won ? 'Você venceu o duelo 6 contra 6!' : 'O adversário venceu o duelo.';
    $('#btn-rematch', root).hidden = true;
    $('#btn-tower-next', root).hidden = true;
    $('#btn-tower-reset', root).hidden = true;
    $('#btn-tower-exit', root).hidden = true;
    $('#btn-result-menu', root).hidden = false;
    $('#btn-result-menu', root).focus({ preventScroll: true });
  }
  async function poll() {
    if (signal.aborted || ended) return;
    try {
      const state = await getPvpState(session, signal);
      if (signal.aborted) return;
      currentSnapshot = state;
      const mine = state.players[session.seat];
      const enemy = state.players[1 - session.seat];
      if (!mine?.team || !enemy?.team) throw new Error('A equipe do adversário não está disponível.');
      const player = mine.team[mine.activeIndex];
      const opponent = enemy.team[enemy.activeIndex];
      setSprite(root, 'player', player, loadedSprites);
      setSprite(root, 'enemy', opponent, loadedSprites);
      $('#player-name', root).textContent = `${player.name} ${mine.team.filter((member) => member.hp > 0).length}/6`;
      $('#enemy-name', root).textContent = `${opponent.name} ${enemy.team.filter((member) => member.hp > 0).length}/6`;
      $('#player-level', root).textContent = String(player.level || 50);
      $('#enemy-level', root).textContent = String(opponent.level || 50);
      updateHealth(root, 'player', player);
      updateHealth(root, 'enemy', opponent);
      for (const event of state.events) {
        if (event.id > lastEvent) {
          $('#battle-text', root).textContent = event.message;
          lastEvent = event.id;
        }
      }
      if (state.phase === 'finished') {
        showResult(state);
        return;
      }
      const hasReserves = mine.team.some((pokemon, index) => index !== mine.activeIndex && pokemon.hp > 0);
      const key = `${state.phase}:${state.turn}:${mine.hasSubmitted}:${mine.mustSwitch}:${mine.activeIndex}`;
      if (key !== lastControl) {
        lastControl = key;
        if (state.phase === 'switch' && mine.mustSwitch && !mine.hasSubmitted) {
          fight.hidden = true;
          switchButton.hidden = false;
          switchButton.textContent = 'ESCOLHER SUBSTITUTO';
          $('#battle-text', root).textContent = 'Seu Pokémon foi derrotado. Escolha quem entra.';
          $('#battle-dialog', root).dataset.mode = 'actions';
        } else if (mine.hasSubmitted || state.phase === 'switch') {
          fight.hidden = true;
          switchButton.hidden = true;
          $('#battle-text', root).textContent = 'Ação enviada. Aguardando o adversário…';
          $('#battle-dialog', root).dataset.mode = 'text';
        } else {
          fight.hidden = false;
          fight.textContent = 'ATACAR';
          switchButton.hidden = !hasReserves;
          switchButton.textContent = 'TROCAR';
          $('#battle-text', root).textContent = `TURNO ${state.turn} — escolha sua ação.`;
          $('#battle-dialog', root).dataset.mode = 'actions';
        }
      }
      quit.hidden = false;
    } catch (error) {
      if (!signal.aborted) $('#battle-text', root).textContent = error.message;
    }
    if (!signal.aborted && !ended) timer = setTimeout(poll, 900);
  }
  poll();
  return {
    destroy() { clearTimeout(timer); lifetime.destroy(); },
  };
}