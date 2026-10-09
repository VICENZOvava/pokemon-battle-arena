import { getCatalog, refreshCatalog, getPokemon, getSpriteUrl, TYPE_LABELS } from '../api/pokemonService.js';

const $ = (selector, root) => root.querySelector(selector);
const statLabels = [
  ['hp', 'HP'], ['attack', 'ATQ'], ['defense', 'DEF'],
  ['specialAttack', 'ESP'], ['specialDefense', 'R.ESP'], ['speed', 'VEL'],
];
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function typeBadge(type) {
  const badge = document.createElement('span');
  badge.className = 'type-badge type--' + type;
  badge.textContent = TYPE_LABELS[type] || type;
  return badge;
}
function renderPreview(root, pokemon) {
  const preview = $('#selection-preview', root);
  const artwork = document.createElement('span');
  artwork.className = 'preview__art';
  artwork.setAttribute('aria-hidden', 'true');
  const image = document.createElement('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.src = pokemon.sprites?.front || getSpriteUrl(pokemon.id);
  image.addEventListener('error', () => {
    image.hidden = true;
    artwork.classList.add('has-fallback');
    artwork.textContent = '✦';
  }, { once: true });
  artwork.append(image);

  const name = document.createElement('p');
  name.className = 'preview__name';
  name.textContent = pokemon.name + '  #' + String(pokemon.id).padStart(3, '0');
  const badges = document.createElement('div');
  badges.className = 'preview__types';
  pokemon.types.forEach((type) => badges.append(typeBadge(type)));
  const stats = document.createElement('div');
  stats.className = 'stats';
  statLabels.forEach(([key, label]) => {
    const value = Number(pokemon.baseStats?.[key]) || 1;
    const row = document.createElement('div');
    row.className = 'stat';
    const title = document.createElement('span');
    title.textContent = label;
    const bar = document.createElement('span');
    bar.className = 'stat__bar';
    bar.style.setProperty('--v', Math.min(1, value / 255));
    bar.setAttribute('aria-label', label + ': ' + value);
    row.append(title, bar);
    stats.append(row);
  });
  preview.replaceChildren(artwork, name, badges, stats);
}

export async function mountSelection(root, { onSelect, onConfirm }) {
  const grid = $('#selection-grid', root);
  const search = $('#selection-search', root);
  const preview = $('#selection-preview', root);
  const status = $('#selection-status', root);
  const abort = new AbortController();
  const { signal } = abort;
  let catalog = [];
  let selectedId = null;
  let version = 0;

  function placeholder(text) {
    const message = document.createElement('p');
    message.className = 'preview__hint';
    message.textContent = text;
    preview.replaceChildren(message);
  }
  function renderCatalog(items) {
    catalog = items;
    grid.replaceChildren();
    items.forEach((pokemon) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'poke-tile';
      tile.dataset.id = String(pokemon.id);
      tile.dataset.search = normalize(pokemon.name + ' ' + pokemon.englishName + ' ' + pokemon.id);
      tile.setAttribute('aria-pressed', 'false');

      const art = document.createElement('span');
      art.className = 'poke-tile__art';
      art.setAttribute('aria-hidden', 'true');
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = getSpriteUrl(pokemon.id);
      const fallback = document.createElement('span');
      fallback.className = 'poke-tile__fallback';
      fallback.textContent = '✦';
      fallback.hidden = true;
      image.addEventListener('error', () => {
        image.hidden = true;
        fallback.hidden = false;
      }, { once: true });
      art.append(image, fallback);

      const name = document.createElement('span');
      name.className = 'poke-tile__name';
      name.textContent = pokemon.name;
      const number = document.createElement('span');
      number.className = 'poke-tile__number';
      number.textContent = '#' + String(pokemon.id).padStart(3, '0');
      tile.append(art, name, number);
      grid.append(tile);
    });
    const empty = document.createElement('p');
    empty.className = 'selection__empty';
    empty.textContent = 'Nenhum Pokémon encontrado.';
    empty.hidden = true;
    grid.append(empty);
  }
  function applySearch() {
    const query = normalize(search.value.trim());
    let count = 0;
    grid.querySelectorAll('.poke-tile').forEach((tile) => {
      tile.hidden = Boolean(query) && !tile.dataset.search.includes(query);
      if (!tile.hidden) count += 1;
    });
    const empty = $('.selection__empty', grid);
    if (empty) empty.hidden = count > 0;
    status.textContent = query ? count + ' resultado(s).' : catalog.length + ' Pokémon disponíveis.';
  }
  async function select(id) {
    if (selectedId === id) {
      onConfirm(id);
      return;
    }
    selectedId = id;
    const currentVersion = ++version;
    grid.querySelectorAll('.poke-tile').forEach((tile) => {
      tile.setAttribute('aria-pressed', String(Number(tile.dataset.id) === id));
    });
    onSelect(id);
    placeholder('Carregando ' + (catalog.find((item) => item.id === id)?.name || 'Pokémon') + '…');
    try {
      const pokemon = await getPokemon(id);
      if (!signal.aborted && currentVersion === version) renderPreview(root, pokemon);
    } catch (error) {
      if (!signal.aborted && currentVersion === version) placeholder(error.message);
    }
  }

  grid.addEventListener('click', (event) => {
    const tile = event.target.closest?.('.poke-tile');
    if (tile) select(Number(tile.dataset.id));
  }, { signal });
  search.addEventListener('input', applySearch, { signal });

  function reset() {
    selectedId = null;
    version += 1;
    search.value = '';
    grid.querySelectorAll('.poke-tile').forEach((tile) => {
      tile.hidden = false;
      tile.setAttribute('aria-pressed', 'false');
    });
    placeholder('Escolha um Pokémon na lista.');
    applySearch();
  }

  status.textContent = 'Carregando a Pokédex…';
  placeholder('Carregando a Pokédex…');
  const items = await getCatalog();
  if (signal.aborted) return { destroy() { abort.abort(); } };
  renderCatalog(items);
  applySearch();
  refreshCatalog().then((updated) => {
    if (signal.aborted || updated.length <= catalog.length) return;
    const previousSelection = selectedId;
    renderCatalog(updated);
    if (previousSelection !== null) {
      grid.querySelector('.poke-tile[data-id="' + previousSelection + '"]')?.setAttribute('aria-pressed', 'true');
    }
    applySearch();
  });

  return {
    reset,
    destroy() { version += 1; abort.abort(); },
  };
}
