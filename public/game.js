"use strict";
const TILE = 48;
let W = 15, H = 13;
const $ = (id) => document.getElementById(id);

const DEFAULT_COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#fd79a8"];
const MIN_SKINS = 8;

// cores padrão de cada mapa: chão (2 tons xadrez), parede (base, luz, sombra), bloco (base, contorno)
const MAP_STYLE = {
  classic: { floor: ["#3c7a3c", "#448544"], wall: ["#4a4f5c", "#6b7184", "#2f333d"], block: ["#b5733a", "#7a4a22"] },
  arena: { floor: ["#d9b45f", "#cfa94f"], wall: ["#8a6a3a", "#b08d55", "#5c4424"], block: ["#c8553d", "#7d2f1f"] },
  cross: { floor: ["#aee0ee", "#9fd5e6"], wall: ["#5d7f9a", "#8fb2cc", "#3c566b"], block: ["#e8f6fb", "#7fb2c8"] },
  factory: { floor: ["#5a5f68", "#51565f"], wall: ["#2d3138", "#4a505b", "#1a1d22"], block: ["#d1a032", "#7b5d13"] },
  diamond: { floor: ["#3b2f5c", "#43366a"], wall: ["#7b5cc4", "#a98cf0", "#4a3487"], block: ["#e86aa8", "#8a2f63"] },
  volcano: { floor: ["#4a2a24", "#52302a"], wall: ["#22181a", "#3d2c2f", "#0e0a0b"], block: ["#ff7a2e", "#a63d0a"] },
  big: { floor: ["#4c9a3f", "#55a548"], wall: ["#5b6270", "#7e879a", "#3a3f4a"], block: ["#c28a47", "#85552a"] },
  portals: { floor: ["#2b3a67", "#324273"], wall: ["#6c5ce7", "#a29bfe", "#3b2f8f"], block: ["#74b9ff", "#2d6cb3"] },
  belt: { floor: ["#6b6f78", "#62666f"], wall: ["#3a3d44", "#565a63", "#22242a"], block: ["#e5a634", "#8a5f12"] },
  maze: { floor: ["#3f7a3a", "#488544"], wall: ["#1f4d22", "#2f7a33", "#12311a"], block: ["#a86b3a", "#6a3f1d"] },
  towers: { floor: ["#8a8f99", "#80858f"], wall: ["#4b5568", "#7c8aa6", "#2c3345"], block: ["#d9c27a", "#8a7433"] },
  fortress: { floor: ["#6d4d3a", "#745340"], wall: ["#3a2a22", "#5c4538", "#1f1612"], block: ["#c4553a", "#7a2a1a"] },
};

// powerups: cor, ícone, nome, descrição
const ITEMS = {
  bomb_up: ["#8e44ad", "💣", "Bomba extra", "+1 bomba ao mesmo tempo"],
  fire_up: ["#e67e22", "🔥", "Fogo", "+1 de alcance da explosão"],
  speed_up: ["#16a085", "👟", "Velocidade", "Anda mais rápido"],
  full_fire: ["#c0392b", "💥", "Fogo total", "Alcance máximo"],
  remote: ["#2980b9", "📡", "Controle remoto", "Suas bombas só explodem quando você aperta E ou Shift"],
  bomb_pass: ["#7f8c8d", "👻", "Passa-bomba", "Atravessa bombas"],
  wall_pass: ["#a0522d", "🧱", "Passa-bloco", "Atravessa blocos destrutíveis"],
  kick: ["#d35400", "🥾", "Chute", "Ande contra uma bomba para chutá-la"],
  glove: ["#27ae60", "🧤", "Luva", "Espaço sobre a bomba a arremessa 3 casas à frente"],
  punch: ["#c0392b", "👊", "Soco", "Ande contra uma bomba para socá-la por cima dos obstáculos"],
  shield: ["#2c82c9", "🛡️", "Colete", "Absorve uma explosão e quebra (não some com o tempo). A morte súbita ignora o colete"],
  heart: ["#e84393", "❤️", "Vida extra", "Sobrevive a mais uma explosão"],
  skull: ["#2d3436", "💀", "Caveira", "Maldição aleatória por 10 s (lento, rápido, sem bombas, bombas automáticas, controles invertidos…). Encoste em outro jogador para passá-la!"],
  line_bomb: ["#f39c12", "➡️", "Bombas em linha", "Solta todas as bombas de uma vez em linha"],
  power_bomb: ["#6c5ce7", "☢️", "Super bomba", "A próxima bomba tem alcance máximo"],
};
const ITEM_ALIAS = { bomb: "bomb_up", range: "fire_up", speed: "speed_up" }; // nomes antigos do theme.json
const CURSE_INFO = {
  slow: ["Lento", "você anda bem devagar"],
  fast: ["Acelerado", "você está descontrolado de rápido"],
  diarrhea: ["Bombas automáticas", "você solta bombas sozinho"],
  constipation: ["Sem bombas", "você não consegue soltar bombas"],
  reverse: ["Controles invertidos", "as direções estão trocadas"],
  short: ["Alcance mínimo", "suas bombas só têm 1 de alcance"],
};
const CURSE_NAMES = {
  slow: "Lento", fast: "Acelerado", diarrhea: "Bombas automáticas", constipation: "Sem bombas",
  reverse: "Controles invertidos", short: "Alcance mínimo",
};

