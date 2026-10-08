# CTI BOMBERS

Bomberman para até 6 jogadores na mesma rede. Só o anfitrião precisa do Python 3.8+ (sem instalar pacotes); os outros jogam pelo navegador.

## Como jogar
1. No PC do anfitrião (Linux ou Windows):
   - Linux: `python3 server.py`
   - Windows: `py server.py` (ou `python server.py`)
2. O terminal mostra os endereços, ex.: `http://192.168.0.10:8000`. Todos abrem esse endereço no navegador.
3. Na tela inicial digite o nome e escolha **Singleplayer**, **Multiplayer** ou **Mudar skin**.

Se os amigos não conseguirem conectar, libere a porta 8000 (TCP) no firewall do anfitrião. Outra porta: `--port 9000`.

## Modos
- **Singleplayer:** você contra 1 a 5 bots, com mapa, rodadas e tempo à escolha. Não vale pontos.
- **Multiplayer:** lista as salas abertas (inclusive as que já estão jogando) ou cria uma nova.
  - Quem cria a sala é o gerente e define mapa, número de rodadas e tempo de cada rodada (pode mudar no lobby).
  - A partida só começa quando todos os jogadores da sala clicam em **Pronto!** (mínimo 2).
  - Quem entra depois que a partida começou espera a próxima rodada.
  - Se o tempo da rodada acabar começa a **morte súbita**: paredes fecham a arena em espiral.

## Pontuação
- Durante a partida há uma tabela com vitórias e pontos de cada jogador.
- A tela inicial mostra o **ranking geral** (salvo em `data/history.json`).
- Só pontuam partidas multiplayer com **3 ou mais jogadores humanos**. Com N jogadores: cada rodada vencida dá **N − 2** pontos e quem vence a partida ganha mais **2 × (N − 2)**. Partidas com 1 ou 2 jogadores não dão pontos.

## Controles
Setas ou WASD para andar, **espaço** para soltar bomba, **E** ou **Shift** para detonar bombas remotas.

## Powerups
💣 bomba extra · 🔥 fogo (+alcance) · 👟 velocidade · 💥 fogo total · 📡 controle remoto · 👻 passa-bomba · 🧱 passa-bloco ·
🥾 chute · 🧤 luva (arremessa a bomba em que está) · 👊 soco · 🛡️ colete (absorve uma explosão e quebra; não some com o tempo) · ❤️ vida extra ·
💀 caveira (maldição por 10 s) · ➡️ bombas em linha · ☢️ super bomba.

## Mapas
12 fases: Clássico, Arena Aberta, Quadrantes, Fábrica, Diamante, Vulcão, Campo Grande (19×15), Labirinto, Torres, Fortaleza e duas com mecânicas especiais:
- **Portais:** pise num portal para ser teletransportado ao par (3 pares coloridos, espelhados pelo centro). Só teleporta de novo depois que você sair do portal.
- **Esteira:** um circuito de esteiras no sentido horário que arrasta jogadores e bombas (dá para andar contra ela). Por padrão os mapas **se alternam a cada rodada** (sem repetir até todos terem aparecido); o gerente pode fixar um mapa.

## Skins dos jogadores
Em **Mudar skin** → **Adicionar skin**, cada jogador envia uma imagem própria (PNG, JPG, GIF ou WebP; imagens grandes
são reduzidas para 256 px). O servidor salva as imagens em `data/skins/` e a lista em `data/skins/skins.json`, e a
skin aparece na hora para todos. Só quem enviou (pelo nome digitado) pode apagá-la; cada nome pode ter até 5 skins.
Também dá para colocar imagens direto na pasta `data/skins/`: elas viram skins quando o servidor reinicia.

## Trocar visual (blocos, powerups, skins)
Coloque as imagens nas subpastas de `public/assets/` (`powerups/`, `skins/`, `backgrounds/`, `fonts/`) e aponte para elas em `public/assets/theme.json`. Dá F5 e pronto, sem reiniciar o servidor. Detalhes e formato de spritesheet em [public/assets/LEIAME.md](public/assets/LEIAME.md).

## Publicar online (Vercel)
A Vercel não roda WebSocket, então o site (`public/`) vai para a Vercel e o servidor de jogo (`server.py`, via
`Dockerfile`) para outra hospedagem. Passo a passo em [DEPLOY.md](DEPLOY.md); o endereço do servidor fica em
[public/config.js](public/config.js).

## Estrutura
- `server.py`: HTTP + WebSocket, salas e histórico. Variáveis: `PORT`, `HOST`, `ALLOWED_ORIGINS`, `HISTORY_FILE`, `SKINS_DIR`.
- `game.py`: regras de uma sala (rodadas, bombas, powerups, morte súbita, pontos).
- `maps.py`: mapas. `bots.py`: IA dos bots.
- `_arquivo/`: arquivos guardados que o jogo não usa (fora de `public/`, o servidor não os entrega).
- `Dockerfile`, `vercel.json`, `.vercelignore`: publicação (veja DEPLOY.md).
- `public/`: cliente (`game.js` tem as telas e as funções `draw*` do canvas, ponto de partida para as animações).
