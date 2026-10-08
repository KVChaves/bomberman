#!/usr/bin/env python3
"""CTI Bombers: servidor HTTP + WebSocket, salas e histórico (só biblioteca padrão)."""
import argparse
import asyncio
import base64
import hashlib
import json
import mimetypes
import os
import re
import secrets
import socket
import struct
import time

from game import MAX_PLAYERS, TICK, Room
from maps import MAPS

BASE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(BASE, "public")
HISTORY_FILE = os.environ.get("HISTORY_FILE") or os.path.join(BASE, "data", "history.json")  # em hospedagem, aponte para um disco persistente
SKINS_DIR = os.environ.get("SKINS_DIR") or os.path.join(BASE, "data", "skins")  # skins enviadas pelos jogadores
mimetypes.add_type("image/webp", ".webp")  # Pythons antigos não conhecem
# Sites autorizados a abrir WebSocket (ex.: "https://cti-bombers.vercel.app,https://meusite.com").
# Vazio = qualquer um (bom para rede local). O próprio endereço do servidor sempre é aceito.
ALLOWED_ORIGINS = {o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()}
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


class History:
    """Ranking geral por nome de jogador, salvo em data/history.json."""

    def __init__(self, path):
        self.path = path
        self.version = 0
        try:
            with open(path, encoding="utf-8") as f:
                self.data = json.load(f)
        except (OSError, ValueError):
            self.data = {}

    def record(self, entries):
        for e in entries:
            d = self.data.setdefault(e["name"].lower(), {"name": e["name"], "points": 0, "round_wins": 0,
                                                         "matches": 0, "match_wins": 0})
            d["name"] = e["name"]
            d["points"] += e["points"]
            d["round_wins"] += e["round_wins"]
            d["matches"] += 1
            d["match_wins"] += 1 if e["match_win"] else 0
        self.version += 1
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path + ".tmp", "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=1)
            os.replace(self.path + ".tmp", self.path)
        except OSError as e:
            print("Aviso: não consegui salvar o histórico:", e)

    def table(self, n=20):
        rows = sorted(self.data.values(), key=lambda d: (-d["points"], -d["match_wins"], -d["round_wins"], d["name"]))
        return rows[:n]


