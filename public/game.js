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
  ice: { floor: ["#cfe9f5", "#c2e0ee"], wall: ["#4f7a96", "#8fc0dc", "#2f5068"], block: ["#f2fbff", "#8cb9cf"] },
  walls: { floor: ["#7d6a52", "#85715a"], wall: ["#4a3b2c", "#6e5a43", "#2b2118"], block: ["#c98c4a", "#7a4d20"] },
  ice_stripes: { floor: ["#b9d9ea", "#aed0e4"], wall: ["#4f7a96", "#8fc0dc", "#2f5068"], block: ["#eaf6fc", "#7fb0c8"] },
  chambers: { floor: ["#5b4a6b", "#63527a"], wall: ["#2c2438", "#4d4262", "#171221"], block: ["#d9a441", "#80571a"] },
  belts_parallel: { floor: ["#5f646d", "#575c65"], wall: ["#30343b", "#4d525c", "#1b1e23"], block: ["#e0a93c", "#855c12"] },
  bastions: { floor: ["#6a8a4a", "#719253"], wall: ["#5a5f6b", "#858c9c", "#363a44"], block: ["#b87a3f", "#6f4521"] },
  lava: { floor: ["#3a2a2a", "#412f2f"], wall: ["#22181a", "#3d2c2f", "#0e0a0b"], block: ["#8a6a52", "#4d3826"] },
};

// powerups: cor, ícone, nome, descrição
const ITEMS = {
  bomb_up: ["#8e44ad", "💣", "Bomba extra", "+1 bomba ao mesmo tempo"],
  fire_up: ["#e67e22", "🔥", "Fogo", "+1 de alcance da explosão"],
  speed_up: ["#16a085", "👟", "Velocidade", "Anda mais rápido"],
  full_fire: ["#c0392b", "💥", "Fogo total", "Alcance máximo"],
  remote: ["#2980b9", "📡", "Controle remoto", "Suas bombas só explodem quando você aperta E ou Shift"],
  bomb_pass: ["#7f8c8d", "👻", "Passa-bomba", "Atravessa bombas. CTRL liga e desliga (desligado, chutar e socar bombas funciona)"],
  wall_pass: ["#a0522d", "🧱", "Passa-bloco", "Atravessa blocos destrutíveis"],
  kick: ["#d35400", "🥾", "Chute", "Ande contra uma bomba para chutá-la"],
  glove: ["#27ae60", "🧤", "Luva", "Espaço sobre a bomba a arremessa 3 casas à frente"],
  punch: ["#c0392b", "👊", "Soco", "Ande contra uma bomba para socá-la por cima dos obstáculos"],
  shield: ["#2c82c9", "🛡️", "Colete", "Deixa você imortal por 30 segundos. A morte súbita ignora o colete"],
  heart: ["#e84393", "❤️", "Vida extra", "Sobrevive a mais uma explosão"],
  skull: ["#2d3436", "💀", "Caveira", "Maldição aleatória por 10 s (lento, rápido, sem bombas, bombas automáticas, controles invertidos…). Encoste em outro jogador para passá-la!"],
  line_bomb: ["#f39c12", "➡️", "Bombas em linha", "Solta todas as bombas de uma vez em linha"],
  pierce_bomb: ["#3b82c4", "🔱", "Bomba perfurante", "O fogo das suas bombas atravessa blocos e bombas; só as paredes o param"],
  power_bomb: ["#6c5ce7", "☢️", "Super bomba", "Sua primeira bomba tem alcance máximo, mas só uma por vez: ela precisa explodir para a próxima aparecer"],
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
const BOMB_FUSE = 2.0; // mesmo valor do servidor: serve para animar a bomba desde que foi solta
const A = { death: null, pixelArt: false, tileset: null, tilesets: { default: { floor: [], wall: null, block: null } }, items: {}, bomb: null, bombPower: null, bombPierce: null, flame: null, flameSheet: null };
let SKINS = []; // skins do tema, pelo número: {color, sheet?}
let CUSTOM = []; // skins enviadas pelos jogadores (lista do servidor): {id, file, name, owner}
const customLoaded = {}; // id → skin pronta para desenhar

function loadImg(src, base = "assets/") {
  return new Promise((res) => {
    if (!src) return res(null);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { console.warn("asset não encontrado:", src); res(null); };
    img.src = base + src;
  });
}

// tilesets por tema (assets/tilesets/<tema>/): parede (borda do mapa), inquebravel (pilares), quebravel, piso_a, piso_b e piso_decorado,
// mais mecânicas que ficam em um tema só mas valem para qualquer mapa: agua (grama), escorregadio (gelo), esteira (industrial), lava (vulcao), portal (magico)
const TILESET_FILES = ["parede", "inquebravel", "quebravel", "piso_a", "piso_b", "piso_decorado"];
const TILESET_EXTRA = { agua: "grama", escorregadio: "gelo", esteira: "industrial", lava: "vulcao", portal: "magico" };

const TILE_ANIM_MS = { esteira: 60, agua: 150, escorregadio: 110, portal: 90, lava: 140 }; // ms por quadro (tilesets/LEIAME.txt)
// desenha o tile de mecânica (animado ou parado) na casa atual do contexto, que já deve estar posicionado
function drawExtraTile(t, x, y, w, h, now) {
  const fw = t.img.width / t.frames, f = t.frames > 1 ? Math.floor(now / t.ms) % t.frames : 0;
  ctx.drawImage(t.img, f * fw, 0, fw, t.img.height, x, y, w, h);
}

async function loadTilesets(cfg) {
  const dir = (cfg.dir || "tilesets").replace(/\/$/, "");
  const themes = {};
  await Promise.all((cfg.themes || []).map(async (name) => {
    const imgs = await Promise.all(TILESET_FILES.map((f) => loadImg(`${dir}/${name}/${f}.png`)));
    themes[name] = Object.fromEntries(TILESET_FILES.map((f, i) => [f, imgs[i]]));
  }));
  const extra = {};
  await Promise.all(Object.entries(TILESET_EXTRA).map(async ([f, name]) => {
    const anim = await loadImg(`${dir}/animacoes/${f}_anim.png`); // tira de 8 quadros 16x16 (se existir); senão o tile parado do tema
    if (anim) { extra[f] = { img: anim, frames: Math.max(1, Math.round(anim.width / anim.height)), ms: TILE_ANIM_MS[f] || 120 }; return; }
    const img = await loadImg(`${dir}/${name}/${f}.png`);
    extra[f] = img && { img, frames: 1, ms: 0 };
  }));
  return { themes, extra, maps: cfg.maps || {} };
}

async function loadTileset(t = {}) {
  return {
    floor: (await Promise.all([].concat(t.floor || []).map(loadImg))).filter(Boolean),
    wall: await loadImg(t.wall),
    block: await loadImg(t.block),
  };
}

// bomba: imagem única ("bomb.webp") ou spritesheet em uma linha {image, frames, fps, frameWidth?, gap?}.
// Os quadros são achados pela transparência (cada bloco de colunas com desenho é um quadro, e podem ter tamanhos diferentes);
// se a contagem não bater, usa uma grade uniforme com frameWidth/gap.
function sheetRects(img, n, fw, gap) {
  try {
    const c = el("canvas", { width: img.width, height: img.height });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data, runs = [];
    let from = -1;
    for (let x = 0; x <= img.width; x++) {
      let any = false;
      if (x < img.width) for (let y = 0; y < img.height && !any; y++) any = d[(y * img.width + x) * 4 + 3] > 8;
      if (any && from < 0) from = x;
      if (!any && from >= 0) { runs.push([from, x]); from = -1; }
    }
    if (runs.length === n) {
      return runs.map(([x0, x1]) => {
        let y0 = img.height, y1 = 0;
        for (let y = 0; y < img.height; y++) for (let x = x0; x < x1; x++) if (d[(y * img.width + x) * 4 + 3] > 8) { y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); break; }
        return { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 };
      });
    }
  } catch { /* imagem de outra origem: cai na grade uniforme */ }
  return Array.from({ length: n }, (_, i) => ({ sx: i * (fw + gap), sy: 0, sw: fw, sh: img.height }));
}

// atlas da explosão: grade n×n com todas as peças (centro, trechos de braço e pontas nas 4 direções).
// Cada célula é achada pela transparência; "parts" diz quais células de [coluna, linha] formam cada peça (lista = variações).
// Lendo da esquerda para a direita, a linha do meio do atlas é: bulbo, ponta, trecho, CENTRO, trecho, ponta, bulbo.
// A ponta (1 casa de largura, extremidade afilada) é a peça de verdade do fim do braço; os bulbos largos com asas das extremidades não são usados.
const FLAME_PARTS = {
  center: [[3, 3]], h: [[2, 3], [4, 3]], v: [[3, 2], [3, 4]],
  left: [[1, 3]], right: [[5, 3]], up: [[3, 1]], down: [[3, 5]],
};
function alphaRuns(img) {
  try {
    const c = el("canvas", { width: img.width, height: img.height });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const scan = (len, other, at) => {
      const runs = []; let from = -1;
      for (let i = 0; i <= len; i++) {
        let any = false;
        if (i < len) for (let j = 0; j < other && !any; j++) any = d[at(i, j) * 4 + 3] > 8;
        if (any && from < 0) from = i;
        if (!any && from >= 0) { runs.push([from, i]); from = -1; }
      }
      return runs;
    };
    return { xs: scan(img.width, img.height, (i, j) => j * img.width + i), ys: scan(img.height, img.width, (i, j) => i * img.width + j) };
  } catch { return null; } // imagem de outra origem: usa a grade uniforme
}

