"""Mapas do CTI Bombers.

Cada mapa é uma regra (x, y, w, h) -> caractere:
  '#' parede indestrutível, '.' bloco destrutível sorteado, 'o' bloco destrutível fixo, '_' chão livre,
  'w' portal (o par fica na posição espelhada do mapa), '>' '<' 'v' '^' esteira (empurra para essa direção).
Portais e esteiras são chão livre: nunca recebem bloco.
A borda é sempre parede. Os 6 pontos de partida são os mesmos em todos os mapas (veja spawn_points).
"""
import random
from collections import deque

EMPTY, WALL, BLOCK = 0, 1, 2
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
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


MAPS = {
    "classic": dict(name="Clássico", w=15, h=13, rule=_classic, density=0.75),
    "arena": dict(name="Arena Aberta", w=15, h=13, rule=_arena, density=0.55),
    "cross": dict(name="Quadrantes", w=15, h=13, rule=_cross, density=0.75),
    "factory": dict(name="Fábrica", w=15, h=13, rule=_factory, density=0.7),
    "diamond": dict(name="Diamante", w=15, h=13, rule=_diamond, density=0.7),
    "volcano": dict(name="Vulcão", w=15, h=13, rule=_volcano, density=0.7),
    "big": dict(name="Campo Grande", w=19, h=15, rule=_classic, density=0.7),
    "portals": dict(name="Portais", w=15, h=13, rule=_portals, density=0.7),
    "belt": dict(name="Esteira", w=15, h=13, rule=_belt, density=0.7),
    "maze": dict(name="Labirinto", w=15, h=13, rule=_maze, density=0.6),
    "towers": dict(name="Torres", w=15, h=13, rule=_towers, density=0.7),
    "fortress": dict(name="Fortaleza", w=15, h=13, rule=_fortress, density=0.7),
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
            elif c == "w":
                partner = (w - 1 - x, h - 1 - y)
                pid = pairs.setdefault(min((x, y), partner), len(pairs))
                out[(x, y)] = ("w", partner, pid)
    return out


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
    return grid


def _validate():
    """Garante que os spawns não são parede e que todos se alcançam sem passar por paredes."""
    for mid, m in MAPS.items():
        w, h = m["w"], m["h"]
        spawns = spawn_points(w, h)
        for sx, sy in spawns:
            assert _cell(m, sx, sy) != "#", f"mapa {mid}: spawn {(sx, sy)} é parede"
        seen, q = {spawns[0]}, deque([spawns[0]])
        while q:
            x, y = q.popleft()
            for dx, dy in DIRS:
                n = (x + dx, y + dy)
                if n not in seen and _cell(m, *n) != "#":
                    seen.add(n)
                    q.append(n)
        assert all(s in seen for s in spawns), f"mapa {mid}: spawns isolados"
        for (x, y), sp in build_specials(mid).items():
            if sp[0] == "w":
                assert sp[1] != (x, y) and _cell(m, *sp[1]) == "w", f"mapa {mid}: portal {(x, y)} sem par"


_validate()