class Skins:
    """Skins enviadas pelos jogadores: as imagens ficam em data/skins/ e a lista em data/skins/skins.json.

    Uma imagem colocada à mão na pasta também vira skin (o nome do arquivo é o nome da skin)."""

    MAX_BYTES = 512 * 1024
    MAX_PER_OWNER, MAX_TOTAL = 5, 200
    MAGIC = ((b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpg"), (b"GIF8", "gif"))
    EXTS = {"png", "jpg", "jpeg", "gif", "webp"}

    def __init__(self, folder):
        self.dir = folder
        self.index = os.path.join(folder, "skins.json")
        try:
            with open(self.index, encoding="utf-8") as f:
                items = json.load(f)
        except (OSError, ValueError):
            items = []
        self.items = [s for s in items if isinstance(s, dict) and self.valid_file(s.get("file"))
                      and os.path.isfile(os.path.join(folder, s["file"]))]  # arquivo apagado à mão sai da lista
        known = {s["file"] for s in self.items}
        try:
            extra = sorted(f for f in os.listdir(folder) if self.valid_file(f) and f not in known)
        except OSError:
            extra = []
        for f in extra:
            self.items.append({"id": "c" + hashlib.sha1(f.encode()).hexdigest()[:8], "file": f,
                               "name": os.path.splitext(f)[0][:16], "owner": ""})
        if extra or len(self.items) != len(items):
            self._save()

    def valid_file(self, f):
        return isinstance(f, str) and re.fullmatch(r"[\w-]+\.(\w+)", f) and f.rsplit(".", 1)[1].lower() in self.EXTS

    def __contains__(self, sid):
        return any(s["id"] == sid for s in self.items)

    def public(self):
        return self.items

    def _kind(self, data):
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return "webp"
        return next((ext for magic, ext in self.MAGIC if data.startswith(magic)), None)

    def add(self, owner, m):
        """Salva a skin enviada; devolve (skin, None) ou (None, mensagem de erro)."""
        owner = str(owner or "").strip()[:12]
        if not owner:
            return None, "Digite seu nome antes de enviar uma skin."
        if sum(1 for s in self.items if s["owner"].lower() == owner.lower()) >= self.MAX_PER_OWNER:
            return None, f"Cada jogador pode ter até {self.MAX_PER_OWNER} skins. Apague uma para enviar outra."
        if len(self.items) >= self.MAX_TOTAL:
            return None, "O servidor já tem skins demais."
        raw = str(m.get("data", ""))
        try:
            data = base64.b64decode(raw.split(",", 1)[-1], validate=True)
        except ValueError:
            return None, "Imagem inválida."
        if len(data) > self.MAX_BYTES:
            return None, "Imagem grande demais (máximo 512 KB)."
        ext = self._kind(data)
        if not ext:
            return None, "Formato não aceito. Use PNG, JPG, GIF ou WebP."
        sid = "c" + secrets.token_hex(4)
        skin = {"id": sid, "file": f"{sid}.{ext}", "name": str(m.get("name", "")).strip()[:16] or f"Skin de {owner}",
                "owner": owner}
        try:
            os.makedirs(self.dir, exist_ok=True)
            with open(os.path.join(self.dir, skin["file"]), "wb") as f:
                f.write(data)
        except OSError as e:
            print("Aviso: não consegui salvar a skin:", e)
            return None, "O servidor não conseguiu salvar a skin."
        self.items.append(skin)
        self._save()
        return skin, None

    def remove(self, owner, sid):
        """Só quem enviou (mesmo nome) apaga a skin; devolve uma mensagem de erro ou None."""
        s = next((s for s in self.items if s["id"] == sid), None)
        if s is None:
            return "Skin não encontrada."
        if not s["owner"] or s["owner"].lower() != str(owner or "").strip().lower():
            return "Só quem enviou a skin pode apagá-la."
        self.items.remove(s)
        self._save()
        try:
            os.remove(os.path.join(self.dir, s["file"]))
        except OSError:
            pass
        return None

    def _save(self):
        try:
            os.makedirs(self.dir, exist_ok=True)
            with open(self.index + ".tmp", "w", encoding="utf-8") as f:
                json.dump(self.items, f, ensure_ascii=False, indent=1)
            os.replace(self.index + ".tmp", self.index)
        except OSError as e:
            print("Aviso: não consegui salvar a lista de skins:", e)


# ---------- WebSocket mínimo ----------
def ws_frame(payload, opcode=1):
    n = len(payload)
    if n < 126:
        head = bytes([0x80 | opcode, n])
    elif n < 65536:
        head = bytes([0x80 | opcode, 126]) + struct.pack(">H", n)
    else:
        head = bytes([0x80 | opcode, 127]) + struct.pack(">Q", n)
    return head + payload


def enc(obj):
    return ws_frame(json.dumps(obj, separators=(",", ":")).encode())


async def read_frame(reader):
    b1, b2 = await reader.readexactly(2)
    opcode, n = b1 & 0x0F, b2 & 0x7F
    if n == 126:
        n = struct.unpack(">H", await reader.readexactly(2))[0]
    elif n == 127:
        n = struct.unpack(">Q", await reader.readexactly(8))[0]
    if n > 1 << 20:  # 1 MB: cabe uma skin enviada (até 512 KB em base64)
        raise ValueError("frame grande demais")
    mask = await reader.readexactly(4) if b2 & 0x80 else None
    data = await reader.readexactly(n)
    if mask:
        data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    return opcode, data


class Client:
    def __init__(self, writer):
        self.writer = writer
        self.room = None
        self.player = None
        self.closed = False

    def send_raw(self, frame):
        if self.closed:
            return
        t = self.writer.transport
        if t.is_closing() or t.get_write_buffer_size() > 1 << 18:
            return  # cliente lento: descarta o quadro
        self.writer.write(frame)

    def send(self, obj):
        self.send_raw(enc(obj))


class Hub:
    def __init__(self):
        self.rooms = {}
        self.clients = set()
        self.next_room = 1
        self.history = History(HISTORY_FILE)
        self.sent_history = -1
        self.skins = Skins(SKINS_DIR)

    def room_list(self):
        return [r.info() for r in self.rooms.values() if not r.single and r.connected()]

    def hello(self):
        return {"t": "hello", "max": MAX_PLAYERS,
                "maps": [{"id": k, "name": m["name"], "w": m["w"], "h": m["h"]} for k, m in MAPS.items()],
                "skins": self.skins.public()}

    def send_menu(self, c):
        c.send({"t": "rooms", "rooms": self.room_list()})
        c.send({"t": "history", "rows": self.history.table()})

    # ---------- mensagens ----------
    def on_message(self, c, m):
        if not isinstance(m, dict):
            return
        t = m.get("t")
        if t in ("skin_add", "skin_del"):  # vale dentro ou fora de uma sala
            self.custom_skin(c, m, t == "skin_add")
            return
        if c.room:
            if t == "leave":
                self.leave(c)
            elif t == "kick":
                self.kick(c, self._int(m.get("id"), -1))
            else:
                err = c.room.on_message(c.player, m)
                if err:
                    c.send({"t": "error", "msg": err})
            return
        if t == "rooms":
            self.send_menu(c)
        elif t in ("create", "join"):
            self.enter(c, m, t == "create")

    def custom_skin(self, c, m, add):
        if add:
            skin, err = self.skins.add(m.get("owner"), m)
            if skin:
                c.send({"t": "skin_added", "id": skin["id"]})
        else:
            err = self.skins.remove(m.get("owner"), m.get("id"))
        if err:
            c.send({"t": "error", "msg": err})
            return
        frame = enc({"t": "skins", "skins": self.skins.public()})
        for cl in self.clients:
            cl.send_raw(frame)

    @staticmethod
    def _int(v, default):
        try:
            return int(v)
        except (TypeError, ValueError):
            return default

    def enter(self, c, m, create):
        name = str(m.get("name", "")).strip()[:12] or "Jogador"
        skin = m.get("skin") if isinstance(m.get("skin"), str) else self._int(m.get("skin"), 0)
        nskins = self._int(m.get("nskins"), 8)
        if create:
            single = bool(m.get("single"))
            rname = str(m.get("room", "")).strip()[:24] or f"Sala de {name}"
            room = Room(self.next_room, rname, single, self.history, self.skins)
            room.apply_settings(m)
            room.preview()
        else:
            room = self.rooms.get(self._int(m.get("room"), -1))
            if room is None or room.single:
                c.send({"t": "error", "msg": "Sala não encontrada."})
                self.send_menu(c)
                return
            if name.lower() in room.banned:
                c.send({"t": "error", "msg": "Você foi expulso desta sala."})
                self.send_menu(c)
                return
        p = room.add_player(c, name, skin, nskins)
        if isinstance(p, str):
            c.send({"t": "error", "msg": p})
            self.send_menu(c)
            return
        if create:
            self.rooms[room.id] = room
            self.next_room += 1
            if single:
                p.ready = True
                for _ in range(max(1, min(MAX_PLAYERS - 1, self._int(m.get("bots"), 3)))):
                    room.add_bot()
        c.room, c.player = room, p
        c.send({"t": "you", "id": p.id})

    def leave(self, c):
        room, p = c.room, c.player
        if room is None:
            return
        c.room = c.player = None
        room.remove_player(p)
        p.connected = False
        p.client = None
        if not room.humans():
            self.rooms.pop(room.id, None)
        if not c.closed:
            c.send({"t": "left"})
            self.send_menu(c)

    def kick(self, c, target_id):
        """O gerente expulsa outro jogador humano da sala."""
        room = c.room
        target = room.players.get(target_id)
        if room.host != c.player.id or target is None or target is c.player or target.bot or not target.client:
            return
        tc = target.client
        room.banned.add(target.name.lower())
        self.leave(tc)
        tc.send({"t": "error", "msg": "Você foi expulso da sala pelo gerente."})

    # ---------- laço do jogo ----------
    def tick(self):
        for rid in [i for i, r in self.rooms.items() if not r.humans()]:
            del self.rooms[rid]  # sala sem jogadores é excluída
        for room in list(self.rooms.values()):
            room.step()
            clients = [p.client for p in room.players.values() if p.client and p.connected]
            if clients:
                frame = enc(room.snapshot())
                for cl in clients:
                    cl.send_raw(frame)

    def menu_broadcast(self):
        rooms = enc({"t": "rooms", "rooms": self.room_list()})
        hist = None
        if self.sent_history != self.history.version:
            self.sent_history = self.history.version
            hist = enc({"t": "history", "rows": self.history.table()})
        for c in self.clients:
            if c.room is None:
                c.send_raw(rooms)
                if hist:
                    c.send_raw(hist)


hub = Hub()


async def ws_session(reader, writer, headers):
    key = headers.get("sec-websocket-key", "")
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    writer.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                  f"Connection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n").encode())
    await writer.drain()
    c = Client(writer)
    hub.clients.add(c)
    c.send(hub.hello())
    hub.send_menu(c)
    try:
        while True:
            opcode, data = await read_frame(reader)
            if opcode == 8:
                break
            if opcode == 9:
                c.send_raw(ws_frame(data, 10))
            elif opcode == 1:
                try:
                    hub.on_message(c, json.loads(data))
                except json.JSONDecodeError:
                    pass
    finally:
        c.closed = True
        hub.clients.discard(c)
        hub.leave(c)


