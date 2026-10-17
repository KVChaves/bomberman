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
import sys
import threading
import time
import urllib.parse
import urllib.request

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

# Supabase (opcional): guarda ranking e skins numa tabela `kv` (veja supabase.sql). Sem as duas variáveis, usa arquivos.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "").strip()  # chave service_role (secreta, só no servidor)


class Store:
    """Chave-valor no Supabase via REST (só biblioteca padrão). Leituras bloqueiam; gravações vão para uma thread."""

    def __init__(self, url, key):
        self.url = url + "/rest/v1/kv"
        self.headers = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
        self.pending = {}  # chave -> valor (None = apagar); só a gravação mais recente de cada chave é enviada
        self.lock = threading.Lock()
        self.wake = threading.Event()
        threading.Thread(target=self._writer, daemon=True).start()

    def _call(self, method, query="", body=None, extra=None):
        req = urllib.request.Request(self.url + query, method=method, headers={**self.headers, **(extra or {})},
                                     data=None if body is None else json.dumps(body).encode())
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read() or b"null")

    def get(self, key):
        try:
            rows = self._call("GET", "?select=value&key=eq." + urllib.parse.quote(key, safe=""))
            return rows[0]["value"] if rows else None
        except (OSError, ValueError, KeyError) as e:
            print("Aviso: não consegui ler do Supabase:", e)
            return None

    def put(self, key, value):
        value = json.loads(json.dumps(value))  # cópia: o original continua mudando enquanto a thread grava
        with self.lock:
            self.pending[key] = value
        self.wake.set()

    def delete(self, key):
        self.put(key, None)

    def _writer(self):
        while True:
            self.wake.wait()
            self.wake.clear()
            with self.lock:
                batch, self.pending = self.pending, {}
            for key, value in batch.items():
                for attempt in range(3):
                    try:
                        if value is None:
                            self._call("DELETE", "?key=eq." + urllib.parse.quote(key, safe=""))
                        else:
                            self._call("POST", "?on_conflict=key", {"key": key, "value": value},
                                       {"Prefer": "resolution=merge-duplicates,return=minimal"})
                        break
                    except (OSError, ValueError) as e:
                        print("Aviso: não consegui gravar no Supabase:", e)
                        time.sleep(2 * (attempt + 1))