const canvas = $("game");
const ctx = canvas.getContext("2d");
function sizeCanvas() { canvas.width = W * TILE; canvas.height = H * TILE; ctx.imageSmoothingEnabled = !A.pixelArt; }

// ---------- assets / tema (veja public/assets/LEIAME.md) ----------
const A = { pixelArt: false, tilesets: { default: { floor: [], wall: null, block: null } }, items: {}, bomb: null, flame: null };
let SKINS = []; // {color, sheet?}

function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { console.warn("asset não encontrado:", src); res(null); };
    img.src = "assets/" + src;
  });
}

async function loadTileset(t = {}) {
  return {
    floor: (await Promise.all([].concat(t.floor || []).map(loadImg))).filter(Boolean),
    wall: await loadImg(t.wall),
    block: await loadImg(t.block),
  };
}

async function loadSkin(s, i) {
  if (typeof s === "string") s = { image: s };
  const img = await loadImg(s.image);
  if (!img) return null;
  return {
    color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], name: s.name,
    sheet: {
      img, fw: s.frameWidth || img.width, fh: s.frameHeight || img.height,
      rows: s.rows || { d: 0, u: 1, l: 2, r: 3 }, frames: s.frames || 1, fps: s.fps || 8,
      scale: s.scale || 1, offsetY: s.offsetY || 0, shape: s.shape, pixelArt: s.pixelArt,
    },
  };
}

async function loadTheme() {
  let t = {};
  try { t = await (await fetch("assets/theme.json", { cache: "no-store" })).json(); } catch { /* sem tema */ }
  A.pixelArt = !!t.pixelArt;
  if (t.background) $("screen-title").style.setProperty("--title-bg", `url("assets/${t.background}")`);
  A.tilesets.default = await loadTileset(t.tiles);
  for (const [id, m] of Object.entries(t.maps || {})) A.tilesets[id] = await loadTileset(m.tiles);
  const items = t.items || {};
  for (const k of Object.keys(ITEMS)) {
    const alias = Object.keys(ITEM_ALIAS).find((a) => ITEM_ALIAS[a] === k);
    A.items[k] = await loadImg(items[k] || (alias && items[alias]));
  }
  A.bomb = await loadImg(t.bomb);
  A.flame = await loadImg(t.flame);
  const defs = t.skins || t.players || [];
  SKINS = (await Promise.all(defs.map(loadSkin))).filter(Boolean);
  for (let i = SKINS.length; i < MIN_SKINS; i++) SKINS.push({ color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] });
}

// ---------- estado ----------
let ws, S = null, myId = null;
let maps = [], rooms = [], history = [];
let screen = "title", lastMode = "multi", reconnecting = false;
let mySkin = 0;
let skinRoomMode = false, skinChecked = false; // escolhendo skin de dentro de uma sala
const vis = {}; // posição suavizada dos jogadores

function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.add("hidden"), 3500);
}

function show(name) {
  screen = name;
  for (const s of document.querySelectorAll(".screen")) s.classList.toggle("hidden", s.id !== "screen-" + name);
  if (name === "title") drawSkinMini();
  if (name === "multi") renderRooms();
}

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

// ---------- rede ----------
// Endereço do servidor: ?server=... na URL > config.js > o mesmo endereço do site.
function serverUrl(loc = location, cfg = window.CTI_CONFIG || {}) {
  const secure = loc.protocol === "https:";
  const same = `${secure ? "wss" : "ws"}://${loc.host}/ws`;
  let raw = (new URLSearchParams(loc.search).get("server") || cfg.server || "").trim();
  if (!raw) return same;
  const hasScheme = /^[a-z]+:\/\//i.test(raw);
  raw = (hasScheme ? raw : "ws://" + raw).replace(/^http/i, "ws");
  try {
    const u = new URL(raw);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname); // localhost é exceção do navegador
    // site https só aceita conexão segura (wss://), exceto para localhost
    if (secure && !local && (u.protocol === "ws:")) u.protocol = "wss:";
    if (u.pathname === "/" || u.pathname === "") u.pathname = "/ws";
    return u.toString();
  } catch {
    return same;
  }
}

let retries = 0;
function setNet(state) {
  const host = new URL(serverUrl().replace(/^ws/, "http")).host;
  const el_ = $("netStatus");
  el_.textContent = state === "on" ? `● online · ${host}` : `○ ${state === "try" ? "conectando" : "sem conexão"} · ${host}`;
  el_.className = state;
  const c = $("conn");
  c.classList.toggle("hidden", state === "on");
  if (state !== "on") {
    c.replaceChildren(el("div", {}, retries > 1 ? "Sem conexão com o servidor" : "Conectando…"),
      el("small", { textContent: retries > 2 ? `Não consegui falar com ${host}. Tentando de novo (tentativa ${retries})… Servidores gratuitos podem levar um minuto para acordar.` : host }));
  }
}