async function loadFlameSheet(f) {
  const img = await loadImg(f.image);
  if (!img) return null;
  const n = f.grid || 7, runs = alphaRuns(img), ok = runs && runs.xs.length === n && runs.ys.length === n;
  const xs = ok ? runs.xs.map((r) => r[0]) : Array.from({ length: n }, (_, i) => Math.round((i * img.width) / n));
  const ys = ok ? runs.ys.map((r) => r[0]) : Array.from({ length: n }, (_, i) => Math.round((i * img.height) / n));
  const cw = ok ? Math.max(...runs.xs.map((r) => r[1] - r[0])) : Math.round(img.width / n);
  const ch = ok ? Math.max(...runs.ys.map((r) => r[1] - r[0])) : Math.round(img.height / n);
  const parts = {};
  for (const [name, cells] of Object.entries(f.parts || FLAME_PARTS)) parts[name] = cells.map(([c, r]) => ({ sx: xs[c], sy: ys[r], sw: cw, sh: ch }));
  return { img, parts, cache: new Map() };
}

// As peças do atlas não têm cores idênticas nas bordas, então o encontro de duas peças deixava uma linha visível.
// Cada peça é pré-desenhada com FLAME_OV px a mais nos lados que encostam em outra chama. Só as bordas da esquerda e de cima
// esmaecem; como as chamas são desenhadas da esquerda para a direita e de cima para baixo, a peça nova entra aos poucos por cima
// da vizinha, que continua opaca (esmaecer as duas deixaria o fundo aparecer no encontro). Lados: L=1 R=2 U=4 D=8.
const FLAME_OV = 5, FLAME_EDGE = 6; // sobreposição entre peças e largura do contorno que não esmaece (px)
const FLAME_TRIM = 30; // largura (px do atlas) do contorno escuro que sai do lado onde há outra chama paralela, para as duas se unirem
// lados ligados a outra chama; os mesmos valores do servidor (CONN_* em server/game.py)
const FLAME_L = 1, FLAME_R = 2, FLAME_U = 4, FLAME_D = 8;
const FLAME_H = FLAME_L | FLAME_R, FLAME_V = FLAME_U | FLAME_D, FLAME_ALL = FLAME_H | FLAME_V;
// O centro (lâmpada) do atlas ocupa a casa toda e só encaixa quando há braços dos 4 lados; sem braço, a lateral reta colava na parede.
// Em trecho reto (só vertical ou só horizontal) vira o trecho do braço com a lâmpada por cima, esmaecida nas bordas;
// em canto, T ou casa isolada, os lados sem chama fecham em arco com contorno.
function flameCenterCanvas(sheet, vi, conn, lat) {
  const S = TILE + FLAME_OV * 2, O = FLAME_OV, mid = S / 2, hasH = conn & FLAME_H, hasV = conn & FLAME_V;
  const c = el("canvas", { width: S, height: S }), g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const q = sheet.parts.center[0];
  if ((hasV && !hasH) || (hasH && !hasV)) {
    const arm = hasV ? "v" : "h";
    g.drawImage(flameCanvas(sheet, arm, vi % sheet.parts[arm].length, conn, lat), 0, 0);
    const bulb = el("canvas", { width: S, height: S }), b = bulb.getContext("2d");
    b.imageSmoothingEnabled = false;
    b.drawImage(sheet.img, q.sx, q.sy, q.sw, q.sh, O, O, TILE, TILE);
    b.globalCompositeOperation = "destination-in"; // só a lâmpada e o brilho em volta, sem as bordas retas
    const rg = b.createRadialGradient(mid, mid, TILE * 0.22, mid, mid, TILE * 0.5);
    rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    b.fillStyle = rg; b.fillRect(0, 0, S, S);
    g.drawImage(bulb, 0, 0);
    return c;
  }
  if (conn) { // canto ou T: só os braços que têm chama saem do centro; o lado da parede não ganha sprite esticado
    const E = FLAME_EDGE + O;
    // metade do braço (rx..): `cut` lista as faixas de contorno do braço que encostam num braço perpendicular e some nelas,
    // senão o contorno do braço de baixo atravessava o de cima e deixava "ombros" escuros na junção
    const clip = (rx, ry, rw, rh, arm, cut = []) => {
      const part = el("canvas", { width: S, height: S }), p = part.getContext("2d");
      p.imageSmoothingEnabled = false;
      p.drawImage(flameCanvas(sheet, arm, vi % sheet.parts[arm].length, conn & (arm === "h" ? FLAME_H : FLAME_V), 0), 0, 0);
      p.globalCompositeOperation = "destination-in";
      p.fillRect(rx, ry, rw, rh);
      p.globalCompositeOperation = "destination-out";
      for (const [cx, cy, cw, ch] of cut) p.fillRect(cx, cy, cw, ch);
      g.drawImage(part, 0, 0);
    };
    if (conn & FLAME_L) clip(0, 0, mid, S, "h");
    if (conn & FLAME_R) clip(mid, 0, mid, S, "h");
    const side = [...(conn & FLAME_L ? [[O - 1, O, E + 1, S - 2 * O]] : []), ...(conn & FLAME_R ? [[S - O - E, O, E + 1, S - 2 * O]] : [])];
    if (conn & FLAME_U) clip(0, 0, S, mid, "v", side);
    if (conn & FLAME_D) clip(0, mid, S, mid, "v", side);
    const bulb = el("canvas", { width: S, height: S }), b = bulb.getContext("2d");
    b.imageSmoothingEnabled = false;
    b.drawImage(sheet.img, q.sx, q.sy, q.sw, q.sh, O, O, TILE, TILE);
    b.globalCompositeOperation = "destination-in";
    const rg = b.createRadialGradient(mid, mid, TILE * 0.22, mid, mid, TILE * 0.5);
    rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
    b.fillStyle = rg; b.fillRect(0, 0, S, S);
    g.drawImage(bulb, 0, 0);
    return c;
  }
  // casa isolada: fecha em arco com contorno
  const x0 = conn & FLAME_L ? 0 : O, x1 = conn & FLAME_R ? S : S - O, y0 = conn & FLAME_U ? 0 : O, y1 = conn & FLAME_D ? S : S - O;
  g.drawImage(sheet.img, q.sx, q.sy, q.sw, q.sh, x0, y0, x1 - x0, y1 - y0);
  const strips = [];
  if (conn & FLAME_L) strips.push([0, O, mid, TILE]);
  if (conn & FLAME_R) strips.push([mid, O, mid, TILE]);
  if (conn & FLAME_U) strips.push([O, 0, TILE, mid]);
  if (conn & FLAME_D) strips.push([O, mid, TILE, mid]);
  const shape = el("canvas", { width: S, height: S }), k = shape.getContext("2d");
  k.fillStyle = "#000"; k.beginPath(); k.arc(mid, mid, TILE / 2, 0, 7); k.fill();
  for (const [rx, ry, rw, rh] of strips) k.fillRect(rx, ry, rw, rh);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(shape, 0, 0);
  const ring = el("canvas", { width: S, height: S }), r = ring.getContext("2d"); // contorno escuro só nos arcos (some onde há braço)
  r.strokeStyle = flameOutline(sheet); r.lineWidth = 5;
  r.beginPath(); r.arc(mid, mid, TILE / 2 - 1.5, 0, 7); r.stroke();
  r.globalCompositeOperation = "destination-out";
  for (const [rx, ry, rw, rh] of strips) r.fillRect(rx, ry, rw, rh);
  g.globalCompositeOperation = "source-atop";
  g.drawImage(ring, 0, 0);
  return c;
}

