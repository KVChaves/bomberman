"""Lógica de uma sala: partida em rodadas, jogadores, bombas, powerups, morte súbita e pontos."""
import math
import random

import bots
from maps import BLOCK, EMPTY, MAPS, ORDER, WALL, build_grid, build_specials, spawn_points

TICK = 1 / 30
MAX_PLAYERS = 6

BOMB_FUSE = 2.0
REMOTE_SAFETY = 8.0  # bomba remota explode sozinha depois disso
FLAME_TIME = 0.5
HALF = 0.4  # meia largura da hitbox, em tiles
BASE_SPEED, SPEED_STEP, MAX_SPEED = 4.0, 0.6, 7.5
MAX_BOMBS, MAX_RANGE = 8, 10
ITEM_CHANCE = 0.4
KICK_SPEED = 8.0  # tiles/s
BELT_SPEED = 2.0  # tiles/s: velocidade da esteira (jogadores e bombas)
THROW_DIST = 3
FLIGHT_TIME = 0.4
INVULN_TIME, CURSE_TIME = 2.0, 10.0
MAX_LIVES = 3
SD_DELAY, SD_INTERVAL = 1.0, 0.2  # morte súbita
PASS_COOLDOWN = 1.5  # depois de receber a caveira, não dá para devolvê-la logo

COUNTDOWN, ROUND_OVER_TIME, FINAL_TIME = 3, 4, 10

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
FACE = {"u": (0, -1), "d": (0, 1), "l": (-1, 0), "r": (1, 0)}

ITEM_WEIGHTS = {
    "bomb_up": 14, "fire_up": 14, "speed_up": 10, "full_fire": 2, "remote": 4,
    "bomb_pass": 3, "wall_pass": 3, "kick": 5, "glove": 4, "punch": 4,
    "shield": 3, "heart": 3, "skull": 6, "line_bomb": 3, "power_bomb": 3,
}
ITEM_KINDS = list(ITEM_WEIGHTS)
CURSES = ["slow", "fast", "diarrhea", "constipation", "reverse", "short"]


class Player:
    def __init__(self, pid, name, skin, client=None, bot=False):
        self.id = pid
        self.name = name
        self.skin = skin
        self.client = client
        self.bot = bot
        self.ready = bot
        self.connected = True
        self.waiting = False  # entrou no meio da partida: joga a partir da próxima rodada
        self.in_round = False
        self.played = 0  # rodadas disputadas na partida atual
        self.match_win = False
        self.wins = 0
        self.points = 0
        self.bot_t = 0
        self.bot_cd = 0.0
        self.reset()

    def reset(self):
        self.alive = True
        self.x = self.y = 1.5
        self.dx = self.dy = 0
        self.face = "d"
        self.max_bombs, self.range, self.speed = 1, 2, BASE_SPEED
        self.remote = self.bomb_pass = self.wall_pass = False
        self.kick = self.glove = self.punch = self.line_bomb = False
        self.power_bombs = 0
        self.lives = 0
        self.shield = False  # colete: absorve uma explosão e quebra (não expira por tempo)
        self.invuln_t = 0.0
        self.curse, self.curse_t, self.auto_t, self.pass_cd = "", 0.0, 0.0, 0.0
        self.warp_armed = True  # portal só teleporta de novo depois que você sai dele
        self.want_bomb = self.want_det = False

    def abilities(self):
        return [k for k in ("remote", "bomb_pass", "wall_pass", "kick", "glove", "punch", "line_bomb")
                if getattr(self, k)] + ["power_bomb"] * self.power_bombs


