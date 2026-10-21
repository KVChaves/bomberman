"""Mapas do CTI Bombers.

Cada mapa é uma regra (x, y, w, h) -> caractere:
  '#' parede indestrutível, '.' bloco destrutível sorteado, 'o' bloco destrutível fixo, '_' chão livre,
  'i' gelo (piso sem bloco), 'L' lava (piso sem bloco: quem pisa sem colete perde uma vida ou morre; bombas passam por cima),
  'w' portal (o par fica na posição espelhada do mapa), '>' '<' 'v' '^' esteira (empurra para essa direção).
Portais e esteiras são chão livre: nunca recebem bloco.
A borda é sempre parede. Os 6 pontos de partida são os mesmos em todos os mapas (veja spawn_points).
"""
import random
from collections import deque

EMPTY, WALL, BLOCK = 0, 1, 2
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
FLOORS = {"i", "L"}  # pisos especiais sem bloco: gelo (desliza) e lava (queima)
SPECIAL_DIRS = {">": (1, 0), "<": (-1, 0), "v": (0, 1), "^": (0, -1)}


def _classic(x, y, w, h):
    return "#" if x % 2 == 0 and y % 2 == 0 else "."


def _arena(x, y, w, h):
    cx, cy = w // 2, h // 2
    if (x in (3, w - 4) and y in (3, h - 4)) or (x, y) == (cx, cy):
        return "#"
    if abs(x - cx) == 2 and abs(y - cy) <= 1:
        return "o"
    return "."


def _cross(x, y, w, h):
    cx, cy = w // 2, h // 2
    if x == cx and 3 <= y <= h - 4 and abs(y - cy) >= 2:
        return "#"
    if y == cy and 2 <= x <= w - 3 and abs(x - cx) >= 2:
        return "#"
    if x in (3, w - 4) and y in (3, h - 4):
        return "#"
    return "."


