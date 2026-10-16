"""IA simples dos bots (singleplayer): foge do perigo, caça blocos/inimigos, pega itens."""
import random
from collections import deque

from maps import BLOCK, EMPTY, WALL

TICK = 1 / 30
THINK_EVERY = 2  # ticks entre decisões
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def _passable(room, c, start):
    x, y = c
    return room.grid[y][x] == EMPTY and (c == start or c not in room.bomb_at)


def _bfs(room, start, goal, avoid, max_depth):
    """Menor caminho de start até uma célula que satisfaz goal (sem contar start)."""
    prev = {start: None}
    depth = {start: 0}
    q = deque([start])
    while q:
        c = q.popleft()
        if c != start and goal(c):
            path = [c]
            while prev[path[-1]] is not None:
                path.append(prev[path[-1]])
            return path[::-1]
        if depth[c] >= max_depth:
            continue
        for dx, dy in DIRS:
            n = (c[0] + dx, c[1] + dy)
            if n in prev or not _passable(room, n, start) or (avoid and n in avoid):
                continue
            prev[n] = c
            depth[n] = depth[c] + 1
            q.append(n)
    return None


def _useful(room, p, c, enemies):
    """Uma bomba em c acertaria um bloco ou um inimigo?"""
    if c in enemies:
        return True
    for dx, dy in DIRS:
        for i in range(1, p.range + 1):
            x, y = c[0] + dx * i, c[1] + dy * i
            t = room.grid[y][x]
            if t == WALL:
                break
            if t == BLOCK or (x, y) in enemies:
                return True
            if (x, y) in room.bomb_at:
                break
    return False


def _fire(danger):
    """Células em chamas ou prestes a explodir: nunca atravessar."""
    return {c for c, t in danger.items() if t < 0.5}


def _safe_after(room, p, c, danger):
    rng = 1 if p.curse == "short" else p.range
    nd = set(danger)
    nd.update(room.blast(c[0], c[1], rng)[0])
    path = _bfs(room, c, lambda n: n not in nd, _fire(danger), 8)
    return path is not None and len(path) - 1 <= 5 + int(p.speed - 4)


def _go(p, start, path):
    if not path or len(path) < 2:
        p.dx = p.dy = 0
        return
    nx, ny = path[1]
    tx, ty = start
    if nx != tx:  # alinha na pista antes de andar na horizontal
        off = ty + 0.5 - p.y
        p.dx, p.dy = (0, (1 if off > 0 else -1)) if abs(off) > 0.15 else ((1 if nx > tx else -1), 0)
    else:
        off = tx + 0.5 - p.x
        p.dx, p.dy = ((1 if off > 0 else -1), 0) if abs(off) > 0.15 else (0, (1 if ny > ty else -1))


def think(room, p):
    p.bot_t -= 1
    if p.bot_t > 0:
        return
    p.bot_t = THINK_EVERY
    p.bot_cd = max(0.0, p.bot_cd - THINK_EVERY * TICK)
    start = (int(p.x), int(p.y))
    danger = room.danger()

    if start in danger:  # foge
        fire = _fire(danger)
        path = (_bfs(room, start, lambda c: c not in danger, fire, 12)
                or _bfs(room, start, lambda c: c not in fire, fire, 12))
        _go(p, start, path)
        return

    enemies = {(int(q.x), int(q.y)) for q in room.players.values() if q.alive and q is not p}
    owned = sum(1 for b in room.bombs if b.owner == p.id)
    can_bomb = (p.curse != "constipation" and owned < p.max_bombs and p.bot_cd <= 0
                and start not in room.bomb_at)

    if can_bomb and _useful(room, p, start, enemies) and _safe_after(room, p, start, danger):
        p.want_bomb = True
        p.bot_cd = 0.6
        p.dx = p.dy = 0
        return

    def goal(c):
        return c in room.items or (can_bomb and _useful(room, p, c, enemies))

    path = _bfs(room, start, goal, danger, 30)
    if path is None and random.random() < 0.1:  # sem nada a fazer: dá uma voltinha
        p.dx, p.dy = random.choice(DIRS)
        return
    _go(p, start, path)