class Bomb:
    def __init__(self, x, y, owner, rng, passers, remote):
        self.x, self.y = x, y
        self.owner = owner
        self.range = rng
        self.remote = remote
        self.t = REMOTE_SAFETY if remote else BOMB_FUSE
        self.passers = passers  # jogadores que ainda podem atravessar (acabaram de soltá-la)
        self.done = False
        self.vx = self.vy = 0  # deslizando (chute ou esteira)
        self.prog = 0.0
        self.speed = KICK_SPEED
        self.belt = False  # deslizando por causa de uma esteira
        self.fly = None  # [sx, sy, tx, ty, decorrido] (arremesso/soco)

    def pos(self):
        if self.fly:
            sx, sy, tx, ty, e = self.fly
            k = min(1.0, e / FLIGHT_TIME)
            return sx + (tx - sx) * k, sy + (ty - sy) * k, math.sin(math.pi * k)
        return self.x + self.vx * self.prog, self.y + self.vy * self.prog, 0.0


def spiral(w, h):
    x0, y0, x1, y1 = 1, 1, w - 2, h - 2
    out = []
    while x0 <= x1 and y0 <= y1:
        out += [(x, y0) for x in range(x0, x1 + 1)]
        out += [(x1, y) for y in range(y0 + 1, y1 + 1)]
        if y0 < y1:
            out += [(x, y1) for x in range(x1 - 1, x0 - 1, -1)]
        if x0 < x1:
            out += [(x0, y) for y in range(y1 - 1, y0, -1)]
        x0, y0, x1, y1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1
    return out