function connect() {
  setNet("try");
  ws = new WebSocket(serverUrl());
  ws.onopen = () => { retries = 0; setNet("on"); if (reconnecting) show("title"); reconnecting = false; };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    switch (m.t) {
      case "hello": maps = m.maps; buildForms(); break;
      case "rooms": rooms = m.rooms; if (screen === "multi") renderRooms(); break;
      case "history": history = m.rows; renderHistory(); break;
      case "you": myId = m.id; skinChecked = false; prevCurse = null; break;
      case "state":
        S = m;
        if (skinRoomMode && S.phase !== "lobby") { skinRoomMode = false; show("game"); } // a partida começou
        if (screen !== "game" && !skinRoomMode) { show("game"); roomFormBuilt = false; }
        updateUI();
        if (skinRoomMode) buildSkinGrid(); // só refaz se alguma skin ocupada mudou
        break;
      case "left": S = null; myId = null; skinRoomMode = false; show(lastMode === "single" ? "title" : "multi"); break;
      case "error": toast(m.msg); break;
    }
  };
  ws.onclose = () => {
    S = null; myId = null; reconnecting = true;
    retries++;
    setNet("off");
    setTimeout(connect, Math.min(5000, 800 * retries)); // espera cada vez mais, até 5 s
  };
}

// ---------- entrada ----------
const held = [];
const KEYS = {
  ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d",
  ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r",
};
let lastDir = "";

function sendDir() {
  const d = held[held.length - 1] || "";
  if (d === lastDir) return;
  lastDir = d;
  send({ t: "in", dx: d === "r" ? 1 : d === "l" ? -1 : 0, dy: d === "d" ? 1 : d === "u" ? -1 : 0 });
}

addEventListener("keydown", (e) => {
  if (screen !== "game" || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  if (e.code === "Space") {
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur();
    if (!e.repeat) send({ t: "bomb" });
    return;
  }
  if (e.code === "KeyE" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    e.preventDefault();
    if (!e.repeat) send({ t: "det" });
    return;
  }
  const d = KEYS[e.code];
  if (!d) return;
  e.preventDefault();
  if (!held.includes(d)) { held.push(d); sendDir(); }
});
addEventListener("keyup", (e) => {
  if (screen === "game" && e.code === "Space") e.preventDefault();
  const d = KEYS[e.code];
  if (!d) return;
  const i = held.indexOf(d);
  if (i >= 0) { held.splice(i, 1); sendDir(); }
});
addEventListener("blur", () => { held.length = 0; sendDir(); });

// ---------- skins ----------
function drawCharacter(g, sk, face, cx, cy, size, moving, now) {
  const r = size * 0.4;
  g.fillStyle = "rgba(0,0,0,.3)";
  g.beginPath(); g.ellipse(cx, cy + r * 0.8, r * 0.9, r * 0.4, 0, 0, 7); g.fill();
  if (sk.sheet) {
    const s = sk.sheet;
    g.imageSmoothingEnabled = s.pixelArt === undefined ? !A.pixelArt : !s.pixelArt; // cada skin pode ter o seu modo
    g.imageSmoothingQuality = "high";
    if (s.shape === "circle") { // foto recortada em círculo, como uma ficha
      const rr = size * 0.46 * s.scale, side = Math.min(s.img.width, s.img.height);
      g.save();
      g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.clip();
      g.drawImage(s.img, (s.img.width - side) / 2, (s.img.height - side) * 0.3, side, side, cx - rr, cy - rr, rr * 2, rr * 2);
      g.restore();
      g.lineWidth = 3 * size / TILE; g.strokeStyle = sk.color;
      g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke();
      return;
    }
    const col = moving ? Math.floor((now / 1000) * s.fps) % s.frames : 0;
    const row = Math.min(s.rows[face] ?? 0, Math.max(0, Math.floor(s.img.height / s.fh) - 1));
    const dh = size * s.scale, dw = dh * s.fw / s.fh;
    g.drawImage(s.img, col * s.fw, row * s.fh, s.fw, s.fh, cx - dw / 2, cy + size / 2 - dh + s.offsetY * size / TILE, dw, dh);
    return;
  }
  const u = size / TILE;
  g.fillStyle = "#f4f1ea";
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  g.fillStyle = sk.color; // capacete
  g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
  g.lineWidth = 3 * u; g.strokeStyle = "#0008";
  g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  g.strokeStyle = "#222"; g.lineWidth = 2 * u; // antena
  g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + 2 * u, cy - r - 7 * u); g.stroke();
  g.fillStyle = sk.color; g.beginPath(); g.arc(cx + 2 * u, cy - r - 8 * u, 3.5 * u, 0, 7); g.fill();
  const fx = (face === "r" ? 4 : face === "l" ? -4 : 0) * u, fy = (face === "u" ? -3 : face === "d" ? 3 : 0) * u;
  g.fillStyle = "#fff";
  for (const ex of [-7, 7]) { g.beginPath(); g.ellipse(cx + ex * u + fx, cy + 2 * u + fy, 4.6 * u, 5.6 * u, 0, 0, 7); g.fill(); }
  g.fillStyle = "#111";
  for (const ex of [-7, 7]) { g.beginPath(); g.arc(cx + ex * u + fx * 1.4, cy + 2.5 * u + fy * 1.4, 2.4 * u, 0, 7); g.fill(); }
}

function drawSkinMini() {
  const g = $("skinMini").getContext("2d");
  g.clearRect(0, 0, 28, 28);
  if (SKINS[mySkin]) drawCharacter(g, SKINS[mySkin], "d", 14, 17, 26, false, 0);
}

const skinName = (i) => (SKINS[i] && SKINS[i].name) || `Skin ${i + 1}`;