async def serve_static(writer, path, root=PUBLIC):
    path = path.split("?")[0]
    rel = "index.html" if path == "/" else path.lstrip("/")
    root = os.path.realpath(root)
    full = os.path.realpath(os.path.join(root, rel))
    if not full.startswith(root + os.sep) or not os.path.isfile(full):
        body, status, ctype = b"404", "404 Not Found", "text/plain"
    else:
        with open(full, "rb") as f:
            body = f.read()
        status = "200 OK"
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript") or ctype.endswith("json"):
            ctype += "; charset=utf-8"
    writer.write((f"HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n"
                  "Cache-Control: no-cache\r\nConnection: close\r\n\r\n").encode() + body)
    await writer.drain()


def origin_allowed(headers):
    if not ALLOWED_ORIGINS:
        return True
    origin = headers.get("origin", "").rstrip("/")
    own = headers.get("host", "")
    return origin in ALLOWED_ORIGINS or (own and origin.split("://", 1)[-1] == own)


async def handle(reader, writer):
    try:
        head = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 10)
        lines = head.decode("latin1").split("\r\n")
        _, path, _ = lines[0].split(" ", 2)
        headers = {k.lower(): v.strip() for k, v in (l.split(":", 1) for l in lines[1:] if ":" in l)}
        route = path.split("?")[0]
        if headers.get("upgrade", "").lower() == "websocket" and route == "/ws":
            if origin_allowed(headers):
                await ws_session(reader, writer, headers)
            else:
                writer.write(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
                await writer.drain()
        elif route == "/health":  # verificação de saúde das hospedagens (Render, Fly, Railway...)
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
            await writer.drain()
        elif route.startswith("/skins/"):  # imagens das skins enviadas pelos jogadores
            await serve_static(writer, route[len("/skins/"):], SKINS_DIR)
        else:
            await serve_static(writer, path)
    except (asyncio.IncompleteReadError, asyncio.TimeoutError, ConnectionError, ValueError, OSError):
        pass
    finally:
        try:
            writer.close()
        except OSError:
            pass


async def game_loop():
    nxt = time.perf_counter()
    n = 0
    while True:
        hub.tick()
        n += 1
        if n % 30 == 0:
            hub.menu_broadcast()
        nxt += TICK
        delay = nxt - time.perf_counter()
        if delay > 0:
            await asyncio.sleep(delay)
        else:
            nxt = time.perf_counter()


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # não envia nada, só descobre a interface de saída
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        ips.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


async def main():
    ap = argparse.ArgumentParser(description="CTI Bombers")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)),
                    help="porta (padrão: variável PORT, usada pelas hospedagens, ou 8000)")
    ap.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    args = ap.parse_args()
    server = await asyncio.start_server(handle, args.host, args.port)
    print("CTI BOMBERS rodando! Abra no navegador:")
    print(f"  neste PC:      http://localhost:{args.port}")
    for ip in lan_ips():
        print(f"  outros da rede: http://{ip}:{args.port}")
    if ALLOWED_ORIGINS:
        print("  sites autorizados:", ", ".join(sorted(ALLOWED_ORIGINS)))
    print("Ctrl+C para parar.")
    async with server:
        await asyncio.gather(server.serve_forever(), game_loop())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