// cor do contorno escuro do sprite (a borda do trecho vertical do atlas); se a leitura falhar, um vermelho escuro parecido
function flameOutline(sheet) {
  if (sheet.outline) return sheet.outline;
  sheet.outline = "#7a1405";
  try {
    const q = sheet.parts.v[0], t = el("canvas", { width: 1, height: 1 }).getContext("2d");
    t.drawImage(sheet.img, q.sx + 3, q.sy + Math.floor(q.sh / 2), 1, 1, 0, 0, 1, 1);
    const d = t.getImageData(0, 0, 1, 1).data;
    if (d[3] > 200) sheet.outline = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch { /* imagem de outra origem */ }
  return sheet.outline;
}

function flameCanvas(sheet, part, vi, conn, lat = 0, flip = 0) {
  const key = `${part}:${vi}:${conn}:${lat}:${flip}`;
  let c = sheet.cache.get(key);
  if (c) return c;
  if (part === "center" && conn !== FLAME_ALL) { // centro sem braços dos 4 lados: adapta ao que existe em volta
    c = flameCenterCanvas(sheet, vi, conn, lat);
    sheet.cache.set(key, c);
    return c;
  }
  const q = sheet.parts[part][vi], S = TILE + FLAME_OV * 2, O = FLAME_OV;
  c = el("canvas", { width: S, height: S });
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const x0 = conn & FLAME_L ? 0 : O, x1 = conn & FLAME_R ? S : S - O, y0 = conn & FLAME_U ? 0 : O, y1 = conn & FLAME_D ? S : S - O;
  // lado com chama paralela (lat): o contorno desse lado é cortado do sprite e o miolo estica até a borda da casa, unindo as duas chamas
  const tl = lat & FLAME_L ? FLAME_TRIM : 0, tr = lat & FLAME_R ? FLAME_TRIM : 0, tu = lat & FLAME_U ? FLAME_TRIM : 0, td = lat & FLAME_D ? FLAME_TRIM : 0;
  // flip (1 = espelha na horizontal, 2 = na vertical): peças vizinhas lado a lado usam a mesma variação, uma delas espelhada,
  // então as duas bordas que se encostam são idênticas e a emenda some (os cortes lat valem no lado da tela, não no do sprite)
  const fx = flip & 1, fy = flip & 2;
  const sl = fx ? tr : tl, sr = fx ? tl : tr, su = fy ? td : tu, sd = fy ? tu : td;
  g.save();
  g.translate(fx ? S : 0, fy ? S : 0);
  g.scale(fx ? -1 : 1, fy ? -1 : 1);
  g.drawImage(sheet.img, q.sx + sl, q.sy + su, q.sw - sl - sr, q.sh - su - sd, fx ? S - x1 : x0, fy ? S - y1 : y0, x1 - x0, y1 - y0);
  g.restore();
  // máscara em um canvas à parte: começa opaca e cada lado esquerdo/de cima ligado recebe um degradê de 0 (ponta de fora) a 1 (2*OV para dentro).
  // As faixas do contorno (FLAME_EDGE px de cada lado do braço) ficam sempre opacas: esmaecer o contorno abria um "bocado" na borda da chama.
  const m = el("canvas", { width: S, height: S }), h = m.getContext("2d");
  h.fillStyle = "#000"; h.fillRect(0, 0, S, S);
  const side = (gx0, gy0, gx1, gy1, strips) => {
    const t = el("canvas", { width: S, height: S }), k = t.getContext("2d");
    const grad = k.createLinearGradient(gx0, gy0, gx1, gy1);
    grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,1)");
    k.fillStyle = grad; k.fillRect(0, 0, S, S);
    k.fillStyle = "#000"; for (const [rx, ry, rw, rh] of strips) k.fillRect(rx, ry, rw, rh);
    h.globalCompositeOperation = "destination-in";
    h.drawImage(t, 0, 0);
  };
  const E = FLAME_EDGE;
  if (conn & FLAME_L) side(0, 0, 2 * O, 0, [[0, 0, S, O + E], [0, S - O - E, S, O + E]]); // junção horizontal: contorno de cima e de baixo
  if (conn & FLAME_U) side(0, 0, 0, 2 * O, [[0, 0, O + E, S], [S - O - E, 0, O + E, S]]); // junção vertical: contorno da esquerda e da direita
  g.globalCompositeOperation = "destination-in";
  g.drawImage(m, 0, 0);
  sheet.cache.set(key, c);
  return c;
}

// máscara de lados ligados a outra chama (L=1 R=2 U=4 D=8) -> peça do atlas; ponta aponta para o lado sem chama
function flamePart(m) {
  if (m === 0 || ((m & FLAME_H) && (m & FLAME_V))) return "center";
  if (m === FLAME_H) return "h";
  if (m === FLAME_V) return "v";
  return { [FLAME_R]: "left", [FLAME_L]: "right", [FLAME_D]: "up", [FLAME_U]: "down" }[m];
}

// animação de morte: grade uniforme (sem cortar o vazio), pois a posição vertical de cada quadro faz parte da animação
async function loadDeathSheet(d) {
  if (!d) return null;
  if (typeof d === "string") d = { image: d };
  const img = await loadImg(d.image);
  if (!img) return null;
  const n = d.frames || 8, fw = Math.floor(img.width / n);
  return { img, n, fw, fps: d.fps || 9, scale: d.scale || 1.4 };
}

async function loadBombSheet(b) {
  if (!b) return null;
  if (typeof b === "string") b = { image: b };
  const img = await loadImg(b.image);
  if (!img) return null;
  const n = b.frames || 1, gap = b.gap || 0, fw = b.frameWidth || Math.round((img.width - gap * (n - 1)) / n);
  const rects = n > 1 ? sheetRects(img, n, fw, gap) : [{ sx: 0, sy: 0, sw: img.width, sh: img.height }];
  return { img, rects, maxDim: Math.max(...rects.map((q) => Math.max(q.sw, q.sh))), fps: b.fps || 6 };
}

async function loadSkin(s, i) {
  if (typeof s === "string") s = { image: s };
  const img = await loadImg(s.image);
  return img && makeSkin(img, s, DEFAULT_COLORS[i % DEFAULT_COLORS.length]);
}

function makeSkin(img, s, color) {
  return {
    color: s.color || color, name: s.name, owner: s.owner,
    sheet: {
      img, fw: s.frameWidth || img.width, fh: s.frameHeight || img.height,
      rows: s.rows || { d: 0, u: 1, l: 2, r: 3 }, frames: s.frames || 1, fps: s.fps || 8,
      scale: s.scale || 1, offsetY: s.offsetY || 0, shape: s.shape, pixelArt: s.pixelArt,
    },
  };
}

// ---------- skins enviadas pelos jogadores (salvas pelo servidor em data/skins/) ----------
const isCustom = (key) => typeof key === "string";
const hashColor = (id) => DEFAULT_COLORS[[...id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) % DEFAULT_COLORS.length];

// imagem simples (sem spritesheet), encaixada inteira dentro de um tile, com os pés no fim dele
function customSkin(img, c) {
  const sk = makeSkin(img, { name: c.name, owner: c.owner, scale: Math.min(1, img.height / img.width) }, hashColor(c.id || "x"));
  sk.sheet.pixelArt = false;
  return sk;
}

// as imagens vêm do servidor de jogo, que pode estar em outro endereço que o site (ex.: site na Vercel)
const skinUrl = (file) => new URL("skins/" + encodeURIComponent(file), serverUrl().replace(/^ws/, "http")).href;

function skinOf(key) {
  if (isCustom(key)) return customLoaded[key] || { color: hashColor(key) };
  return SKINS[key % SKINS.length];
}

const allSkins = () => [...SKINS.keys(), ...CUSTOM.map((c) => c.id)];

function setCustomSkins(list) {
  CUSTOM = list || [];
  if (isCustom(mySkin) && !CUSTOM.some((c) => c.id === mySkin)) mySkin = 0; // a skin escolhida foi apagada
  for (const c of CUSTOM) {
    if (c.id in customLoaded) continue;
    customLoaded[c.id] = null;
    loadImg(skinUrl(c.file), "").then((img) => {
      if (!img) return;
      customLoaded[c.id] = customSkin(img, c);
      skinsChanged();
    });
  }
  skinsChanged();
}

// redesenha tudo que mostra skins (cartões, retratos nas tabelas)
function skinsChanged() {
  skinGridKey = "";
  for (const k of Object.keys(lastKey)) delete lastKey[k];
  if (screen === "skin") buildSkinGrid();
  drawSkinMini();
  if (S && screen === "game") updateUI();
}

async function loadTheme() {
  let t = {};
  try { t = await (await fetch("assets/theme.json", { cache: "no-store" })).json(); } catch { /* sem tema */ }
  A.pixelArt = !!t.pixelArt;
  if (t.background) $("screen-title").style.setProperty("--title-bg", `url("assets/${t.background}")`);
  A.tileset = t.tilesets ? await loadTilesets(t.tilesets) : null;
  A.tilesets.default = await loadTileset(t.tiles);
  for (const [id, m] of Object.entries(t.maps || {})) A.tilesets[id] = await loadTileset(m.tiles);
  const items = t.items || {};
  for (const k of Object.keys(ITEMS)) {
    const alias = Object.keys(ITEM_ALIAS).find((a) => ITEM_ALIAS[a] === k);
    A.items[k] = await loadImg(items[k] || (alias && items[alias]));
  }
  buildLegend.done = false;
  buildLegend();
  const bombs = t.bombs || {}; // sprites das bombas: normal, power (super bomba) e pierce (perfurante); "bomb" (antigo) = normal
  A.death = await loadDeathSheet(t.death);
  A.bomb = await loadBombSheet(bombs.normal || t.bomb);
  A.bombPower = await loadBombSheet(bombs.power);
  A.bombPierce = await loadBombSheet(bombs.pierce);
  A.flame = typeof t.flame === "string" ? await loadImg(t.flame) : null; // imagem única para todas as casas em chamas
  A.flameSheet = t.flame && typeof t.flame === "object" ? await loadFlameSheet(t.flame) : null; // atlas com peças por direção
  const defs = t.skins || t.players || [];
  SKINS = (await Promise.all(defs.map(loadSkin))).filter(Boolean);
  for (let i = SKINS.length; i < MIN_SKINS; i++) SKINS.push({ color: DEFAULT_COLORS[i % DEFAULT_COLORS.length] });
}