let skinGridKey = "";
function buildSkinGrid() {
  const grid = $("skinGrid");
  // dentro de uma sala, skins de outros jogadores ficam indisponíveis
  const takenBy = {};
  const me = skinRoomMode && S ? S.players.find((p) => p.id === myId) : null;
  if (skinRoomMode && S) for (const p of S.players) if (p.id !== myId && p.connected) takenBy[p.skin] = p.name;
  const current = me ? me.skin : mySkin; // na sala vale a skin que o servidor realmente deu
  // o servidor manda o estado 30x por segundo: refazer os cartões a cada um faria o clique se perder
  const key = JSON.stringify([takenBy, current, SKINS.length, skinRoomMode]);
  if (key === skinGridKey && grid.children.length) return;
  skinGridKey = key;
  grid.replaceChildren(...SKINS.map((sk, i) => {
    const c = el("canvas", { width: 80, height: 80 });
    drawCharacter(c.getContext("2d"), sk, "d", 40, 46, 72, false, 0);
    const taken = takenBy[i];
    const card = el("div", { className: "skin" + (i === current ? " sel" : "") + (taken ? " taken" : ""), title: taken ? `Em uso por ${taken}` : "" },
      c, taken ? `${skinName(i)} (${taken})` : skinName(i));
    if (taken) return card;
    card.onclick = () => {
      mySkin = i;
      try { localStorage.setItem("ctib-skin", i); } catch { /* ignore */ }
      if (skinRoomMode) { send({ t: "skin", skin: i }); skinRoomMode = false; show("game"); }
      else buildSkinGrid();
    };
    return card;
  }));
}

// ---------- formulários ----------
const ROUND_OPTS = [1, 2, 3, 5, 7, 10, 15, 20];
const TIME_OPTS = [30, 60, 90, 120, 180, 240, 300, 600];
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function field(label, input) { return el("label", {}, label, input); }
function select(opts, value, onchange) {
  const s = el("select", {}, ...opts.map(([v, t]) => el("option", { value: v, textContent: t })));
  s.value = String(value);
  if (onchange) s.onchange = onchange;
  return s;
}
const mapOptions = () => [["rotate", "Alternar a cada rodada"], ...maps.map((m) => [m.id, m.name])];
const roundOptions = () => ROUND_OPTS.map((n) => [n, `${n} ${n === 1 ? "rodada" : "rodadas"}`]);
const timeOptions = () => TIME_OPTS.map((n) => [n, fmtTime(n)]);

const forms = {};
function buildForms() {
  forms.single = { map: select(mapOptions(), "rotate"), bots: select([1, 2, 3, 4, 5].map((n) => [n, `${n} ${n === 1 ? "bot" : "bots"}`]), 3), rounds: select(roundOptions(), 3), time: select(timeOptions(), 120) };
  $("singleForm").replaceChildren(field("Mapa", forms.single.map), field("Adversários", forms.single.bots),
    field("Rodadas", forms.single.rounds), field("Tempo de cada rodada", forms.single.time));
  forms.create = { room: el("input", { maxLength: 24, placeholder: "Nome da sala" }), map: select(mapOptions(), "rotate"), rounds: select(roundOptions(), 3), time: select(timeOptions(), 120) };
  $("createForm").replaceChildren(field("Nome da sala", forms.create.room), field("Mapa", forms.create.map),
    field("Rodadas", forms.create.rounds), field("Tempo de cada rodada", forms.create.time));
  roomFormBuilt = false;
}

function playerInfo() {
  const name = $("playerName").value.trim();
  if (!name) {
    toast("Digite seu nome primeiro!");
    show("title");
    $("playerName").focus();
    return null;
  }
  try { localStorage.setItem("ctib-name", name); } catch { /* ignore */ }
  return { name, skin: mySkin, nskins: SKINS.length };
}

// ---------- telas: título / ranking / salas ----------
function renderHistory() {
  const tb = $("historyTable").tBodies[0];
  if (!history.length) {
    tb.replaceChildren(el("tr", {}, el("td", { colSpan: 6, className: "note", textContent: "Ninguém pontuou ainda. Jogue uma partida multiplayer com 3 ou mais jogadores!" })));
    return;
  }
  const mine = $("playerName").value.trim().toLowerCase();
  tb.replaceChildren(...history.map((r, i) => el("tr", { className: r.name.toLowerCase() === mine ? "me" : "" },
    el("td", { className: "medal", textContent: ["🥇", "🥈", "🥉"][i] || i + 1 }), el("td", { textContent: r.name }),
    el("td", { className: "num", textContent: r.points }), el("td", { className: "num", textContent: r.match_wins }),
    el("td", { className: "num", textContent: r.round_wins }), el("td", { className: "num", textContent: r.matches }))));
}

function renderRooms() {
  const tb = $("roomTable").tBodies[0];
  $("noRooms").classList.toggle("hidden", rooms.length > 0);
  $("roomTable").classList.toggle("hidden", rooms.length === 0);
  tb.replaceChildren(...rooms.map((r) => {
    const mapName = r.map === "rotate" ? "Alternando" : (maps.find((m) => m.id === r.map) || {}).name || r.map;
    const inGame = r.phase !== "lobby";
    const full = r.players >= r.max;
    const btn = el("button", { textContent: full ? "Cheia" : inGame ? "Entrar (próx. rodada)" : "Entrar", disabled: full, className: full ? "ghost" : "" });
    btn.onclick = () => { const p = playerInfo(); if (p) { lastMode = "multi"; send({ t: "join", room: r.id, ...p }); } };
    return el("tr", {}, el("td", { textContent: r.name }), el("td", { textContent: r.host }),
      el("td", { textContent: `${r.players}/${r.max}` }), el("td", { textContent: mapName }),
      el("td", {}, el("span", { className: "pill " + (inGame ? "live" : "wait"), textContent: inGame ? `Em jogo · rodada ${r.round}/${r.rounds}` : `Aguardando · ${r.rounds} rodadas` })),
      el("td", {}, btn));
  }));
}

