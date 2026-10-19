#!/usr/bin/env python3
"""Sobe o ranking (data/history.json) e as skins enviadas (data/skins/) para o Supabase.

Uso:  SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=<service_role> python3 migrar_supabase.py [--force] [--dry-run]

Antes, rode supabase.sql no SQL Editor. Por padrão não sobrescreve o ranking que já existir no Supabase
(use --force para sobrescrever); a lista de skins é mesclada pelo id."""
import base64
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/") + "/rest/v1/kv"
KEY = os.environ.get("SUPABASE_KEY", "").strip()
FORCE, DRY = "--force" in sys.argv, "--dry-run" in sys.argv
HEADERS = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}


def call(method, query="", body=None, extra=None):
    req = urllib.request.Request(URL + query, method=method, headers={**HEADERS, **(extra or {})},
                                 data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read() or b"null")


def get(key):
    rows = call("GET", "?select=value&key=eq." + urllib.parse.quote(key, safe=""))
    return rows[0]["value"] if rows else None


def put(key, value):
    if not DRY:
        call("POST", "?on_conflict=key", {"key": key, "value": value},
             {"Prefer": "resolution=merge-duplicates,return=minimal"})


def main():
    if not (KEY and URL != "/rest/v1/kv"):
        sys.exit("Defina SUPABASE_URL e SUPABASE_KEY (chave service_role).")

    hist_path = os.path.join(BASE, "data", "history.json")
    if os.path.isfile(hist_path):
        with open(hist_path, encoding="utf-8") as f:
            hist = json.load(f)
        if get("history") and not FORCE:
            print("history: já existe no Supabase, mantido (use --force para sobrescrever)")
        else:
            put("history", hist)
            print(f"history: {len(hist)} entradas enviadas")
    else:
        print("history: data/history.json não existe, pulado")

    folder = os.path.join(BASE, "data", "skins")
    index = os.path.join(folder, "skins.json")
    with open(index, encoding="utf-8") as f:
        local = json.load(f)
    remote = get("skins") or []
    merged = list(remote)
    have = {s["id"] for s in remote}
    sent = 0
    for s in local:
        path = os.path.join(folder, s["file"])
        if not os.path.isfile(path):
            print("skin sem arquivo, pulada:", s["file"])
            continue
        with open(path, "rb") as f:
            put("skin:" + s["file"], base64.b64encode(f.read()).decode())
        if s["id"] not in have:
            merged.append(s)
        sent += 1
    put("skins", merged)
    print(f"skins: {sent} imagens enviadas, lista com {len(merged)} skins" + (" (dry-run)" if DRY else ""))


if __name__ == "__main__":
    main()
