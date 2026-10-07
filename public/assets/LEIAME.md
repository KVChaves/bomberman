# Assets / tema

## Organização das pastas

```
assets/
├── theme.json        ← aponta para as imagens (caminhos relativos a esta pasta)
├── backgrounds/      ← fundo da tela inicial
├── powerups/         ← um ícone por poder (bomb_up.webp, kick.webp, ...)
├── skins/            ← personagens (skin1.webp, skin2.png, ...)
├── fonts/            ← fontes (Rye, usada no logo)
├── tiles/            ← (crie quando precisar) chão, parede e bloco: floor.webp, wall.webp, block.webp
└── efeitos/          ← (crie quando precisar) bomba e chama: bomb.webp, flame.webp
```

Regra: **uma pasta por tipo de imagem**, e no `theme.json` o caminho começa pela pasta,
por exemplo `"skins/skin1.webp"` ou `"powerups/heart.webp"`. Ao criar uma pasta nova, é só usá-la no caminho.

Coloque as imagens nas pastas e aponte para elas em `theme.json`
(nomes relativos a esta pasta, subpastas valem: `"blocos/tijolo.png"`).
Tudo que ficar `null`/vazio continua com o desenho padrão, então dá para trocar aos poucos.
Depois de editar, é só dar F5 no navegador (o servidor não precisa reiniciar).

Formatos: PNG, SVG, GIF (sem animar), WebP. Ideal: imagens quadradas; são esticadas para 1 tile (48×48 px na tela).

## Campos do theme.json

| Campo | O que é |
|---|---|
| `pixelArt` | `true` desliga a suavização (pixel art fica nítida) |
| `background` | imagem de fundo da tela inicial (ex.: `"backgrounds/wp.jpeg"`); vazio usa o fundo padrão |
| `tiles.floor` | lista de 1 ou 2 imagens; com 2 forma um xadrez |
| `tiles.wall` | parede indestrutível (borda e pilares) |
| `tiles.block` | bloco que explode |
| `maps` | visual específico de um mapa, ex.: `"maps": { "volcano": { "tiles": { "floor": ["tiles/lava.png"], "wall": "tiles/rocha.png" } } }` (o que faltar usa `tiles`) |
| `items.<tipo>` | imagem de cada powerup (lista abaixo) |
| `bomb` | bomba |
| `flame` | uma célula de chama (usada em todas as células da explosão) |
| `skins` | lista de skins de personagem (quantas quiser) — cada jogador escolhe a sua em **Mudar skin** |

Ids dos mapas: `classic`, `arena`, `cross`, `factory`, `diamond`, `volcano`, `big`, `portals`, `belt`, `maze`, `towers`, `fortress`.

### Powerups (`items`)

`bomb_up` (+1 bomba), `fire_up` (+1 alcance), `speed_up` (velocidade), `full_fire` (alcance máximo),
`remote` (controle remoto), `bomb_pass` (atravessa bombas), `wall_pass` (atravessa blocos),
`kick` (chuta bombas), `glove` (luva: arremessa), `punch` (soco), `shield` (colete),
`heart` (vida extra), `skull` (caveira/maldição), `line_bomb` (bombas em linha), `power_bomb` (super bomba).

## Skins de personagem

Cada skin pode ser só o nome do arquivo (uma imagem para todas as direções):

```json
"skins": ["skins/p1.png", "skins/p2.png"]
```

Ou um spritesheet, com uma linha por direção e colunas de quadros de caminhada:

```json
"skins": [
  {
    "name": "Robô",
    "image": "skins/robo_sheet.png",
    "frameWidth": 32,
    "frameHeight": 48,
    "frames": 4,
    "fps": 8,
    "rows": { "d": 0, "u": 1, "l": 2, "r": 3 },
    "scale": 1.2,
    "offsetY": 4,
    "color": "#ff8800"
  }
]
```

- `name`: nome mostrado na escolha de skin. `color`: cor usada nas tabelas.
- `frameWidth`/`frameHeight`: tamanho de cada quadro (omitidos = imagem inteira).
- `frames`: quadros por linha. A coluna 0 é o personagem parado; ao andar, cicla por todos.
- `rows`: linha de cada direção (`d` baixo, `u` cima, `l` esquerda, `r` direita). Se a imagem tiver só uma linha, todas usam ela.
- `shape`: `"circle"` recorta a imagem num círculo (bom para fotos sem fundo transparente).
- `pixelArt`: `true`/`false` só para esta skin (vale mais que o `pixelArt` geral; use `false` em imagens grandes ou fotos).
- `scale`: altura do desenho em tiles (1 = um tile; personagens altos usam 1.2–1.5).
- `offsetY`: ajuste vertical em pixels (positivo desce). Os pés ficam alinhados ao fim do tile.

Se houver menos de 8 skins, as que faltam são completadas com os personagens coloridos padrão
(precisam existir pelo menos 6, um para cada jogador da sala). Se um arquivo não for encontrado, o navegador
avisa no console (F12) e usa o padrão.