// ---------- sala / partida ----------
let roomFormBuilt = false;
const rf = {};

function buildRoomForm() {
  roomFormBuilt = true;
  const change = () => send({ t: "settings", map: rf.map.value, rounds: rf.rounds.value, time: rf.time.value });
  rf.map = select(mapOptions(), "rotate", change);
  rf.rounds = select(roundOptions(), 3, change);
  rf.time = select(timeOptions(), 120, change);
  $("roomSettings").replaceChildren(field("Mapa", rf.map), field("Rodadas", rf.rounds), field("Tempo da rodada", rf.time));
}

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const skinColor = (p) => (SKINS[p.skin % SKINS.length] || {}).color || "#888";
const dot = (p) => el("span", { className: "dot", style: `background:${skinColor(p)}` });

// retrato pequeno da skin do jogador (listas e tabelas)
function avatar(skinIdx, size = 28) {
  const c = el("canvas", { width: size, height: size, className: "avatar" });
  const sk = SKINS[skinIdx % SKINS.length];
  if (sk) drawCharacter(c.getContext("2d"), sk, "d", size / 2, size * 0.58, size * 0.92, false, 0);
  return c;
}

function updateUI() {
  if (S.w !== W || S.h !== H) { W = S.w; H = S.h; sizeCanvas(); }
  const me = S.players.find((p) => p.id === myId);
  if (!me) myId = null;
  const isHost = !!me && S.host === myId;
  const lobby = S.phase === "lobby";
  if (me && !skinChecked) {
    skinChecked = true;
    if (me.skin !== mySkin) toast(`A skin ${skinName(mySkin)} já estava em uso — você ficou com ${skinName(me.skin)}. Dá para trocar na sala.`);
  }
  $("skinBtn").classList.toggle("hidden", !me || !lobby);

  // formulário de configurações (só o gerente edita)
  if (!roomFormBuilt) buildRoomForm();
  for (const [k, v] of [["map", S.settings.map], ["rounds", S.settings.rounds], ["time", S.settings.time]]) {
    rf[k].disabled = !isHost;
    if (document.activeElement !== rf[k]) rf[k].value = String(v);
  }

  // sobreposição
  $("overlay").classList.toggle("hidden", S.phase === "playing");
  $("lobbyBox").classList.toggle("hidden", !lobby);
  $("finalTable").classList.toggle("hidden", S.phase !== "final");
  $("readyBtn").classList.toggle("hidden", !me);
  $("readyBtn").textContent = me && me.ready ? "Cancelar" : "Pronto!";
  $("roomTitle").textContent = S.room;

  let msg = "";
  if (S.phase === "countdown") msg = String(S.countdown);
  else if (S.phase === "over") {
    const w = S.players.find((p) => p.id === S.winner);
    msg = w ? `${w.name} venceu a rodada!` : S.winner ? "Rodada encerrada" : "Empate!";
  } else if (S.phase === "final") msg = "Fim da partida!";
  $("msg").textContent = msg;
  $("msg").className = S.phase === "countdown" ? "count" : "";

  const canKick = (p) => isHost && p.id !== myId && !p.bot && p.connected;
  const kickBtn = (p) => {
    const b = el("button", { className: "kick", textContent: "Expulsar", title: `Expulsar ${p.name} da sala` });
    b.onclick = () => { if (confirm(`Expulsar ${p.name} da sala?`)) send({ t: "kick", id: p.id }); };
    return b;
  };

  renderOnce($("lobbyList"), [S.players.map((p) => [p.id, p.name, p.ready, p.skin, p.connected]), S.host, isHost], () =>
    S.players.map((p) => el("li", {}, avatar(p.skin, 34), p.name + (p.id === myId ? " (você)" : "") + (p.id === S.host ? " 👑" : "") + (p.bot ? " 🤖" : ""),
      el("span", { className: "st pill " + (p.ready ? "ok" : "idle"), textContent: p.ready ? "pronto ✔" : "aguardando" }), canKick(p) ? kickBtn(p) : "")));

  renderOnce($("finalTable"), S.final, () => {
    const rows = S.final.map((f, i) => el("tr", {}, el("td", { className: "medal", textContent: f.winner ? "🏆" : i + 1 }),
      el("td", {}, avatar(f.skin, 30), f.name), el("td", { className: "num", textContent: f.wins }),
      el("td", { className: "num", textContent: f.bot ? "—" : f.points })));
    return [el("thead", {}, el("tr", {}, el("th"), el("th", { textContent: "Jogador" }), el("th", { className: "num", textContent: "Rodadas" }), el("th", { className: "num", textContent: "Pontos" }))), el("tbody", {}, ...rows)];
  });

  // aviso sobre o campo
  let banner = "";
  if (me && S.phase !== "lobby" && S.phase !== "final") {
    if (me.waiting) banner = "Você entra na próxima rodada";
    else if (!me.alive && S.phase === "playing") banner = "Você foi eliminado — assistindo";
  }
  $("banner").textContent = banner;
  $("banner").classList.toggle("hidden", !banner);

  trackCurses(me);
  if (S.phase !== "playing") $("curseMsg").classList.add("hidden");

  // HUD
  renderOnce($("roundInfo"), [lobby, S.room, S.rounds, S.round, S.sudden, S.time_left], () => {
    if (lobby) return [el("span", { textContent: S.room }), el("span", { textContent: `${S.rounds} rodadas` })];
    return [el("span", { textContent: `Rodada ${S.round}/${S.rounds}` }),
      S.sudden ? el("span", { className: "sd", textContent: "MORTE SÚBITA!" })
        : el("span", { className: "clock" + (S.time_left <= 10 ? " low" : ""), textContent: `⏱ ${fmtClock(S.time_left)}` })];
  });

  // mais pontos primeiro (empate: mais vitórias, depois ordem de entrada)
  const ranked = [...S.players].sort((a, b) => b.points - a.points || b.wins - a.wins || a.id - b.id);
  renderOnce($("scoreTable"), [ranked.map((p) => [p.id, p.name, p.wins, p.points, p.alive, p.waiting, p.lives, p.shield, p.curse, p.connected]), isHost], () => {
    const rows = ranked.map((p) => {
      const tags = (p.waiting ? "⏳" : "") + (p.lives ? "❤️".repeat(p.lives) : "") + (p.shield ? "🛡️" : "") + (p.curse ? "💀" : "") + (p.connected ? "" : " ✖");
      const tr = el("tr", { className: (p.alive || lobby ? "" : "dead") + (p.id === myId ? " me" : "") },
        el("td", { title: p.name }, avatar(p.skin, 26), p.name), el("td", { className: "num", textContent: p.wins }),
        el("td", { className: "num", textContent: p.points }), el("td", { textContent: tags }, canKick(p) ? kickBtn(p) : ""));
      return tr;
    });
    return [el("thead", {}, el("tr", {}, el("th", { textContent: "Jogador" }), el("th", { className: "num", textContent: "Vit." }), el("th", { className: "num", textContent: "Pts" }), el("th"))), el("tbody", {}, ...rows)];
  });

  renderOnce($("myPowers"), me && [me.bombs, me.range, me.speed, me.abil, me.curse, me.curse_t, me.lives], () => {
    if (!me) return [];
    const out = [el("span", { textContent: `💣 ${me.bombs}`, title: "Bombas" }), el("span", { textContent: `🔥 ${me.range}`, title: "Alcance" }), el("span", { textContent: `👟 ${me.speed}`, title: "Velocidade" })];
    const count = {};
    for (const a of me.abil) count[a] = (count[a] || 0) + 1;
    for (const [a, n] of Object.entries(count)) out.push(el("span", { textContent: ITEMS[a][1] + (n > 1 ? `×${n}` : ""), title: ITEMS[a][2] }));
    if (me.curse) out.push(el("span", { className: "curse", textContent: `💀 ${CURSE_NAMES[me.curse]} · ${me.curse_t}s`, title: CURSE_INFO[me.curse][1] }));
    return out;
  });
}

