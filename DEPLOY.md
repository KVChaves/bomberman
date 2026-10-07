# Publicar o CTI Bombers online (Vercel + servidor)

## Por que são duas partes

A Vercel hospeda **sites estáticos e funções curtas**. Ela **não mantém conexões WebSocket abertas** nem guarda
as salas na memória, e é isso que o jogo precisa. Por isso:

```
 jogadores (navegador)
     │  1. abrem o site                     2. jogam por WebSocket (wss://)
     ▼                                      ▼
 ┌──────────────┐                     ┌─────────────────────────────┐
 │   Vercel     │   config.js aponta  │  Servidor de jogo           │
 │  pasta public│ ──────────────────▶ │  python server.py (Docker)  │
 │  (só o site) │                     │  Render / Fly / Railway ... │
 └──────────────┘                     └─────────────────────────────┘
```

Na **rede local** nada disso é necessário: `python3 server.py` e pronto (o servidor também entrega o site).

## Passo 1 — Subir o servidor de jogo

O `Dockerfile` da raiz já faz tudo (Python puro, sem dependências). Qualquer hospedagem que rode Docker e aceite
WebSocket serve. Exemplo no **Render** (Web Service):

1. Envie o projeto para um repositório Git (`.gitignore` já ignora `data/`, `_arquivo/` e `__pycache__/`).
2. Render → *New → Web Service* → escolha o repositório → *Runtime: Docker*.
3. *Health Check Path*: `/health`.
4. Variáveis de ambiente (veja a tabela abaixo). A mais importante é `ALLOWED_ORIGINS` (passo 3).
5. Anote o endereço, por exemplo `cti-bombers.onrender.com`.

No **Fly.io**: `fly launch` (detecta o Dockerfile; porta interna 8000), `fly deploy`. No **Railway**: *New Project →
Deploy from repo*. Os três definem a variável `PORT` sozinhos; o servidor já a lê.

> Planos gratuitos costumam **dormir** quando ninguém usa (a primeira conexão pode levar cerca de um minuto; o site
> mostra "Sem conexão… tentando de novo" e conecta sozinho) e o disco é **temporário**: o ranking some quando o
> servidor reinicia. Para manter o ranking, use um disco/volume persistente e aponte `HISTORY_FILE` para ele
> (ex.: `/data/history.json`).
>
> Rode **uma única instância** do servidor: as salas ficam na memória do processo.

## Passo 2 — Publicar o site na Vercel

1. Edite [public/config.js](public/config.js):
   ```js
   window.CTI_CONFIG = { server: "cti-bombers.onrender.com" };
   ```
   (Sem `https://`; o site já usa `wss://` sozinho quando está em https.)
2. Na raiz do projeto: `npx vercel --prod` (ou conecte o repositório no painel da Vercel).
   O `vercel.json` já manda publicar só a pasta `public/` e o `.vercelignore` deixa o resto de fora.
3. Anote o endereço do site, por exemplo `https://cti-bombers.vercel.app`.

## Passo 3 — Fechar o servidor para o seu site

No servidor, defina:

```
ALLOWED_ORIGINS=https://cti-bombers.vercel.app
```

Assim só o seu site consegue abrir conexão (outros sites recebem 403). Vários endereços: separe com vírgula
(inclua o domínio próprio, se tiver). Em **rede local deixe a variável vazia**.

## Conferir

- No canto inferior direito do site aparece **● online · endereço-do-servidor**. Se aparecer "sem conexão", o
  endereço do `config.js` está errado, o servidor está dormindo, ou o `ALLOWED_ORIGINS` não inclui o seu site.
- `https://SEU-SERVIDOR/health` deve responder `ok`.
- Para testar outro servidor sem editar nada: abra o site com `?server=ENDEREÇO` na URL.

## Variáveis do servidor

| Variável | Para que serve | Padrão |
|---|---|---|
| `PORT` | porta (as hospedagens definem sozinhas) | `8000` |
| `HOST` | interface onde escuta | `0.0.0.0` |
| `ALLOWED_ORIGINS` | sites autorizados a conectar, separados por vírgula | vazio = qualquer um |
| `HISTORY_FILE` | onde salvar o ranking geral | `data/history.json` |

## Alternativa sem hospedar nada: túnel

Para jogar com amigos de fora da rede sem contratar servidor, rode o jogo no seu PC e abra um túnel:

```
python3 server.py
cloudflared tunnel --url http://localhost:8000      # ou: ngrok http 8000
```

O túnel entrega um endereço `https://...` que já serve **o site e o jogo juntos** (não precisa da Vercel). Quem
quiser usar a Vercel mesmo assim pode colocar o endereço do túnel em `config.js`.

## Observações

- Não há contas nem senha: o ranking usa o nome digitado. Não é feito para uso público aberto na internet.
- As instruções de Render/Fly/Railway são o procedimento padrão de cada serviço; **não foram testadas aqui**.
  O que foi testado: `PORT`, `/health`, `ALLOWED_ORIGINS` e a conexão entre origens diferentes.