// ---------- estado ----------
let ws, S = null, myId = null;
let maps = [], rooms = [], history = [];
let screen = "title", lastMode = "multi", reconnecting = false;
let mySkin = 0;
let lastEventId = null;
const CHAT_LIMIT = 80; // mensagens mantidas na tela
let skinRoomMode = false, skinChecked = false; // escolhendo skin de dentro de uma sala
const vis = {}; // posição suavizada dos jogadores

function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }

function addChat(m) {
  const log = $("chatLog");
  const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 24;
  const color = (skinOf(m.skin) || {}).color || "#c9b08a";
  log.append(el("li", {}, el("b", { textContent: m.name, style: `color:${color}` }), ": ", el("span", { textContent: m.text })));
  while (log.children.length > CHAT_LIMIT) log.firstChild.remove();
  if (atEnd) log.scrollTop = log.scrollHeight;
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.add("hidden"), 3500);
}

function show(name) {
  screen = name;
  document.body.classList.toggle("in-game", name === "game");
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
      case "hello": maps = m.maps; buildForms(); setCustomSkins(m.skins); break;
      case "skins": setCustomSkins(m.skins); break;
      case "skin_added": closeUpload(); pickSkin(m.id); toast("Skin salva! Todos os jogadores já podem vê-la."); break;
      case "rooms": rooms = m.rooms; if (screen === "multi") renderRooms(); break;
      case "history": history = m.rows; renderHistory(); break;
      case "chat": addChat(m); break;
      case "you": lastEventId = null; $("chatLog").replaceChildren(); myId = m.id; skinChecked = false; prevCurse = null; break;
      case "state":
        S = m;
        if (S.event && S.event.msg && S.event.id !== lastEventId) { if (lastEventId !== null) toast(S.event.msg); lastEventId = S.event.id; }
        if (skinRoomMode && S.phase !== "lobby") { skinRoomMode = false; show("game"); } // a partida começou
        if (screen !== "game" && !skinRoomMode) { show("game"); roomFormBuilt = false; }
        updateUI();
        if (skinRoomMode) buildSkinGrid(); // só refaz se alguma skin ocupada mudou
        break;
      case "left": S = null; myId = null; skinRoomMode = false; show(lastMode === "single" ? "title" : "multi"); break;
      case "error": toast(m.msg); $("upSend").disabled = false; break;
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
  if (e.code === "Enter" && !e.repeat) { e.preventDefault(); $("chatInput").focus(); return; }
  if (e.code === "Space") {
    e.preventDefault();
    if (document.activeElement && document.activeElement.tagName === "BUTTON") document.activeElement.blur();
    if (!e.repeat) send({ t: "bomb" });
    return;
  }
  if (e.code === "ControlLeft" || e.code === "ControlRight") { // liga/desliga o passa-bomba
    e.preventDefault();
    if (!e.repeat) send({ t: "pass" });
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

// controles de toque: analógico (direção dominante, com zona morta) e botões de ação
const TOUCH = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 && !matchMedia("(hover: hover)").matches;
if (TOUCH) {
  document.body.classList.add("touch-ui");
  $("touch").classList.remove("hidden");
  const stick = $("stick"), knob = $("knob");
  const setDir = (d) => { held.length = 0; if (d) held.push(d); sendDir(); };
  const move = (e) => {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    knob.style.transform = `translate(${dx * 0.7}px, ${dy * 0.7}px)`;
    setDir(len < R * 0.25 ? "" : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : (dy > 0 ? "d" : "u"));
  };
  stick.addEventListener("pointerdown", (e) => { stick.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  stick.addEventListener("pointermove", (e) => { if (stick.hasPointerCapture(e.pointerId)) move(e); });
  const release = () => { knob.style.transform = ""; setDir(""); };
  stick.addEventListener("pointerup", release);
  stick.addEventListener("pointercancel", release);
  const tap = (id, msg) => $(id).addEventListener("pointerdown", (e) => { e.preventDefault(); send({ t: msg }); });
  tap("tBomb", "bomb"); tap("tDet", "det"); tap("tPass", "pass");
  document.addEventListener("contextmenu", (e) => { if (screen === "game") e.preventDefault(); });
}

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
  const sk = skinOf(mySkin);
  if (sk) drawCharacter(g, sk, "d", 14, 17, 26, false, 0);
}

function skinName(key) {
  if (isCustom(key)) return (CUSTOM.find((c) => c.id === key) || {}).name || "Skin apagada";
  return (SKINS[key] && SKINS[key].name) || `Skin ${key + 1}`;
}

function pickSkin(key) {
  mySkin = key;
  try { localStorage.setItem("ctib-skin", JSON.stringify(key)); } catch { /* ignore */ }
  if (skinRoomMode) { send({ t: "skin", skin: key }); skinRoomMode = false; show("game"); }
  else { buildSkinGrid(); drawSkinMini(); }
}

let skinGridKey = "";
function buildSkinGrid() {
  const grid = $("skinGrid");
  // dentro de uma sala, skins de outros jogadores ficam indisponíveis
  const takenBy = {};
  const me = skinRoomMode && S ? S.players.find((p) => p.id === myId) : null;
  if (skinRoomMode && S) for (const p of S.players) if (p.id !== myId && p.connected) takenBy[p.skin] = p.name;
  const current = me ? me.skin : mySkin; // na sala vale a skin que o servidor realmente deu
  // o servidor manda o estado 30x por segundo: refazer os cartões a cada um faria o clique se perder
  const myName = $("playerName").value.trim().toLowerCase();
  const key = JSON.stringify([takenBy, current, SKINS.length, CUSTOM, skinRoomMode, myName]);
  if (key === skinGridKey && grid.children.length) return;
  skinGridKey = key;
  const cards = allSkins().map((k) => {
    const c = el("canvas", { width: 80, height: 80 });
    drawCharacter(c.getContext("2d"), skinOf(k), "d", 40, 46, 72, false, 0);
    const taken = takenBy[k];
    const info = isCustom(k) ? CUSTOM.find((x) => x.id === k) : null;
    const card = el("div", { className: "skin" + (k === current ? " sel" : "") + (taken ? " taken" : ""), title: taken ? `Em uso por ${taken}` : "" },
      c, taken ? `${skinName(k)} (${taken})` : skinName(k));
    if (info && info.owner) card.append(el("small", { textContent: `por ${info.owner}` }));
    if (info && info.owner && info.owner.toLowerCase() === myName) { // quem enviou pode apagar
      const del = el("button", { className: "kick", textContent: "✖", title: "Apagar esta skin" });
      del.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Apagar a skin ${info.name}? Ela some para todos os jogadores.`)) send({ t: "skin_del", id: k, owner: $("playerName").value.trim() });
      };
      card.append(del);
    }
    if (!taken) card.onclick = () => pickSkin(k);
    return card;
  });
  const add = el("div", { className: "skin add", title: "Enviar uma imagem sua como skin" }, el("span", { className: "plus", textContent: "+" }), "Adicionar skin");
  add.onclick = openUpload;
  grid.replaceChildren(...cards, add);
}

// ---------- enviar uma skin ----------
let upload = null; // {url (data:), img}

function openUpload() {
  if (!$("playerName").value.trim()) { toast("Digite seu nome acima antes de enviar uma skin."); return; }
  $("skinUpload").classList.remove("hidden");
  $("skinUpload").scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeUpload() {
  upload = null;
  $("upFile").value = ""; $("upName").value = "";
  $("upSend").disabled = false;
  $("skinUpload").classList.add("hidden");
}

// toda skin enviada vira um quadrado de SKIN_PX: a imagem é encaixada inteira (sem cortar), centrada e com os pés embaixo
const SKIN_PX = 128;
async function prepareImage(file) {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const k = SKIN_PX / Math.max(img.width, img.height);
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    const c = el("canvas", { width: SKIN_PX, height: SKIN_PX });
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = Math.max(img.width, img.height) > 64; // pixel art pequena aumenta sem borrar
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (SKIN_PX - w) / 2, SKIN_PX - h, w, h);
    let url = c.toDataURL("image/webp", 0.92);
    if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
    return { url, img: c };
  } finally {
    URL.revokeObjectURL(src);
  }
}

// ---------- formulários ----------
const ROUND_OPTS = [1, 2, 3, 5, 7, 10, 15, 20];
const TIME_OPTS = [30, 60, 75, 90, 120, 180, 240, 300, 600];
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
const onOff = () => [["1", "Ativado"], ["0", "Desativado"]];
const timeOptions = () => TIME_OPTS.map((n) => [n, fmtTime(n)]);

const forms = {};
function buildForms() {
  forms.single = { map: select(mapOptions(), "rotate"), bots: select([1, 2, 3, 4, 5].map((n) => [n, `${n} ${n === 1 ? "bot" : "bots"}`]), 3), rounds: select(roundOptions(), 3), time: select(timeOptions(), 120), events: select(onOff(), "0"), sd_var: select(onOff(), "1") };
  $("singleForm").replaceChildren(field("Mapa", forms.single.map), field("Adversários", forms.single.bots),
    field("Rodadas", forms.single.rounds), field("Tempo de cada rodada", forms.single.time),
    field("Eventos no mapa", forms.single.events), field("Morte súbita variada", forms.single.sd_var));
  forms.create = { room: el("input", { maxLength: 24, placeholder: "Nome da sala" }), map: select(mapOptions(), "rotate"), rounds: select(roundOptions(), 3), time: select(timeOptions(), 120), events: select(onOff(), "0"), sd_var: select(onOff(), "1") };
  $("createForm").replaceChildren(field("Nome da sala", forms.create.room), field("Mapa", forms.create.map),
    field("Rodadas", forms.create.rounds), field("Tempo de cada rodada", forms.create.time),
    field("Eventos no mapa", forms.create.events), field("Morte súbita variada", forms.create.sd_var));
  roomFormBuilt = false;
}

function playerInfo() {
  const name = $("playerName").value.trim();
  if (!name) {
    toast("Digite seu nome em Personagens primeiro!");
    show("skin");
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
    tb.replaceChildren(el("tr", {}, el("td", { colSpan: 8, className: "note", textContent: "Ninguém pontuou ainda. Jogue uma partida multiplayer com 3 ou mais pessoas!" })));
    return;
  }
  const mine = $("playerName").value.trim().toLowerCase();
  tb.replaceChildren(...history.map((r, i) => el("tr", { className: r.name.toLowerCase() === mine ? "me" : "" },
    el("td", { className: "medal", textContent: ["🥇", "🥈", "🥉"][i] || i + 1 }), el("td", { textContent: r.name }),
    ...[r.points, r.avg, r.match_wins, r.round_wins, r.kills || 0, r.matches].map((v) => el("td", { className: "num", textContent: v })))));
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
  const change = () => send({ t: "settings", map: rf.map.value, rounds: rf.rounds.value, time: rf.time.value, events: rf.events.value, sd_var: rf.sd_var.value });
  rf.map = select(mapOptions(), "rotate", change);
  rf.rounds = select(roundOptions(), 3, change);
  rf.time = select(timeOptions(), 120, change);
  rf.events = select(onOff(), "0", change);
  rf.sd_var = select(onOff(), "1", change);
  $("roomSettings").replaceChildren(field("Mapa", rf.map), field("Rodadas", rf.rounds), field("Tempo da rodada", rf.time),
    field("Eventos no mapa", rf.events), field("Morte súbita variada", rf.sd_var));
}

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const skinColor = (p) => (skinOf(p.skin) || {}).color || "#888";
const dot = (p) => el("span", { className: "dot", style: `background:${skinColor(p)}` });

// retrato pequeno da skin do jogador (listas e tabelas)
function avatar(skinKey, size = 28) {
  const c = el("canvas", { width: size, height: size, className: "avatar" });
  const sk = skinOf(skinKey);
  if (sk) drawCharacter(c.getContext("2d"), sk, "d", size / 2, size * 0.58, size * 0.92, false, 0);
  return c;
}

function buildLegend() {
  if (buildLegend.done) return;
  buildLegend.done = true;
  $("legendList").replaceChildren(...Object.entries(ITEMS).map(([key, [col, icon, name, desc]]) =>
    el("li", {}, A.items[key]
      ? el("img", { className: "lg-img" + (A.pixelArt ? " px" : ""), src: A.items[key].src, alt: name, width: 32, height: 32 })
      : el("span", { className: "lg-ic", style: `background:${col}`, textContent: icon }),
      el("span", {}, el("b", { textContent: name }), " — " + desc))));
}

function updateUI() {
  buildLegend();
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
  for (const [k, v] of [["map", S.settings.map], ["rounds", S.settings.rounds], ["time", S.settings.time], ["events", S.settings.events ? 1 : 0], ["sd_var", S.settings.sd_var ? 1 : 0]]) {
    rf[k].disabled = !isHost;
    if (document.activeElement !== rf[k]) rf[k].value = String(v);
  }

  // sobreposição
  $("overlay").classList.toggle("hidden", S.phase === "playing");
  $("overlay").classList.toggle("clear", S.phase === "countdown"); // no início da rodada o mapa fica visível
  $("lobbyBox").classList.toggle("hidden", !lobby);
  $("finalTable").classList.toggle("hidden", S.phase !== "final");
  $("readyBtn").classList.toggle("hidden", !me);
  $("botRow").classList.toggle("hidden", !(isHost && S.phase === "lobby"));
  $("addBotBtn").disabled = S.players.length >= 6;
  $("rmBotBtn").disabled = !S.players.some((p) => p.bot);
  $("readyBtn").textContent = me && me.ready ? "Cancelar" : "Pronto!";
  const fin = S.phase === "final";
  $("finalRow").classList.toggle("hidden", !(fin && me));
  if (fin) {
    const ppl = S.players.filter((p) => p.connected);
    $("rematchBtn").textContent = me && me.ready ? "Cancelar" : "Pronto para nova partida";
    const falta = ppl.filter((p) => !p.ready).map((p) => p.name);
    $("finalStatus").textContent = `${ppl.length - falta.length} de ${ppl.length} prontos. ` + (falta.length ? `Faltam: ${falta.join(", ")}.` : "Começando…");
  }
  $("roomTitle").textContent = S.room;

  let msg = "";
  const showTitle = S.phase === "countdown";
  $("roundTitle").classList.toggle("hidden", !showTitle);
  $("roundTitle").textContent = S.tiebreak ? "RODADA DE DESEMPATE" : `RODADA ${S.round}/${S.rounds}`;
  $("roundTitle").classList.toggle("big", !!S.intro);
  if (S.phase === "countdown") msg = S.intro ? "" : String(S.countdown);
  else if (S.phase === "over") {
    const w = S.players.find((p) => p.id === S.winner);
    msg = w ? `${w.name} venceu a rodada!` : S.winner ? "Rodada encerrada" : "Empate!";
  } else if (S.phase === "final") msg = "Fim da partida!";
  $("msg").textContent = msg;
  $("msg").className = S.phase === "countdown" ? "count" : "";

  const canKick = (p) => isHost && p.id !== myId && !p.bot && p.connected;
  const kickBtn = (p) => {
    const b = el("button", { className: "kick", textContent: "✖", title: `Expulsar ${p.name} da sala`, ariaLabel: `Expulsar ${p.name} da sala` });
    b.onclick = () => { if (confirm(`Expulsar ${p.name} da sala?`)) send({ t: "kick", id: p.id }); };
    return b;
  };

  renderOnce($("lobbyList"), [S.players.map((p) => [p.id, p.name, p.ready, p.skin, p.connected]), S.host, isHost], () =>
    S.players.map((p) => el("li", {}, avatar(p.skin, 34), p.name + (p.id === myId ? " (você)" : "") + (p.id === S.host ? " 👑" : "") + (p.bot ? " 🤖" : ""),
      el("span", { className: "st pill " + (p.ready ? "ok" : "idle"), textContent: p.ready ? "pronto ✔" : "aguardando" }), canKick(p) ? kickBtn(p) : "")));

  renderOnce($("finalTable"), S.final, () => {
    const rows = S.final.map((f, i) => el("tr", {}, el("td", { className: "medal", textContent: f.winner ? "🏆" : i + 1 }),
      el("td", {}, avatar(f.skin, 30), f.name),       el("td", { className: "num", textContent: f.points })));
    return [el("thead", {}, el("tr", {}, el("th"), el("th", { textContent: "Jogador" }), el("th", { className: "num", textContent: "Pontos" }))), el("tbody", {}, ...rows)];
  });

  // aviso sobre o campo
  let banner = "";
  if (me && S.phase !== "lobby" && S.phase !== "final") {
    if (me.waiting) banner = "Você entra na próxima rodada";
    else if (!me.alive && S.phase === "playing") banner = "Você foi eliminado — assistindo";
  }
  $("banner").textContent = banner;
  $("banner").classList.toggle("hidden", !banner);

  const st = $("shieldTimer");
  const showShield = !!(me && me.alive && me.shield && S.phase === "playing");
  st.classList.toggle("hidden", !showShield);
  if (showShield) { st.textContent = `🛡️ ${me.shield_t}s`; st.classList.toggle("low", me.shield_t <= 5); }
  trackCurses(me);
  if (S.phase !== "playing") $("curseMsg").classList.add("hidden");

  // HUD
  renderOnce($("timeInfo"), [lobby, S.room, S.sudden, S.sd_style, S.time_left], () => {
    if (lobby) return [el("span", { className: "lbl", textContent: S.room })];
    return [S.sudden ? el("span", { className: "sd", textContent: S.sd_style === "rain" ? "CHUVA DE FOGO!" : S.sd_style === "collapse" ? "CHÃO DESABANDO!" : "MORTE SÚBITA!" })
      : el("span", { className: "clock" + (S.time_left <= 10 ? " low" : "") }, el("img", { className: "clock-ico", src: "assets/ui/clock.webp", alt: "" }), fmtClock(S.time_left))];
  });
  renderOnce($("roundInfo"), [lobby, S.rounds, S.round, S.tiebreak], () =>
    [lobby ? el("span", { className: "lbl", textContent: `${S.rounds} rodadas` })
      : el("span", { className: "rnd" + (S.tiebreak ? " tie" : ""), textContent: S.tiebreak ? "DESEMPATE" : `${S.round}/${S.rounds}` })]);

  // mais pontos primeiro (empate: mais vitórias, depois ordem de entrada)
  const ranked = [...S.players].sort((a, b) => b.points - a.points || a.id - b.id);
  renderOnce($("scoreTable"), [ranked.map((p) => [p.id, p.name, p.points, p.alive, p.waiting, p.lives, p.shield, p.curse, p.connected]), isHost], () => {
    const rows = ranked.map((p) => {
      // vidas extras = corações; eliminado = caveira (ícones do tema escuro, assets/ui)
      const tags = [p.waiting ? "⏳" : "", ...Array.from({ length: p.lives || 0 }, () => el("i", { className: "icone-vida" })),
        !p.alive && !p.waiting && !lobby ? el("i", { className: "icone-morto", title: "Eliminado" }) : "",
        p.shield ? "🛡️" : "", p.curse ? "💀" : "", p.connected ? "" : " ✖"];
      const tr = el("tr", { className: (p.alive || lobby ? "" : "dead") + (p.id === myId ? " me" : "") },
        el("td", { title: p.name }, avatar(p.skin, 26), p.name),
        el("td", { className: "num", textContent: p.points }), el("td", {}, ...tags, canKick(p) ? kickBtn(p) : ""));
      return tr;
    });
    return [el("thead", {}, el("tr", {}, el("th", { textContent: "Jogador" }), el("th", { className: "num", textContent: "Pts" }), el("th"))), el("tbody", {}, ...rows)];
  });

  const powIcon = (k, label) => A.items[k]
    ? el("img", { className: "pw-img" + (A.pixelArt ? " px" : ""), src: A.items[k].src, alt: ITEMS[k][2] })
    : el("span", { textContent: ITEMS[k][1] });
  renderOnce($("myPowers"), me && [me.bombs, me.range, me.speed, me.abil, me.pass_on, me.curse, me.curse_t, me.lives, me.shield, me.shield_t], () => {
    if (!me) return [];
    const out = [];
    const up = (k, n) => n > 0 && out.push(el("span", { className: "pw", title: `${ITEMS[k][2]}: ${ITEMS[k][3]}` }, powIcon(k), `+${n}`));
    up("bomb_up", me.bombs - 1);
    up("fire_up", me.range - 2);
    up("speed_up", Math.round((me.speed - 4) / 0.6));
    const count = {};
    for (const a of me.abil) count[a] = (count[a] || 0) + 1;
    for (const [a, n] of Object.entries(count)) {
      const off = a === "bomb_pass" && !me.pass_on; // CTRL liga/desliga; desligado, chutar e socar bombas volta a funcionar
      out.push(el("span", { className: "pw" + (off ? " off" : ""), title: `${ITEMS[a][2]}: ${ITEMS[a][3]}` + (a === "bomb_pass" ? " (CTRL liga/desliga)" : "") },
        powIcon(a), a === "bomb_pass" ? (off ? "OFF" : "ON") : n > 1 ? `×${n}` : ""));
    }
    if (me.lives) out.push(el("span", { className: "pw", title: `${ITEMS.heart[2]}: ${ITEMS.heart[3]}` }, powIcon("heart"), me.lives > 1 ? `×${me.lives}` : ""));
    if (me.shield) out.push(el("span", { className: "pw", title: `${ITEMS.shield[2]}: ${ITEMS.shield[3]}` }, powIcon("shield"), `${me.shield_t}s`));
    if (!out.length && !me.curse) out.push(el("span", { className: "pw none", textContent: "Nenhum poder ativo" }));
    if (me.curse) out.push(el("span", { className: "curse", textContent: `💀 ${CURSE_NAMES[me.curse]} · ${me.curse_t}s`, title: CURSE_INFO[me.curse][1] }));
    return out;
  });
  fitPowers();
}

// a barra tem altura fixa: com muitos poderes/maldição, os ícones e o texto encolhem em vez de a barra crescer (e o mapa pular)
function fitPowers() {
  const box = $("myPowers");
  if (box.dataset.fit === lastKey.myPowers && box.dataset.w === String(box.clientWidth)) return;
  box.dataset.fit = lastKey.myPowers; box.dataset.w = String(box.clientWidth);
  let k = 1;
  box.style.setProperty("--pws", k);
  while (k > 0.45 && box.scrollHeight > box.clientHeight + 1) { k = Math.round((k - 0.05) * 100) / 100; box.style.setProperty("--pws", k); }
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
  const set = A.tileset && A.tileset.themes[A.tileset.maps[S.map]]; // tema de tiles do mapa (assets/tilesets)
  return {
    st: MAP_STYLE[S.map] || MAP_STYLE.classic,
    ts: { floor: m.floor && m.floor.length ? m.floor : d.floor, wall: m.wall || d.wall, block: m.block || d.block, set: set && set.piso_a ? set : null },
  };
}

// enfeite do piso em ~5% das casas, sempre nas mesmas (sorteio fixo pela posição)
const decorated = (x, y) => ((Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0) % 100 < 5;

function drawFloor(st, ts) {
  const set = ts.set;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (set) {
        const img = set.piso_decorado && decorated(x, y) ? set.piso_decorado : (x + y) % 2 ? set.piso_b || set.piso_a : set.piso_a;
        ctx.drawImage(img, x * TILE, y * TILE, TILE, TILE);
        continue;
      }
      if (ts.floor.length) { ctx.drawImage(ts.floor[(x + y) % ts.floor.length], x * TILE, y * TILE, TILE, TILE); continue; }
      ctx.fillStyle = st.floor[(x + y) % 2];
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
}

function drawGrid(grid, st, ts, now) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = grid[y * W + x], px = x * TILE, py = y * TILE;
      if (c === "1" && ts.set) { // borda do mapa = parede; pilares de dentro = inquebravel; no Rio a fileira de pilares do meio é água
        const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        const water = S.map === "river" && !border && y === Math.floor(H / 2) && A.tileset.extra.agua;
        if (water) { drawExtraTile(water, px, py, TILE, TILE, now); continue; }
        const img = border ? ts.set.parede : ts.set.inquebravel;
        if (img) { ctx.drawImage(img, px, py, TILE, TILE); continue; }
      }
      if (c === "2" && ts.set && ts.set.quebravel) { ctx.drawImage(ts.set.quebravel, px, py, TILE, TILE); continue; }
      if (c === "1") {
        if (ts.wall) { ctx.drawImage(ts.wall, px, py, TILE, TILE); continue; }
        const [base, light, dark] = st.wall;
        ctx.fillStyle = base; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = light; ctx.fillRect(px, py, TILE, 5); ctx.fillRect(px, py, 5, TILE);
        ctx.fillStyle = dark; ctx.fillRect(px, py + TILE - 5, TILE, 5); ctx.fillRect(px + TILE - 5, py, 5, TILE);
      } else if (c === "3") { // chão que desabou: buraco escuro
        ctx.fillStyle = "#07060a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,255,255,.04)"; ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
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
    const tile = A.tileset && A.tileset.extra;
    if (tile) { // tiles do tema (assets/tilesets): esteira (gira para a direção), gelo, lava e portal (por cima do piso, com cor diferente por par)
      if (kind === "b" && tile.esteira) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(BELT_ANGLE[extra]);
        drawExtraTile(tile.esteira, -TILE / 2, -TILE / 2, TILE, TILE, now); ctx.restore(); continue;
      }
      if (kind === "i" && tile.escorregadio) { drawExtraTile(tile.escorregadio, x * TILE, y * TILE, TILE, TILE, now); continue; }
      if (kind === "l" && tile.lava) { drawExtraTile(tile.lava, x * TILE, y * TILE, TILE, TILE, now); continue; }
      if (kind === "w" && tile.portal) {
        ctx.filter = `hue-rotate(${[0, 90, 180, 270][extra % 4]}deg)`;
        drawExtraTile(tile.portal, x * TILE, y * TILE, TILE, TILE, now); ctx.filter = "none"; continue;
      }
    }
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
    } else if (kind === "l") { // lava: magma animado com bolhas
      const px = x * TILE, py = y * TILE, k = now / 600 + x * 1.7 + y * 2.3;
      const g = ctx.createLinearGradient(px, py, px, py + TILE);
      g.addColorStop(0, "#ff7a1a"); g.addColorStop(1, "#c4200c");
      ctx.fillStyle = g; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "rgba(255,214,102,.75)";
      for (let i = 0; i < 3; i++) {
        const bx = px + TILE * (0.2 + 0.3 * i), by = py + TILE * (0.25 + 0.5 * ((Math.sin(k + i * 2.1) + 1) / 2)), r = 3 + 2 * Math.sin(k * 1.3 + i);
        ctx.beginPath(); ctx.arc(bx, by, Math.max(1.5, r), 0, 7); ctx.fill();
      }
      ctx.strokeStyle = "#5c0f05"; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
    } else if (kind === "i") { // gelo: azul claro com reflexos
      ctx.fillStyle = "rgba(170,225,255,.5)"; ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x * TILE + 8, y * TILE + 14); ctx.lineTo(x * TILE + 20, y * TILE + 8);
      ctx.moveTo(x * TILE + TILE - 22, y * TILE + TILE - 8); ctx.lineTo(x * TILE + TILE - 10, y * TILE + TILE - 15); ctx.stroke();
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

function drawWarns(warns, now) {
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "20px system-ui, 'Noto Color Emoji'";
  for (const [x, y, kind] of warns) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    const fall = kind === "fall";
    ctx.fillStyle = fall ? `rgba(60,40,30,${0.35 + pulse * 0.35})` : kind === "rock" ? `rgba(255,170,40,${0.2 + pulse * 0.3})` : `rgba(255,50,30,${0.2 + pulse * 0.35})`;
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    ctx.strokeStyle = fall ? "#c9a37a" : kind === "rock" ? "#ffb347" : "#ff4a30"; ctx.lineWidth = 3;
    ctx.strokeRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#fff"; ctx.fillText(fall ? "💥" : kind === "rock" ? "🪨" : "⚠️", (x + 0.5) * TILE, (y + 0.5) * TILE + 1);
  }
}

// A chama some aos poucos (alfa < 1 na maior parte da vida). Desenhar cada casa já semitransparente sobrepõe as peças nos encontros
// e deixa linhas visíveis; por isso as casas de mesmo alfa são desenhadas opacas em uma camada e a camada entra no mapa de uma vez.
let flameLayer = null;
const flameAlpha = (t) => Math.min(1, 0.35 + t * 2);

function drawFlames(flames) {
  if (!A.flameSheet) {
    for (const [x, y, t] of flames) {
      ctx.globalAlpha = flameAlpha(t);
      if (A.flame) ctx.drawImage(A.flame, x * TILE, y * TILE, TILE, TILE);
      else {
        ctx.fillStyle = "#ff8a1f"; ctx.fillRect(x * TILE + 3, y * TILE + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = "#ffe14d"; ctx.fillRect(x * TILE + 12, y * TILE + 12, TILE - 24, TILE - 24);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (!flames.length) return;
  if (!flameLayer || flameLayer.width !== canvas.width || flameLayer.height !== canvas.height) {
    flameLayer = el("canvas", { width: canvas.width, height: canvas.height });
    flameLayer.getContext("2d").imageSmoothingEnabled = false;
  }
  const layer = flameLayer.getContext("2d");
  const flameAt = new Set(flames.map((f) => `${f[0]},${f[1]}`));
  const masks = new Map(flames.map((f) => [`${f[0]},${f[1]}`, f[3] ?? FLAME_ALL]));
  const groups = new Map(); // alfa (arredondado) -> casas
  for (const f of flames) {
    const a = Math.round(flameAlpha(f[2]) * 20) / 20;
    if (!groups.has(a)) groups.set(a, []);
    groups.get(a).push(f);
  }
  for (const [alpha, cells] of groups) {
    cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]); // a ordem importa para o fundido das emendas
    layer.clearRect(0, 0, flameLayer.width, flameLayer.height);
    for (const [x, y, , m = FLAME_ALL] of cells) {
      const part = flamePart(m), list = A.flameSheet.parts[part] || A.flameSheet.parts.center;
      // lados que encostam em outra casa em chamas (as peças se fundem nesses lados)
      const conn = (flameAt.has(`${x - 1},${y}`) ? FLAME_L : 0) | (flameAt.has(`${x + 1},${y}`) ? FLAME_R : 0)
        | (flameAt.has(`${x},${y - 1}`) ? FLAME_U : 0) | (flameAt.has(`${x},${y + 1}`) ? FLAME_D : 0);
      // outra chama ao lado do braço (não na direção dele): as duas se unem em vez de ficarem separadas por um contorno
      const lat = conn & (part === "h" || part === "left" || part === "right" ? FLAME_V : part === "v" || part === "up" || part === "down" ? FLAME_H : 0);
      const beamV = part === "v" || part === "up" || part === "down", beamH = part === "h" || part === "left" || part === "right";
      // braços vizinhos lado a lado: mesma variação ao longo da linha e espelho alternado entre as colunas (ou linhas), para as bordas coincidirem
      const vi = beamV ? y % list.length : beamH ? x % list.length : (x + y) % list.length;
      let flip = lat ? (beamV ? x & 1 : beamH ? (y & 1) << 1 : 0) : 0;
      // duas lâmpadas lado a lado: a da direita é espelhada para encostar com a borda igual à da esquerda
      if (part === "center" && (conn & FLAME_L) && flamePart(masks.get(`${x - 1},${y}`) ?? 0) === "center") flip = 1;
      layer.drawImage(flameCanvas(A.flameSheet, part, vi, conn, lat, flip), x * TILE - FLAME_OV, y * TILE - FLAME_OV);
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(flameLayer, 0, 0);
    ctx.globalAlpha = 1;
  }
}

function drawBombs(bombs, now) {
  for (const [x, y, hop, t, , remote, power, pierce] of bombs) {
    const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE - hop * TILE * 0.9;
    const sheet = (power && A.bombPower) || (pierce && A.bombPierce) || A.bomb; // super bomba e perfurante têm o seu próprio sprite
    // com sprite, a animação são os próprios quadros; sem sprite, a bomba desenhada pulsa
    const r = sheet ? TILE * 0.42 : TILE * 0.36 * (1 + 0.08 * Math.sin(now / (!remote && t < 0.7 ? 40 : 120)));
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.ellipse(cx, (y + 0.5) * TILE + r * 0.7, r * 0.8, r * 0.35, 0, 0, 7); ctx.fill();
    if (pierce && !A.bombPierce) { // sem sprite próprio: espetos desenhados em volta da bomba
      ctx.fillStyle = "#cfd8e8"; ctx.strokeStyle = "#1b2433"; ctx.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI / 4) * k;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.2) * r * 0.95, cy + Math.sin(a - 0.2) * r * 0.95);
        ctx.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7));
        ctx.lineTo(cx + Math.cos(a + 0.2) * r * 0.95, cy + Math.sin(a + 0.2) * r * 0.95);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (power && !A.bombPower) { ctx.strokeStyle = "#ff7a1a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 5 + 2 * Math.sin(now / 120), 0, 7); ctx.stroke(); } // super bomba
    if (sheet) {
      const s = r * 2; // o maior quadro ocupa ~84% do tile; os menores mantêm a proporção, centrados e com a base alinhada
      // quadros em vai-e-vem (0,1,2,1,0,...) como no jogo original, contados desde que a bomba foi solta (1ª bomba: pavio de 2 s);
      // a bomba de controle remoto não tem pavio, então usa o relógio da tela
      const n = sheet.rects.length, cycle = n > 1 ? 2 * n - 2 : 1, el_ = remote ? now / 1000 : Math.max(0, BOMB_FUSE - t);
      const k0 = Math.floor(el_ * sheet.fps) % cycle, q = sheet.rects[k0 < n ? k0 : cycle - k0];
      const k = s / sheet.maxDim, dw = q.sw * k, dh = q.sh * k;
      ctx.drawImage(sheet.img, q.sx, q.sy, q.sw, q.sh, cx - dw / 2, cy + r - dh, dw, dh);
      if (remote) { ctx.strokeStyle = "#4aa8ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, 7); ctx.stroke(); } // bomba do controle remoto
      continue;
    }
    ctx.fillStyle = remote ? "#12304f" : "#111"; ctx.beginPath(); ctx.arc(cx, cy + 2, r, 0, 7); ctx.fill();
    ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(cx - r / 3, cy - r / 3, r / 4, 0, 7); ctx.fill();
    if (remote) { ctx.strokeStyle = "#4aa8ff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy + 2, r + 2, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = "#c9a227"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy - r + 2); ctx.lineTo(cx + 6, cy - r - 6); ctx.stroke();
    ctx.fillStyle = !remote && t < 0.7 ? "#fff" : "#ff5a1f";
    ctx.beginPath(); ctx.arc(cx + 6, cy - r - 6, 3, 0, 7); ctx.fill();
  }
}

function drawDeath(v, now) {
  const f = Math.floor(((now - v.deadAt) / 1000) * A.death.fps);
  if (f >= A.death.n) { v.deadAt = undefined; return; }
  const w = TILE * A.death.scale, h = (w * A.death.img.height) / A.death.fw;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(A.death.img, f * A.death.fw, 0, A.death.fw, A.death.img.height, v.x * TILE - w / 2, (v.y + 0.5) * TILE - h, w, h); // base da animação nos pés
  ctx.imageSmoothingEnabled = !A.pixelArt;
}

function drawPlayers(players, dt, now) {
  const k = 1 - Math.exp(-dt * 25);
  for (const p of players) {
    const v = vis[p.id] || (vis[p.id] = { x: p.x, y: p.y });
    if (Math.hypot(p.x - v.x, p.y - v.y) > 1.5) { v.x = p.x; v.y = p.y; }
    const moving = Math.hypot(p.x - v.x, p.y - v.y) > 0.01;
    v.x += (p.x - v.x) * k;
    v.y += (p.y - v.y) * k;
    if (!p.alive) {
      if (v.wasAlive && A.death) v.deadAt = now;
      v.wasAlive = false;
      if (v.deadAt !== undefined) drawDeath(v, now);
      continue;
    }
    v.wasAlive = true; v.deadAt = undefined;
    const cx = v.x * TILE, cy = v.y * TILE;
    if (p.invuln && Math.floor(now / 90) % 2) continue; // pisca ao tomar dano
    if (p.shield) {
      ctx.strokeStyle = "rgba(90,190,255,.9)"; ctx.lineWidth = 3; ctx.fillStyle = "rgba(90,190,255,.18)";
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.55, 0, 7); ctx.fill(); ctx.stroke();
    }
    drawCharacter(ctx, skinOf(p.skin), p.face, cx, cy, TILE, moving, now);
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.font = "bold 11px system-ui"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.fillStyle = "#fff";
    ctx.strokeText(p.name, cx, cy - TILE * 0.62); ctx.fillText(p.name, cx, cy - TILE * 0.62);
    if (p.curse) { ctx.font = "18px system-ui, 'Noto Color Emoji'"; ctx.fillText("💀", cx + TILE * 0.35, cy - TILE * 0.35); }
  }
}

// foco no seu personagem só no começo da rodada (contagem + primeiro segundo)
function drawFocus(now) {
  const early = S.phase === "countdown" && !S.intro && S.countdown <= 2; // só os últimos 2 s da contagem
  const me = S.players.find((p) => p.id === myId);
  const v = vis[myId];
  if (!early || !me || !me.alive || !v) return;
  const cx = v.x * TILE, cy = v.y * TILE, pulse = 0.5 + 0.5 * Math.sin(now / 160);
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.5)"; // escurece o resto do campo, deixando uma clareira em volta de você
  const R = TILE * 1.7;
  ctx.beginPath(); ctx.rect(0, 0, W * TILE, H * TILE);
  ctx.moveTo(cx + R, cy); // sem o moveTo o canvas liga o retângulo ao círculo e abre uma cunha clara no campo
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.closePath(); ctx.fill("evenodd");
  ctx.strokeStyle = "#f5b82e"; ctx.lineWidth = 4; ctx.shadowColor = "#f5b82e"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(cx, cy, TILE * (0.78 + 0.1 * pulse), 0, 7); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = "#f5b82e"; ctx.strokeStyle = "#3b1f0c"; ctx.lineWidth = 3;
  const ay = cy - TILE * (1.05 + 0.12 * pulse);
  ctx.beginPath(); ctx.moveTo(cx, ay + 12); ctx.lineTo(cx - 10, ay - 4); ctx.lineTo(cx + 10, ay - 4); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.strokeText("Você", cx, ay - 6); ctx.fillStyle = "#fff"; ctx.fillText("Você", cx, ay - 6);
  ctx.restore();
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (screen === "game" && S) {
    const { st, ts } = currentStyle();
    ctx.imageSmoothingEnabled = !A.pixelArt; // drawCharacter muda isso por skin; sem voltar, powerups e bomba saíam borrados
    drawFloor(st, ts);
    drawSpecials(S.specials || [], now);
    drawGrid(S.grid, st, ts, now);
    drawItems(S.items, now);
    drawFlames(S.flames);
    drawWarns(S.warn || [], now);
    drawBombs(S.bombs, now);
    drawPlayers(S.players, dt, now);
    drawFocus(now);
  }
  requestAnimationFrame(frame);
}

// ---------- ligação dos botões ----------
function init() {
  try { $("playerName").value = localStorage.getItem("ctib-name") || ""; } catch { /* ignore */ }
  try { // número = skin do tema; texto = skin enviada (conferida quando chega a lista do servidor)
    const saved = JSON.parse(localStorage.getItem("ctib-skin") || "0");
    mySkin = isCustom(saved) ? saved : Math.max(0, Math.min(SKINS.length - 1, parseInt(saved, 10) || 0));
  } catch { mySkin = 0; }
  buildSkinGrid();
  renderHistory();
  sizeCanvas();

  $("btnSkin").onclick = () => { buildSkinGrid(); show("skin"); };
  const toggleRanking = (open) => $("rankPanel").classList.toggle("hidden", open === undefined ? !$("rankPanel").classList.contains("hidden") : !open);
  $("btnRanking").onclick = () => toggleRanking();
  $("rankClose").onclick = () => toggleRanking(false);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && screen === "title") toggleRanking(false); });
  $("upFile").onchange = async () => {
    const f = $("upFile").files[0];
    upload = null;
    if (f) {
      try { upload = await prepareImage(f); } catch { toast("Não consegui abrir essa imagem."); }
      if (upload && !$("upName").value.trim()) $("upName").value = f.name.replace(/\.[^.]+$/, "").slice(0, 16);
    }
  };
  $("upCancel").onclick = closeUpload;
  $("upSend").onclick = () => {
    const owner = $("playerName").value.trim();
    if (!owner) { toast("Digite seu nome acima antes de enviar uma skin."); return; }
    if (!upload) { toast("Escolha uma imagem primeiro."); return; }
    if (upload.url.length > 690000) { toast("Imagem grande demais (máximo 512 KB)."); return; }
    if (!ws || ws.readyState !== WebSocket.OPEN) { toast("Sem conexão com o servidor. Aguarde reconectar e tente de novo."); return; }
    $("upSend").disabled = true;
    send({ t: "skin_add", owner, name: $("upName").value.trim(), data: upload.url });
    setTimeout(() => { if ($("upSend").disabled) { $("upSend").disabled = false; toast("O servidor não respondeu. Tente de novo."); } }, 10000);
  };
  $("skinBack").onclick = () => {
    closeUpload();
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
    send({ t: "create", single: true, bots: f.bots.value, map: f.map.value, rounds: f.rounds.value, time: f.time.value, events: f.events.value, sd_var: f.sd_var.value, ...p });
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
    send({ t: "create", room: f.room.value, map: f.map.value, rounds: f.rounds.value, time: f.time.value, events: f.events.value, sd_var: f.sd_var.value, ...p });
    $("createForm").classList.add("hidden"); $("createConfirm").classList.add("hidden"); $("btnCreate").classList.remove("hidden");
  };
  $("playerName").onkeydown = (e) => { if (e.key === "Enter") $("skinBack").click(); }; // o nome fica em Personagens: Enter confirma e volta ao menu
  $("playerName").oninput = () => { try { localStorage.setItem("ctib-name", $("playerName").value.trim()); } catch { /* ignore */ } };
  $("addBotBtn").onclick = () => send({ t: "addbot" });
  $("rmBotBtn").onclick = () => send({ t: "rmbot" });
  $("chatForm").onsubmit = (e) => {
    e.preventDefault();
    const inp = $("chatInput"), text = inp.value.trim();
    if (text) send({ t: "chat", text });
    inp.value = "";
  };
  $("chatInput").onfocus = () => { held.length = 0; sendDir(); }; // largar as setas ao começar a digitar
  $("chatInput").onkeydown = (e) => { if (e.key === "Escape") e.target.blur(); };
  $("rematchBtn").onclick = $("readyBtn").onclick = () => {
    const me = S && S.players.find((p) => p.id === myId);
    if (me) send({ t: "ready", v: !me.ready });
  };
  $("leaveBtn").onclick = $("leaveBtn2").onclick = $("finalLeaveBtn").onclick = () => send({ t: "leave" });
  show("title");
}

loadTheme().finally(() => {
  init();
  connect();
  requestAnimationFrame(frame);
});