// ---------- avisos da caveira ----------
let prevCurse = null;
function showCurseMsg(text) {
  const box = $("curseMsg");
  box.textContent = text;
  box.classList.remove("hidden");
  box.style.animation = "none"; void box.offsetWidth; box.style.animation = ""; // reinicia a animação
  clearTimeout(showCurseMsg.h);
  showCurseMsg.h = setTimeout(() => box.classList.add("hidden"), 4000);
}

function trackCurses(me) {
  const cur = {};
  for (const p of S.players) cur[p.id] = p.curse || "";
  if (prevCurse && S.phase === "playing" && me) {
    const mine = cur[me.id], before = prevCurse[me.id] || "";
    const gainer = S.players.find((p) => p.id !== me.id && cur[p.id] && !prevCurse[p.id]);
    const loser = S.players.find((p) => p.id !== me.id && prevCurse[p.id] && !cur[p.id]);
    if (mine && !before) {
      const [n, d] = CURSE_INFO[mine];
      showCurseMsg(`💀 ${loser ? loser.name + " te passou a caveira!" : "Caveira!"} ${n}: ${d} (${me.curse_t} s). Encoste em alguém para passá-la.`);
    } else if (!mine && before) {
      showCurseMsg(gainer ? `💀 Você passou a caveira para ${gainer.name}!` : "A maldição acabou.");
    } else if (gainer && !loser && gainer.curse) {
      showCurseMsg(`💀 ${gainer.name} pegou a caveira: ${CURSE_INFO[gainer.curse][0]}`);
    }
  }
  prevCurse = cur;
}

const lastKey = {};
function renderOnce(el_, data, build) {
  const key = JSON.stringify(data);
  if (lastKey[el_.id] === key) return;
  lastKey[el_.id] = key;
  el_.replaceChildren(...build());
}

// ---------- desenho ----------
function currentStyle() {
  const d = A.tilesets.default, m = A.tilesets[S.map] || {};
  return {
    st: MAP_STYLE[S.map] || MAP_STYLE.classic,
    ts: { floor: m.floor && m.floor.length ? m.floor : d.floor, wall: m.wall || d.wall, block: m.block || d.block },
  };
}