STORE = Store(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None


class History:
    """Ranking geral por nome de jogador, salvo em data/history.json."""

    def __init__(self, path):
        self.path = path
        self.version = 0
        if STORE:
            self.data = STORE.get("history") or {}
            return
        try:
            with open(path, encoding="utf-8") as f:
                self.data = json.load(f)
        except (OSError, ValueError):
            self.data = {}

    def record(self, entries):
        """Soma por IP (quem usa vários nomes conta como uma pessoa); o nome visível é o último usado."""
        merged = {}
        for e in entries:
            key = e.get("ip") or e["name"].lower()
            m = merged.setdefault(key, {"name": e["name"], "points": 0, "round_wins": 0, "kills": 0, "match_win": False})
            m["name"] = e["name"]
            m["points"] += e["points"]
            m["round_wins"] += e["round_wins"]
            m["kills"] += e.get("kills", 0)
            m["match_win"] = m["match_win"] or e["match_win"]
        for key, e in merged.items():
            d = self.data.setdefault(key, {"name": e["name"], "points": 0, "round_wins": 0,
                                           "matches": 0, "match_wins": 0, "kills": 0})
            d["name"] = e["name"]
            d["points"] += e["points"]
            d["round_wins"] += e["round_wins"]
            d["kills"] = d.get("kills", 0) + e["kills"]
            d["matches"] += 1
            d["match_wins"] += 1 if e["match_win"] else 0
        self.version += 1
        if STORE:
            STORE.put("history", self.data)
            return
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path + ".tmp", "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=1)
            os.replace(self.path + ".tmp", self.path)
        except OSError as e:
            print("Aviso: não consegui salvar o histórico:", e)

    def table(self, n=20):
        rows = sorted(({k: v for k, v in d.items() if k != "ip"} for d in self.data.values()), key=lambda d: (-d["points"], -d["match_wins"], -d["round_wins"], d["name"]))
        for d in rows:
            d["avg"] = round(d["points"] / d["matches"], 1) if d["matches"] else 0
        return rows[:n]


IMAGE_CACHE = {}  # arquivo da skin -> bytes (modo Supabase)


async def serve_skin_remote(writer, name):
    data = IMAGE_CACHE.get(name)
    if data is None and re.fullmatch(r"[\w-]+\.\w+", name):
        raw = await asyncio.get_running_loop().run_in_executor(None, STORE.get, "skin:" + name)
        data = base64.b64decode(raw) if raw else None
        if data:
            if len(IMAGE_CACHE) >= 64:
                IMAGE_CACHE.pop(next(iter(IMAGE_CACHE)))
            IMAGE_CACHE[name] = data
    if data is None:
        writer.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 3\r\nConnection: close\r\n\r\n404")
    else:
        ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
        writer.write((f"HTTP/1.1 200 OK\r\nContent-Type: {ctype}\r\nContent-Length: {len(data)}\r\n"
                      "Cache-Control: public, max-age=86400\r\nConnection: close\r\n\r\n").encode() + data)
    await writer.drain()


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
        if STORE:  # imagens ficam no Supabase (chave "skin:<arquivo>"); aqui só a lista
            self.items = [s for s in (STORE.get("skins") or []) if isinstance(s, dict) and self.valid_file(s.get("file"))]
            return
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
        if STORE:
            STORE.put("skin:" + skin["file"], base64.b64encode(data).decode())
            IMAGE_CACHE[skin["file"]] = data
        else:
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
        if STORE:
            STORE.delete("skin:" + s["file"])
            IMAGE_CACHE.pop(s["file"], None)
            return None
        try:
            os.remove(os.path.join(self.dir, s["file"]))
        except OSError:
            pass
        return None

    def _save(self):
        if STORE:
            STORE.put("skins", self.items)
            return
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
        self.ip = ""

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
            elif t == "chat":
                self.chat(c, m.get("text"))
            else:
                err = c.room.on_message(c.player, m)
                if err:
                    c.send({"t": "error", "msg": err})
            return
        if t == "rooms":
            self.send_menu(c)
        elif t in ("create", "join"):
            self.enter(c, m, t == "create")

    CHAT_MAX, CHAT_KEEP, CHAT_GAP = 200, 40, 0.7

    def chat(self, c, text):
        """Chat da sala: texto simples, limitado e com intervalo mínimo entre mensagens."""
        room, p = c.room, c.player
        if not isinstance(text, str) or p is None:
            return
        text = " ".join(text.split())[:self.CHAT_MAX]
        now = time.monotonic()
        if not text or now - getattr(c, "last_chat", 0.0) < self.CHAT_GAP:
            return
        c.last_chat = now
        msg = {"t": "chat", "name": p.name, "skin": p.skin, "text": text}
        room.chat.append(msg)
        del room.chat[:-self.CHAT_KEEP]
        frame = enc(msg)
        for q in room.players.values():
            if q.client and q.connected:
                q.client.send_raw(frame)

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
        for old in room.chat:
            c.send(old)

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
    # atrás de proxy (hospedagem) o IP real vem em X-Forwarded-For; senão é o endereço da conexão
    fwd = headers.get("x-forwarded-for", "").split(",")[0].strip()
    peer = writer.get_extra_info("peername")
    c.ip = fwd or (peer[0] if peer else "")
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
            if STORE:
                await serve_skin_remote(writer, route[len("/skins/"):])
            else:
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


def fine_timer():
    """No Windows o relógio padrão tem passos de ~15 ms: o laço do jogo oscilava e o movimento ficava travado."""
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.winmm.timeBeginPeriod(1)
        except Exception:
            pass


async def game_loop():
    fine_timer()
    nxt = time.perf_counter()
    n = 0
    while True:
        hub.tick()
        n += 1
        if n % 30 == 0:
            hub.menu_broadcast()
        nxt += TICK
        delay = nxt - time.perf_counter()
        if delay > 0.002:
            await asyncio.sleep(delay - 0.002)  # dorme quase tudo e cede o resto, para não passar do ponto
            while time.perf_counter() < nxt:
                await asyncio.sleep(0)
        elif delay < -0.25:
            nxt = time.perf_counter()  # atrasou demais: recomeça em vez de acelerar o jogo
        else:
            await asyncio.sleep(0)  # um pouco atrasado: recupera no próximo tick, mantendo 30 ticks/s


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