def _factory(x, y, w, h):
    cy = h // 2
    if x in (3, w // 2, w - 4) and 2 <= y <= h - 3 and y not in (cy - 2, cy, cy + 2):
        return "#"
    return "."


def _diamond(x, y, w, h):
    dx, dy = abs(x - w // 2), abs(y - h // 2)
    if dx + dy == 4 and dx and dy:
        return "#"
    if dx + dy == 2:
        return "o"
    if x % 2 == 0 and y % 2 == 0 and dx + dy >= 9:
        return "#"
    return "."


def _volcano(x, y, w, h):
    dx, dy = abs(x - w // 2), abs(y - h // 2)
    if dx <= 1 and dy <= 1:
        return "#"
    if max(dx, dy) == 2:
        return "o"
    if x % 2 == 0 and y % 2 == 0:
        return "#"
    return "."


# ---------- fases com mecânicas especiais ----------
_PORTALS = {(3, 3), (11, 9), (11, 3), (3, 9), (5, 6), (9, 6)}  # 3 pares, espelhados pelo centro


def _portals(x, y, w, h):
    return "w" if (x, y) in _PORTALS else _classic(x, y, w, h)


def _belt(x, y, w, h):
    """Circuito de esteiras no sentido horário em volta do centro."""
    if y == 3 and 3 <= x <= 10:
        return ">"
    if x == 11 and 3 <= y <= 8:
        return "v"
    if y == 9 and 4 <= x <= 11:
        return "<"
    if x == 3 and 4 <= y <= 9:
        return "^"
    return _classic(x, y, w, h)


def _maze(x, y, w, h):
    if y in (2, 6, 10) and 3 <= x <= w - 4:
        return "#"
    if y in (4, 8) and (x <= 5 or x >= w - 6):
        return "#"
    return "."


def _towers(x, y, w, h):
    if x in (3, 4, w - 5, w - 4) and y in (3, 4, h - 5, h - 4):
        return "#"
    if y == h // 2 and abs(x - w // 2) <= 1:
        return "#"
    return "."


def _fortress(x, y, w, h):
    cx, cy = w // 2, h // 2
    dx, dy = x - cx, y - cy
    if abs(dx) == 2 and abs(dy) <= 2 and dy != 0:
        return "#"
    if abs(dy) == 2 and abs(dx) <= 2 and dx != 0:
        return "#"
    if abs(dx) <= 1 and abs(dy) <= 1:
        return "_" if (dx, dy) == (0, 0) else "o"
    if abs(dx) > 2 or abs(dy) > 2:
        return _classic(x, y, w, h) if not (abs(dx) <= 2 and abs(dy) <= 2) else "."
    return "."


def _columns(x, y, w, h):
    return "#" if x in (3, 7, 11) and y in (3, 5, 7, 9) else "."


def _rings(x, y, w, h):
    dx, dy = x - w // 2, y - h // 2
    if max(abs(dx), abs(dy)) == 3 and dx and dy:
        return "#"
    if (dx, dy) == (0, 0):
        return "_"
    if max(abs(dx), abs(dy)) == 1:
        return "o"
    return "."


def _grid3(x, y, w, h):
    return "#" if x % 3 == 0 and y % 3 == 0 else "."


def _converge(x, y, w, h):
    cx, cy = w // 2, h // 2
    if y == cy and 2 <= x < cx - 1:
        return ">"
    if y == cy and cx + 1 < x <= w - 3:
        return "<"
    if x == cx and 2 <= y < cy - 1:
        return "v"
    if x == cx and cy + 1 < y <= h - 3:
        return "^"
    return _classic(x, y, w, h) if (x, y) != (cx, cy) else "_"


_TELEPORT = {(3, 5), (11, 7), (11, 5), (3, 7), (7, 3), (7, 9)}


def _teleport(x, y, w, h):
    return "w" if (x, y) in _TELEPORT else "."


def _river(x, y, w, h):
    return "#" if y == h // 2 and x not in (3, 7, 11) else "."


def _ice(x, y, w, h):
    if x % 2 == 0 and y % 2 == 0:
        return "#"
    return "i" if 3 <= x <= w - 4 and 3 <= y <= h - 4 else "."


def _open(x, y, w, h):
    return "."


_LAVA_FIELD = {(3, 2), (4, 2), (10, 2), (11, 2), (6, 4), (8, 4), (2, 5), (3, 5), (11, 5), (12, 5), (7, 6), (6, 6), (8, 6),
               (2, 7), (3, 7), (11, 7), (12, 7), (6, 8), (8, 8), (3, 10), (4, 10), (10, 10), (11, 10)}


def _lava_field(x, y, w, h):
    """Sem pilares: só lava e blocos quebráveis. Cada explosão abre caminho (ou fecha a vista) pelo campo inteiro."""
    return "L" if (x, y) in _LAVA_FIELD else "."


def _walls(x, y, w, h):
    """Dois anéis de parede, um dentro do outro, com as passagens em lugares opostos: dá para entrar, mas não em linha reta."""
    cx, cy = w // 2, h // 2
    d = min(x, y, w - 1 - x, h - 1 - y)
    if d == 2:  # anel de fora: passagens no meio dos lados
        return "." if x == cx or y == cy else "#"
    if d == 4:  # anel de dentro: passagens fora do centro dos lados de cima e de baixo (em quina, ninguém passaria)
        return "." if (x in (5, w - 6) and y in (4, h - 5)) else "#"
    return "o" if (x, y) == (cx, cy) else "."


def _ice_stripes(x, y, w, h):
    """Duas faixas de gelo horizontais, sem pilares nelas: o jogador desliza de um lado ao outro."""
    if y in (3, 4, 8, 9) and 1 <= x <= w - 2:
        return "i"
    return _classic(x, y, w, h)


def _chambers(x, y, w, h):
    """Quatro câmaras separadas por paredes, ligadas por portas; blocos fixos protegem as portas."""
    cx, cy = w // 2, h // 2
    if x == cx and 2 <= y <= h - 3:
        return "." if y in (4, h - 5) else "#"
    if y == cy and 1 <= x <= w - 2:
        return "." if x in (3, w - 4) else "#"
    if (x, y) in ((cx, 4), (cx, h - 5), (3, cy), (w - 4, cy)):
        return "."
    if abs(x - cx) == 1 and y in (4, h - 5) or abs(y - cy) == 1 and x in (3, w - 4):
        return "o"
    return "."


def _belts_parallel(x, y, w, h):
    """Esteiras em linhas alternadas: duas empurram para a direita e duas para a esquerda."""
    if y in (3, 7) and 2 <= x <= w - 3:
        return ">"
    if y in (5, 9) and 2 <= x <= w - 3:
        return "<"
    return _classic(x, y, w, h)


_BASTION = {(x + dx, y + dy) for x, y in ((3, 3), (10, 3), (3, 8), (10, 8)) for dx in (0, 1) for dy in (0, 1)}


def _bastions(x, y, w, h):
    """Quatro bastiões 2x2 e uma cruz de blocos fixos no centro; o resto é campo aberto."""
    cx, cy = w // 2, h // 2
    if (x, y) in _BASTION:
        return "#"
    if (abs(x - cx) <= 2 and y == cy) or (abs(y - cy) <= 2 and x == cx):
        return "o"
    return "."


MAPS = {
    "classic": dict(name="Clássico", w=15, h=13, rule=_classic, density=0.75),
    "arena": dict(name="Arena Aberta", w=15, h=13, rule=_arena, density=0.55),
    "cross": dict(name="Quadrantes", w=15, h=13, rule=_cross, density=0.75),
    "factory": dict(name="Fábrica", w=15, h=13, rule=_factory, density=0.7),
    "diamond": dict(name="Diamante", w=15, h=13, rule=_diamond, density=0.7),
    "volcano": dict(name="Vulcão", w=15, h=13, rule=_volcano, density=0.7),
    "big": dict(name="Campo Grande", w=15, h=13, rule=_classic, density=0.7),
    "portals": dict(name="Portais", w=15, h=13, rule=_portals, density=0.7),
    "belt": dict(name="Esteira", w=15, h=13, rule=_belt, density=0.7),
    "maze": dict(name="Labirinto", w=15, h=13, rule=_maze, density=0.6),
    "towers": dict(name="Torres", w=15, h=13, rule=_towers, density=0.7),
    "fortress": dict(name="Fortaleza", w=15, h=13, rule=_fortress, density=0.7),
    "columns": dict(name="Colunas", w=15, h=13, rule=_columns, density=0.7),
    "rings": dict(name="Anéis", w=15, h=13, rule=_rings, density=0.7),
    "grid3": dict(name="Pátio", w=15, h=13, rule=_grid3, density=0.7),
    "converge": dict(name="Convergência", w=15, h=13, rule=_converge, density=0.7),
    "teleport": dict(name="Teletransporte", w=15, h=13, rule=_teleport, density=0.65),
    "river": dict(name="Rio", w=15, h=13, rule=_river, density=0.7),
    "ice": dict(name="Pista de Gelo", w=15, h=13, rule=_ice, density=0.7),
    "open": dict(name="Campo Livre", w=15, h=13, rule=_open, density=0.45),
    "walls": dict(name="Muralhas", w=15, h=13, rule=_walls, density=0.7),
    "ice_stripes": dict(name="Faixas de Gelo", w=15, h=13, rule=_ice_stripes, density=0.7),
    "chambers": dict(name="Câmaras", w=15, h=13, rule=_chambers, density=0.75),
    "belts_parallel": dict(name="Esteiras Paralelas", w=15, h=13, rule=_belts_parallel, density=0.7),
    "bastions": dict(name="Bastiões", w=15, h=13, rule=_bastions, density=0.65),
    "lava": dict(name="Campo de Lava", w=15, h=13, rule=_lava_field, density=0.8),
}
ORDER = list(MAPS)


def spawn_points(w, h):
    """Ordem: cantos opostos primeiro (2 jogadores ficam longe um do outro), depois meio."""
    return [(1, 1), (w - 2, h - 2), (w - 2, 1), (1, h - 2), (w // 2, 1), (w // 2, h - 2)]


def _cell(m, x, y):
    w, h = m["w"], m["h"]
    if x in (0, w - 1) or y in (0, h - 1):
        return "#"
    return m["rule"](x, y, w, h)


def build_specials(map_id):
    """Casas especiais: {(x, y): ("b", (dx, dy))} esteira, {(x, y): ("w", (px, py), par)} portal."""
    m = MAPS[map_id]
    w, h = m["w"], m["h"]
    out, pairs = {}, {}
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = _cell(m, x, y)
            if c in SPECIAL_DIRS:
                out[(x, y)] = ("b", SPECIAL_DIRS[c])
            elif c in FLOORS:
                out[(x, y)] = (c.lower(),)
            elif c == "w":
                partner = (w - 1 - x, h - 1 - y)
                pid = pairs.setdefault(min((x, y), partner), len(pairs))
                out[(x, y)] = ("w", partner, pid)
    return out


def river_cells(map_id, grid):
    """Casas de água do mapa Rio (fileira do meio, fora da borda): são WALL para quem anda, mas o fogo as atravessa."""
    if map_id != "river":
        return set()
    h, w = len(grid), len(grid[0])
    return {(x, h // 2) for x in range(1, w - 1) if grid[h // 2][x] == WALL}


def build_grid(map_id):
    m = MAPS[map_id]
    w, h = m["w"], m["h"]
    safe = set()
    for sx, sy in spawn_points(w, h):
        safe.add((sx, sy))
        safe.update((sx + dx, sy + dy) for dx, dy in DIRS)
    grid = [[EMPTY] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            c = _cell(m, x, y)
            if c == "#":
                grid[y][x] = WALL
            elif (x, y) in safe:
                continue
            elif c == "o" or (c == "." and random.random() < m["density"]):
                grid[y][x] = BLOCK
    for y in range(1, h - 1):  # portal nunca fica cercado de blocos: o jogador que cai nele ficaria preso
        for x in range(1, w - 1):
            if _cell(m, x, y) == "w":
                for dx, dy in DIRS:
                    if grid[y + dy][x + dx] == BLOCK:
                        grid[y + dy][x + dx] = EMPTY
    for sx, sy in spawn_points(w, h):
        _open_escape(m, grid, (sx, sy))
    return grid


ESCAPE_RANGE, ESCAPE_STEPS = 2, 6  # alcance da primeira bomba e quantas casas dá para andar antes dela explodir


def _open_escape(m, grid, spawn):
    """Garante que, soltando uma bomba no ponto de partida, o jogador consegue sair da linha de fogo a pé.
    Se não conseguir, derruba o bloco mais próximo da rota até existir uma saída."""
    w, h = m["w"], m["h"]

    def reach(through_blocks):
        seen, q = {spawn: 0}, deque([spawn])
        while q:
            x, y = q.popleft()
            if seen[(x, y)] >= ESCAPE_STEPS + (3 if through_blocks else 0):
                continue
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n in seen or not (0 < n[0] < w - 1 and 0 < n[1] < h - 1) or grid[n[1]][n[0]] == WALL or _cell(m, *n) == "L":
                    continue
                if grid[n[1]][n[0]] == BLOCK and not through_blocks:
                    continue
                seen[n] = seen[(x, y)] + 1
                q.append(n)
        return seen

    def blast():
        cells = {spawn}
        for dx, dy in DIRS:
            for i in range(1, ESCAPE_RANGE + 1):
                x, y = spawn[0] + dx * i, spawn[1] + dy * i
                if grid[y][x] == WALL:
                    break
                cells.add((x, y))
                if grid[y][x] == BLOCK:
                    break
        return cells

    for _ in range(12):
        free = reach(False)
        if any(c not in blast() for c in free if free[c] <= ESCAPE_STEPS):
            return
        # sem saída: abre o bloco mais próximo (olhando também através de blocos)
        near = reach(True)
        blocks = sorted((d, c) for c, d in near.items() if grid[c[1]][c[0]] == BLOCK)
        if not blocks:
            return
        x, y = blocks[0][1]
        grid[y][x] = EMPTY


def _validate():
    """Garante que os spawns não são parede e que todos se alcançam sem passar por paredes."""
    for mid, m in MAPS.items():
        w, h = m["w"], m["h"]
        spawns = spawn_points(w, h)
        for sx, sy in spawns:
            assert _cell(m, sx, sy) not in "#L", f"mapa {mid}: spawn {(sx, sy)} é parede ou lava"
        seen, q = {spawns[0]}, deque([spawns[0]])
        while q:  # sem pisar em lava: quem não tem colete precisa conseguir chegar a todos os pontos
            x, y = q.popleft()
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in seen and _cell(m, *n) not in "#L":
                    seen.add(n)
                    q.append(n)
        assert all(s in seen for s in spawns), f"mapa {mid}: spawns isolados"
        for (x, y), sp in build_specials(mid).items():
            if sp[0] == "w":
                assert sp[1] != (x, y) and _cell(m, *sp[1]) == "w", f"mapa {mid}: portal {(x, y)} sem par"


_validate()