function drawFloor(st, ts) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (ts.floor.length) { ctx.drawImage(ts.floor[(x + y) % ts.floor.length], x * TILE, y * TILE, TILE, TILE); continue; }
      ctx.fillStyle = st.floor[(x + y) % 2];
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
}

function drawGrid(grid, st, ts) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = grid[y * W + x], px = x * TILE, py = y * TILE;
      if (c === "1") {
        if (ts.wall) { ctx.drawImage(ts.wall, px, py, TILE, TILE); continue; }
        const [base, light, dark] = st.wall;
        ctx.fillStyle = base; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = light; ctx.fillRect(px, py, TILE, 5); ctx.fillRect(px, py, 5, TILE);
        ctx.fillStyle = dark; ctx.fillRect(px, py + TILE - 5, TILE, 5); ctx.fillRect(px + TILE - 5, py, 5, TILE);
      } else if (c === "2") {
        if (ts.block) { ctx.drawImage(ts.block, px, py, TILE, TILE); continue; }
        ctx.fillStyle = st.block[0]; ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = st.block[1]; ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(px + 3, py + TILE / 2); ctx.lineTo(px + TILE - 3, py + TILE / 2);
        ctx.moveTo(px + TILE / 2, py + 3); ctx.lineTo(px + TILE / 2, py + TILE / 2);
        ctx.moveTo(px + TILE / 4, py + TILE / 2); ctx.lineTo(px + TILE / 4, py + TILE - 3);
        ctx.moveTo(px + TILE * 3 / 4, py + TILE / 2); ctx.lineTo(px + TILE * 3 / 4, py + TILE - 3);
        ctx.stroke();
      }
    }
}

const PORTAL_COLORS = ["#4aa8ff", "#ff6ad5", "#ffd84a", "#6dff9c"];
const BELT_ANGLE = { r: 0, d: Math.PI / 2, l: Math.PI, u: -Math.PI / 2 };