class Room:
    def __init__(self, rid, name, single, history, custom_skins=()):
        self.id = rid
        self.name = name
        self.single = single
        self.history = history
        self.custom_skins = custom_skins  # ids das skins enviadas pelos jogadores (texto); as do tema são números
        self.players = {}
        self.banned = set()  # nomes expulsos pelo gerente
        self.next_pid = 1
        self.host = None
        self.map, self.rounds, self.round_time = "rotate", 3, 120
        self.map_queue = []  # mapas ainda não usados no modo "rotate"
        self.cur_map = "classic"
        self.now = 0.0
        self.tick_n = 0
        self._danger = (-1, {})
        self.round_no = 0
        self.round_humans = 0
        self.final = []
        self.to_lobby()

    # ---------- configuração e jogadores ----------
    def apply_settings(self, m):
        if m.get("map") in MAPS:
            self.map = m["map"]
        elif m.get("map") in ("rotate", "random"):
            self.map = "rotate"
        for key, attr, lo, hi in (("rounds", "rounds", 1, 20), ("time", "round_time", 30, 600)):
            try:
                setattr(self, attr, max(lo, min(hi, int(m[key]))))
            except (KeyError, TypeError, ValueError):
                pass

    def connected(self):
        return [p for p in self.players.values() if p.connected]

    def humans(self):
        return [p for p in self.connected() if not p.bot]

    @staticmethod
    def _nskins(n):
        return max(MAX_PLAYERS, min(16, n))

    def _valid_skin(self, skin, nskins):
        if isinstance(skin, str):
            return skin in self.custom_skins
        return isinstance(skin, int) and 0 <= skin < nskins

    def _free_skin(self, skin, nskins):
        nskins = self._nskins(nskins)
        taken = {p.skin for p in self.connected()}
        skin = skin if self._valid_skin(skin, nskins) else 0
        if skin not in taken:
            return skin
        return next((s for s in range(nskins) if s not in taken), skin)

    def add_player(self, client, name, skin, nskins, bot=False):
        if len(self.connected()) >= MAX_PLAYERS:
            return "Sala cheia (máximo 6 jogadores)."
        names = {p.name.lower() for p in self.connected()}
        base, n = name, 2
        while name.lower() in names:
            name = f"{base} {n}"
            n += 1
        p = Player(self.next_pid, name, self._free_skin(skin, nskins), client, bot)
        p.nskins = self._nskins(nskins)
        self.next_pid += 1
        self.players[p.id] = p
        if self.host is None and not bot:
            self.host = p.id
        if self.phase != "lobby":
            p.alive, p.waiting = False, True
        else:
            self.preview()
        return p

    def add_bot(self):
        n = sum(1 for p in self.players.values() if p.bot) + 1
        return self.add_player(None, f"CPU {n}", n, 16, bot=True)

    def remove_player(self, p):
        if self.phase == "lobby":
            self.players.pop(p.id, None)
            self.preview()
        else:
            p.connected = False
            p.alive = False
            p.dx = p.dy = 0
        if self.host == p.id:
            heirs = self.humans()
            self.host = heirs[0].id if heirs else None

    def on_message(self, p, m):
        """Trata uma mensagem do jogador; devolve um texto de erro para mostrar a ele, se houver."""
        t = m.get("t")
        if t == "skin":
            skin = m.get("skin")
            if not isinstance(skin, str):
                try:
                    skin = int(skin)
                except (TypeError, ValueError):
                    return None
            if self.phase != "lobby":
                return "A skin só pode ser trocada no lobby."
            if not self._valid_skin(skin, p.nskins):
                return None
            if any(q.skin == skin for q in self.connected() if q is not p):
                return "Essa skin já está em uso por outro jogador."
            p.skin = skin
        elif t == "ready" and self.phase == "lobby":
            p.ready = bool(m.get("v"))
        elif t == "settings" and self.phase == "lobby" and p.id == self.host:
            self.apply_settings(m)
            self.preview()
        elif t == "in":
            try:
                dx = max(-1, min(1, int(m.get("dx", 0))))
                dy = max(-1, min(1, int(m.get("dy", 0))))
            except (TypeError, ValueError):
                return
            p.dx, p.dy = dx, (0 if dx else dy)
        elif t == "bomb":
            p.want_bomb = True
        elif t == "det":
            p.want_det = True

    # ---------- fases ----------
    def preview(self):
        """Arena mostrada no lobby."""
        self.cur_map = random.choice(ORDER) if self.map == "rotate" else self.map
        self._new_arena()
        spawns = spawn_points(self.w, self.h)
        for i, p in enumerate(sorted(self.connected(), key=lambda p: p.id)):
            p.x, p.y = spawns[i][0] + 0.5, spawns[i][1] + 0.5

    def _new_arena(self):
        self.grid = build_grid(self.cur_map)
        self.specials = build_specials(self.cur_map)  # portais e esteiras
        self.h, self.w = len(self.grid), len(self.grid[0])
        self.bombs, self.bomb_at = [], {}
        self.flames, self.items = {}, {}
        self.winner = None
        self.time_left = float(self.round_time)
        self.sudden = False
        self.sd_order, self.sd_i, self.sd_t = spiral(self.w, self.h), 0, 0.0

    def to_lobby(self):
        for pid in [i for i, p in self.players.items() if not p.connected]:
            del self.players[pid]
        for p in self.players.values():
            p.reset()
            p.ready = p.bot
            p.waiting = p.in_round = False
            p.wins = p.points = p.played = 0
        self.phase = "lobby"
        self.timer = 0.0
        self.round_no = 0
        self.map_queue = []
        self.preview()

    def _next_map(self):
        """Mapa da rodada: o escolhido, ou (modo "rotate") um mapa diferente a cada rodada."""
        if self.map != "rotate":
            return self.map
        if not self.map_queue:
            q = ORDER[:]
            random.shuffle(q)
            if q[0] == self.cur_map:  # não repete o da rodada anterior
                q.append(q.pop(0))
            self.map_queue = q
        return self.map_queue.pop(0)

    def start_round(self):
        self.round_no += 1
        self.cur_map = self._next_map()
        self._new_arena()
        spawns = spawn_points(self.w, self.h)
        i = 0
        for p in sorted(self.players.values(), key=lambda p: p.id):
            p.reset()
            p.waiting = False
            p.in_round = p.connected
            if p.connected:
                p.x, p.y = spawns[i][0] + 0.5, spawns[i][1] + 0.5
                p.played += 1
                i += 1
            else:
                p.alive = False
        self.round_humans = len([p for p in self.humans() if p.in_round])
        self.phase = "countdown"
        self.timer = COUNTDOWN

    def end_round(self, alive):
        self.phase = "over"
        self.timer = ROUND_OVER_TIME
        w = alive[0] if len(alive) == 1 else None
        self.winner = w.id if w else None
        if w:
            w.wins += 1
            if not w.bot and not self.single and self.round_humans >= 3:
                w.points += self.round_humans - 2

    def finish_match(self):
        ps = sorted(self.connected(), key=lambda p: (-p.wins, p.name))
        top = ps[0].wins if ps else 0
        n = self.round_humans
        for p in ps:
            p.match_win = top > 0 and p.wins == top
            if p.match_win and not p.bot and not self.single and n >= 3:
                p.points += 2 * (n - 2)
        self.final = [{"id": p.id, "name": p.name, "skin": p.skin, "wins": p.wins,
                       "points": p.points, "winner": p.match_win, "bot": p.bot} for p in ps]
        humans = [p for p in self.players.values() if not p.bot and p.played]  # inclui quem saiu no meio
        if not self.single and len(humans) >= 2:
            self.history.record([{"name": p.name, "points": p.points, "round_wins": p.wins,
                                  "match_win": p.match_win} for p in humans])
        self.phase = "final"
        self.timer = FINAL_TIME

    def step(self):
        self.now += TICK
        self.tick_n += 1
        if self.phase == "lobby":
            ps = self.connected()
            if len(ps) >= 2 and all(p.ready for p in ps):
                self.start_round()
        elif self.phase == "countdown":
            self.timer -= TICK
            if self.timer <= 0:
                self.phase = "playing"
        elif self.phase in ("playing", "over"):
            self.update_world(self.phase == "playing")
            if self.phase == "over":
                self.timer -= TICK
                if self.timer <= 0:
                    self.start_round() if self.round_no < self.rounds else self.finish_match()
        elif self.phase == "final":
            self.timer -= TICK
            if self.timer <= 0:
                self.to_lobby()

    # ---------- mundo ----------
    def update_world(self, playing):
        if playing:
            if not self.sudden:
                self.time_left -= TICK
                if self.time_left <= 0:
                    self.time_left, self.sudden, self.sd_t = 0.0, True, SD_DELAY
            else:
                self.sd_t -= TICK
                while self.sd_t <= 0:
                    self.sd_step()
                    self.sd_t += SD_INTERVAL
            for p in self.players.values():
                if p.alive:
                    self.update_player(p)
            self.spread_curses()

        for b in list(self.bombs):
            if b.fly:
                b.fly[4] += TICK
                if b.fly[4] >= FLIGHT_TIME:
                    self.land(b)
            elif b.vx or b.vy:
                self.slide(b)
            else:
                sp = self.specials.get((b.x, b.y))
                if sp and sp[0] == "b":  # bomba parada numa esteira é levada junto
                    self.kick(b, *sp[1], speed=BELT_SPEED, belt=True)
                b.passers = {pid for pid in b.passers
                             if pid in self.players and self.players[pid].alive
                             and self.overlaps_tile(self.players[pid], b.x, b.y)}
            b.t -= TICK
        due = [b for b in self.bombs if b.t <= 0 and not b.fly and not b.done]
        if due:
            self.detonate(due)
        for cell in [c for c, exp in self.flames.items() if exp <= self.now]:
            del self.flames[cell]

        if not playing:
            return
        for p in self.players.values():
            if p.alive and (int(p.x), int(p.y)) in self.flames:
                self.hit(p)
        alive = [p for p in self.players.values() if p.alive]
        no_humans = self.single and not any(p.alive and not p.bot for p in self.players.values())
        parts = [p for p in self.players.values() if p.in_round]
        if (len(parts) > 1 and len(alive) <= 1) or not alive or no_humans:
            self.end_round(alive)

    def update_player(self, p):
        if p.bot:
            bots.think(self, p)
        p.invuln_t = max(0.0, p.invuln_t - TICK)
        p.pass_cd = max(0.0, p.pass_cd - TICK)
        if p.curse:
            p.curse_t -= TICK
            if p.curse_t <= 0:
                p.curse = ""
        dx, dy = p.dx, p.dy
        if p.curse == "reverse" and not p.bot:
            dx, dy = -dx, -dy
        speed = 2.2 if p.curse == "slow" else 8.5 if p.curse == "fast" else p.speed
        if dx or dy:
            self.move(p, dx, dy, speed * TICK)
        self.floor_effects(p)
        if p.want_bomb:
            p.want_bomb = False
            self.place_bomb(p)
        if p.want_det:
            p.want_det = False
            for b in self.bombs:
                if b.owner == p.id and b.remote:
                    b.t = 0.0
        if p.curse == "diarrhea":
            p.auto_t -= TICK
            if p.auto_t <= 0:
                p.auto_t = 0.4
                self.place_bomb(p, auto=True)
        self.pickup(p)

    def floor_effects(self, p):
        """Esteira arrasta o jogador; portal teleporta para o par (uma vez, até ele sair do portal)."""
        sp = self.specials.get((int(p.x), int(p.y)))
        if sp and sp[0] == "b":
            self.move(p, sp[1][0], sp[1][1], BELT_SPEED * TICK, drag=True)
        elif sp and sp[0] == "w":
            if p.warp_armed and abs(p.x - int(p.x) - 0.5) < 0.3 and abs(p.y - int(p.y) - 0.5) < 0.3:
                tx, ty = sp[1]
                p.x, p.y = tx + 0.5, ty + 0.5
                p.warp_armed = False
                b = self.bomb_at.get((tx, ty))
                if b:
                    b.passers.add(p.id)  # não prende o jogador dentro de uma bomba
        else:
            p.warp_armed = True
            return
        if not (sp and sp[0] == "w"):
            p.warp_armed = True

    def spread_curses(self):
        """A caveira é contagiosa: encostar em outro jogador passa a maldição para ele."""
        for p in self.players.values():
            if not (p.alive and p.curse and p.pass_cd <= 0):
                continue
            for q in self.players.values():
                if (q is not p and q.alive and not q.curse
                        and abs(p.x - q.x) < 2 * HALF and abs(p.y - q.y) < 2 * HALF):
                    q.curse, q.curse_t, q.auto_t, q.pass_cd = p.curse, CURSE_TIME, 0.4, PASS_COOLDOWN
                    p.curse = ""
                    break

    def hit(self, p):
        if p.invuln_t > 0:
            return
        if p.shield:  # o colete absorve a explosão e quebra
            p.shield = False
            p.invuln_t = INVULN_TIME  # a chama ainda está acesa: dá um respiro para sair dela
        elif p.lives > 0:
            p.lives -= 1
            p.invuln_t = INVULN_TIME
        else:
            p.alive = False

    def sd_step(self):
        while self.sd_i < len(self.sd_order):
            x, y = self.sd_order[self.sd_i]
            self.sd_i += 1
            if self.grid[y][x] == WALL:
                continue
            self.grid[y][x] = WALL
            self.items.pop((x, y), None)
            self.flames.pop((x, y), None)
            self.specials.pop((x, y), None)
            b = self.bomb_at.pop((x, y), None)
            if b:
                b.done = True
                self.bombs.remove(b)
            for p in self.players.values():
                if p.alive and (int(p.x), int(p.y)) == (x, y):
                    p.alive = False
            return

    # ---------- movimento ----------
    @staticmethod
    def overlaps_tile(p, tx, ty):
        return (math.floor(p.x - HALF) <= tx <= math.floor(p.x + HALF)
                and math.floor(p.y - HALF) <= ty <= math.floor(p.y + HALF))

    def solid(self, tx, ty, p):
        t = self.grid[ty][tx]
        if t == WALL or (t == BLOCK and not p.wall_pass):
            return True
        b = self.bomb_at.get((tx, ty))
        return b is not None and not p.bomb_pass and p.id not in b.passers

    def blocked(self, px, py, p):
        for ty in range(math.floor(py - HALF), math.floor(py + HALF) + 1):
            for tx in range(math.floor(px - HALF), math.floor(px + HALF) + 1):
                if self.solid(tx, ty, p):
                    return True
        return False

    def move(self, p, dx, dy, dist, drag=False):
        """Anda dist tiles. drag=True é a esteira empurrando: não vira o rosto nem chuta bombas."""
        if not drag:
            p.face = "r" if dx > 0 else "l" if dx < 0 else "d" if dy > 0 else "u"
        nx, ny = p.x + dx * dist, p.y + dy * dist
        if not self.blocked(nx, ny, p):
            p.x, p.y = nx, ny
            return
        if (p.kick or p.punch) and not drag:  # bateu numa bomba: chuta ou soca
            ax, ay = int(p.x + dx * (HALF + 0.05)), int(p.y + dy * (HALF + 0.05))
            b = self.bomb_at.get((ax, ay))
            if b and not b.fly and not p.bomb_pass and p.id not in b.passers:
                if p.punch:
                    self.throw(b, dx, dy)
                else:
                    self.kick(b, dx, dy)
                return
        # contorna quinas: se a pista alinhada à frente está livre, desliza até o centro dela
        if dx:
            lane = math.floor(p.y) + 0.5
            diff = lane - p.y
            if abs(diff) > 1e-9 and not self.blocked(nx, lane, p):
                p.y += math.copysign(min(dist, abs(diff)), diff)
                return
        else:
            lane = math.floor(p.x) + 0.5
            diff = lane - p.x
            if abs(diff) > 1e-9 and not self.blocked(lane, ny, p):
                p.x += math.copysign(min(dist, abs(diff)), diff)
                return
        for f in (0.5, 0.25, 0.125, 0.0625):  # encosta na parede
            nx, ny = p.x + dx * dist * f, p.y + dy * dist * f
            if not self.blocked(nx, ny, p):
                p.x, p.y = nx, ny
                return

    # ---------- bombas ----------
    def place_bomb(self, p, auto=False):
        if p.curse == "constipation" and not auto:
            return
        tx, ty = int(p.x), int(p.y)
        here = self.bomb_at.get((tx, ty))
        if here:
            if p.glove and not auto and not here.fly and not (here.vx or here.vy):
                self.throw(here, *FACE[p.face])  # luva: arremessa a bomba em que está
            return
        free = p.max_bombs - sum(1 for b in self.bombs if b.owner == p.id)
        if free <= 0:
            return
        count = free if (p.line_bomb and not auto) else 1
        dx, dy = FACE[p.face]
        rng = 1 if p.curse == "short" else p.range
        for i in range(count):
            x, y = tx + dx * i, ty + dy * i
            if self.grid[y][x] != EMPTY or (x, y) in self.bomb_at:
                break
            r = rng
            if i == 0 and p.power_bombs > 0:
                p.power_bombs -= 1
                r = MAX_RANGE
            passers = {q.id for q in self.players.values() if q.alive and self.overlaps_tile(q, x, y)}
            b = Bomb(x, y, p.id, r, passers, p.remote and not p.bot)
            self.bombs.append(b)
            self.bomb_at[(x, y)] = b

    def _bomb_cell_free(self, x, y, b):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return False
        if self.grid[y][x] != EMPTY or (x, y) in self.bomb_at:
            return False
        return not any(q.alive and q.id not in b.passers and self.overlaps_tile(q, x, y)
                       for q in self.players.values())

    def kick(self, b, dx, dy, speed=KICK_SPEED, belt=False):
        if not (b.vx or b.vy or b.fly) and self._bomb_cell_free(b.x + dx, b.y + dy, b):
            b.vx, b.vy, b.prog, b.speed, b.belt = dx, dy, 0.0, speed, belt

    @staticmethod
    def _stop(b):
        b.vx = b.vy = 0
        b.prog = 0.0
        b.belt = False
        b.speed = KICK_SPEED

    def slide(self, b):
        b.prog += b.speed * TICK
        while b.prog >= 1.0:
            nx, ny = b.x + b.vx, b.y + b.vy
            if not self._bomb_cell_free(nx, ny, b):
                self._stop(b)
                return
            del self.bomb_at[(b.x, b.y)]
            b.x, b.y = nx, ny
            self.bomb_at[(nx, ny)] = b
            b.prog -= 1.0
            if b.belt:  # na esteira segue a direção da esteira; saiu dela, para
                sp = self.specials.get((b.x, b.y))
                if sp and sp[0] == "b":
                    b.vx, b.vy = sp[1]
                else:
                    self._stop(b)
                    return

    def throw(self, b, dx, dy, dist=THROW_DIST):
        sx, sy = b.x, b.y

        def ok(x, y):
            return 0 <= x < self.w and 0 <= y < self.h and self.grid[y][x] == EMPTY and (x, y) not in self.bomb_at

        land = None
        k = dist
        while 0 <= sx + dx * k < self.w and 0 <= sy + dy * k < self.h:
            if ok(sx + dx * k, sy + dy * k):
                land = (sx + dx * k, sy + dy * k)
                break
            k += 1
        if land is None:
            for k in range(dist - 1, 0, -1):
                if ok(sx + dx * k, sy + dy * k):
                    land = (sx + dx * k, sy + dy * k)
                    break
        if land is None:
            return
        self.bomb_at.pop((sx, sy), None)
        self._stop(b)
        b.fly = [sx, sy, land[0], land[1], 0.0]

    def land(self, b):
        sx, sy, tx, ty, _ = b.fly
        b.fly = None
        if self.grid[ty][tx] != EMPTY or (tx, ty) in self.bomb_at:
            tx, ty = sx, sy
            if self.grid[ty][tx] != EMPTY or (tx, ty) in self.bomb_at:
                b.t = 0.0  # sem lugar para pousar: explode
                b.x, b.y = tx, ty
                return
        b.x, b.y = tx, ty
        self.bomb_at[(tx, ty)] = b
        b.passers = {q.id for q in self.players.values() if q.alive and self.overlaps_tile(q, tx, ty)}

    def blast(self, x, y, rng):
        """Células atingidas por uma bomba em (x, y); também blocos destruídos e bombas alcançadas."""
        cells, blocks, hit = [(x, y)], [], []
        for dx, dy in DIRS:
            for i in range(1, rng + 1):
                cx, cy = x + dx * i, y + dy * i
                t = self.grid[cy][cx]
                if t == WALL:
                    break
                cells.append((cx, cy))
                if t == BLOCK:
                    blocks.append((cx, cy))
                    break
                o = self.bomb_at.get((cx, cy))
                if o:
                    hit.append(o)
        return cells, blocks, hit

    def detonate(self, first):
        queue = list(first)
        cells, destroyed = set(), set()
        while queue:
            b = queue.pop()
            if b.done:
                continue
            b.done = True
            c, bl, hit = self.blast(b.x, b.y, b.range)
            cells.update(c)
            destroyed.update(bl)
            queue.extend(o for o in hit if not o.done)
        for b in self.bombs:
            if b.done and self.bomb_at.get((b.x, b.y)) is b:
                del self.bomb_at[(b.x, b.y)]
        self.bombs = [b for b in self.bombs if not b.done]
        for c in cells:
            self.flames[c] = self.now + FLAME_TIME
            self.items.pop(c, None)
        for x, y in destroyed:
            self.grid[y][x] = EMPTY
            if random.random() < ITEM_CHANCE:
                self.items[(x, y)] = random.choices(ITEM_KINDS, [ITEM_WEIGHTS[k] for k in ITEM_KINDS])[0]

    def danger(self):
        """Células que vão pegar fogo (para a IA dos bots); calculado uma vez por tick."""
        if self._danger[0] != self.tick_n:
            d = {c: 0.0 for c in self.flames}
            for b in self.bombs:
                for c in self.blast(b.x, b.y, b.range)[0]:
                    d[c] = min(d.get(c, 9.0), b.t)
            self._danger = (self.tick_n, d)
        return self._danger[1]

    # ---------- powerups ----------
    def pickup(self, p):
        kind = self.items.pop((int(p.x), int(p.y)), None)
        if kind == "bomb_up":
            p.max_bombs = min(MAX_BOMBS, p.max_bombs + 1)
        elif kind == "fire_up":
            p.range = min(MAX_RANGE, p.range + 1)
        elif kind == "speed_up":
            p.speed = min(MAX_SPEED, p.speed + SPEED_STEP)
        elif kind == "full_fire":
            p.range = MAX_RANGE
        elif kind == "shield":
            p.shield = True
        elif kind == "heart":
            p.lives = min(MAX_LIVES, p.lives + 1)
        elif kind == "skull":
            p.curse, p.curse_t, p.auto_t, p.pass_cd = random.choice(CURSES), CURSE_TIME, 0.4, 0.5
        elif kind == "power_bomb":
            p.power_bombs += 1
        elif kind:  # remote, bomb_pass, wall_pass, kick, glove, punch, line_bomb
            setattr(p, kind, True)

    # ---------- rede ----------
    def info(self):
        return {"id": self.id, "name": self.name, "host": self.players[self.host].name if self.host in self.players else "",
                "players": len(self.connected()), "max": MAX_PLAYERS, "phase": self.phase,
                "round": self.round_no, "rounds": self.rounds, "map": self.map, "time": self.round_time}

    def snapshot(self):
        return {
            "t": "state", "room": self.name, "phase": self.phase, "host": self.host,
            "map": self.cur_map, "w": self.w, "h": self.h,
            "settings": {"map": self.map, "rounds": self.rounds, "time": self.round_time},
            "round": self.round_no, "rounds": self.rounds,
            "time_left": math.ceil(self.time_left), "sudden": self.sudden,
            "countdown": math.ceil(self.timer) if self.phase == "countdown" else 0,
            "winner": self.winner, "final": self.final if self.phase == "final" else [],
            "grid": "".join(str(c) for row in self.grid for c in row),
            "players": [
                {"id": p.id, "name": p.name, "skin": p.skin, "x": round(p.x, 3), "y": round(p.y, 3),
                 "alive": p.alive, "ready": p.ready, "connected": p.connected, "waiting": p.waiting,
                 "bot": p.bot, "face": p.face, "bombs": p.max_bombs, "range": p.range,
                 "speed": round(p.speed, 1), "wins": p.wins, "points": p.points, "lives": p.lives,
                 "shield": p.shield, "invuln": p.invuln_t > 0, "curse": p.curse,
                 "curse_t": math.ceil(p.curse_t) if p.curse else 0,
                 "abil": p.abilities()}
                for p in sorted(self.connected(), key=lambda p: p.id)
            ],
            "bombs": [[*(round(v, 2) for v in b.pos()), round(b.t, 2), b.owner, b.remote] for b in self.bombs],
            "flames": [[x, y, round(exp - self.now, 2)] for (x, y), exp in self.flames.items()],
            "items": [[x, y, k] for (x, y), k in self.items.items()],
            "specials": [[x, y, "b", {(1, 0): "r", (-1, 0): "l", (0, 1): "d", (0, -1): "u"}[sp[1]]] if sp[0] == "b"
                         else [x, y, "w", sp[2]] for (x, y), sp in self.specials.items()],
        }