// portais e esteiras (casas especiais de algumas fases)
function drawSpecials(specials, now) {
  for (const [x, y, kind, extra] of specials) {
    const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
    if (kind === "b") { // esteira: base escura com setas correndo na direção do movimento
      ctx.save();
      ctx.beginPath(); ctx.rect(x * TILE, y * TILE, TILE, TILE); ctx.clip();
      ctx.fillStyle = "rgba(20,20,26,.55)"; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.translate(cx, cy); ctx.rotate(BELT_ANGLE[extra]);
      ctx.strokeStyle = "rgba(255,214,102,.85)"; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const phase = (now / 700) % 1;
      for (let i = -1; i < 3; i++) { // espaçamento = TILE/2, então o desenho emenda entre casas vizinhas
        const px = (i + phase) * (TILE / 2) - TILE / 2;
        ctx.beginPath(); ctx.moveTo(px - 5, -9); ctx.lineTo(px + 3, 0); ctx.lineTo(px - 5, 9); ctx.stroke();
      }
      ctx.restore();
    } else { // portal: redemoinho colorido; cada par tem uma cor
      const col = PORTAL_COLORS[extra % PORTAL_COLORS.length], r = TILE * 0.4;
      ctx.fillStyle = "rgba(10,8,30,.8)";
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.shadowColor = col; ctx.shadowBlur = 10;
      for (let k = 0; k < 3; k++) {
        const a0 = (now / (320 + k * 140)) * (k % 2 ? -1 : 1);
        ctx.beginPath(); ctx.arc(cx, cy, r * (1 - k * 0.27), a0, a0 + Math.PI * 1.35); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
  }
}

function drawItems(items, now) {
  ctx.font = "22px system-ui, 'Segoe UI Emoji', 'Noto Color Emoji'"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [x, y, k] of items) {
    const bob = Math.sin(now / 250 + x + y) * 2;
    if (A.items[k]) { ctx.drawImage(A.items[k], x * TILE, y * TILE + bob, TILE, TILE); continue; }
    const [col, icon] = ITEMS[k];
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.roundRect(x * TILE + 6, y * TILE + 6 + bob, TILE - 12, TILE - 12, 8); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.fillText(icon, x * TILE + TILE / 2, y * TILE + TILE / 2 + 1 + bob);
  }
}

function drawFlames(flames) {
  for (const [x, y, t] of flames) {
    ctx.globalAlpha = Math.min(1, 0.35 + t * 2);
    if (A.flame) { ctx.drawImage(A.flame, x * TILE, y * TILE, TILE, TILE); ctx.globalAlpha = 1; continue; }
    ctx.fillStyle = "#ff8a1f"; ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = "#ffe14d"; ctx.fillRect(x * TILE + 12, y * TILE + 12, TILE - 24, TILE - 24);
    ctx.globalAlpha = 1;
  }
}

function drawBombs(bombs, now) {
  for (const [x, y, hop, t, , remote] of bombs) {
    const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE - hop * TILE * 0.9;
    const r = TILE * 0.36 * (1 + 0.08 * Math.sin(now / (!remote && t < 0.7 ? 40 : 120)));
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.ellipse(cx, (y + 0.5) * TILE + r * 0.7, r * 0.8, r * 0.35, 0, 0, 7); ctx.fill();
    if (A.bomb) { const s = TILE * (r / (TILE * 0.36)); ctx.drawImage(A.bomb, cx - s / 2, cy - s / 2, s, s); continue; }
    ctx.fillStyle = remote ? "#12304f" : "#111"; ctx.beginPath(); ctx.arc(cx, cy + 2, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(cx - r / 3, cy - r / 3, r / 4, 0, 7); ctx.fill();
    if (remote) { ctx.strokeStyle = "#4aa8ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy + 2, r + 2, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - r + 2); ctx.lineTo(cx + 6, cy - r - 6); ctx.stroke();
    ctx.fillStyle = !remote && t < 0.7 ? "#fff" : "#ff5a1f";
    ctx.beginPath(); ctx.arc(cx + 6, cy - r - 6, 3, 0, 7); ctx.fill();
  }
}

function drawPlayers(players, dt, now) {
  const k = 1 - Math.exp(-dt * 25);
  for (const p of players) {
    const v = vis[p.id] || (vis[p.id] = { x: p.x, y: p.y });
    if (Math.hypot(p.x - v.x, p.y - v.y) > 1.5) { v.x = p.x; v.y = p.y; }
    const moving = Math.hypot(p.x - v.x, p.y - v.y) > 0.01;
    v.x += (p.x - v.x) * k;
    v.y += (p.y - v.y) * k;
    if (!p.alive) continue;
    const cx = v.x * TILE, cy = v.y * TILE;
    if (p.invuln && Math.floor(now / 90) % 2) continue; // pisca ao tomar dano
    if (p.shield) {
      ctx.strokeStyle = "rgba(90,190,255,.9)"; ctx.lineWidth = 3; ctx.fillStyle = "rgba(90,190,255,.18)";
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.55, 0, 7); ctx.fill(); ctx.stroke();
    }
    drawCharacter(ctx, SKINS[p.skin % SKINS.length], p.face, cx, cy, TILE, moving, now);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "bold 11px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    ctx.strokeText(p.name, cx, cy - TILE * 0.62); ctx.fillText(p.name, cx, cy - TILE * 0.62);
    if (p.curse) { ctx.font = "18px system-ui, 'Noto Color Emoji'"; ctx.fillText("💀", cx + TILE * 0.35, cy - TILE * 0.35); }
  }
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (screen === "game" && S) {
    const { st, ts } = currentStyle();
    drawFloor(st, ts);
    drawSpecials(S.specials || [], now);
    drawGrid(S.grid, st, ts);
    drawItems(S.items, now);
    drawFlames(S.flames);
    drawBombs(S.bombs, now);
    drawPlayers(S.players, dt, now);
  }
  requestAnimationFrame(frame);
}

// ---------- ligação dos botões ----------
function init() {
  try { $("playerName").value = localStorage.getItem("ctib-name") || ""; } catch { /* ignore */ }
  try { mySkin = Math.max(0, Math.min(SKINS.length - 1, parseInt(localStorage.getItem("ctib-skin") || "0", 10) || 0)); } catch { mySkin = 0; }
  buildSkinGrid();
  renderHistory();
  sizeCanvas();

  $("btnRank").onclick = () => $("rankModal").classList.remove("hidden");
  $("rankClose").onclick = () => $("rankModal").classList.add("hidden");
  $("rankModal").onclick = (e) => { if (e.target === $("rankModal")) $("rankModal").classList.add("hidden"); };
  $("btnSkin").onclick = () => { buildSkinGrid(); show("skin"); };
  $("skinBack").onclick = () => {
    if (skinRoomMode) { skinRoomMode = false; show("game"); return; }
    drawSkinMini();
    show("title");
  };
  $("skinBtn").onclick = () => { skinRoomMode = true; buildSkinGrid(); show("skin"); };
  $("btnSingle").onclick = () => { if (playerInfo()) show("single"); };
  $("singleBack").onclick = () => show("title");
  $("singlePlay").onclick = () => {
    const p = playerInfo(), f = forms.single;
    if (!p) return;
    lastMode = "single";
    send({ t: "create", single: true, bots: f.bots.value, map: f.map.value, rounds: f.rounds.value, time: f.time.value, ...p });
  };
  $("btnMulti").onclick = () => { if (playerInfo()) { send({ t: "rooms" }); show("multi"); } };
  $("multiBack").onclick = () => {
    $("createForm").classList.add("hidden"); $("createConfirm").classList.add("hidden"); $("btnCreate").classList.remove("hidden");
    show("title");
  };
  $("btnCreate").onclick = () => {
    $("createForm").classList.remove("hidden"); $("createConfirm").classList.remove("hidden"); $("btnCreate").classList.add("hidden");
  };
  $("createConfirm").onclick = () => {
    const p = playerInfo(), f = forms.create;
    if (!p) return;
    lastMode = "multi";
    send({ t: "create", room: f.room.value, map: f.map.value, rounds: f.rounds.value, time: f.time.value, ...p });
    $("createForm").classList.add("hidden"); $("createConfirm").classList.add("hidden"); $("btnCreate").classList.remove("hidden");
  };
  $("playerName").onkeydown = (e) => { if (e.key === "Enter") $("btnMulti").click(); };
  $("readyBtn").onclick = () => {
    const me = S && S.players.find((p) => p.id === myId);
    if (me) send({ t: "ready", v: !me.ready });
  };
  $("leaveBtn").onclick = $("leaveBtn2").onclick = () => send({ t: "leave" });
  show("title");
}

loadTheme().finally(() => {
  init();
  connect();
  requestAnimationFrame(frame);
});
