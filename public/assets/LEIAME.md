# Assets / tema

## Organização das pastas

```
assets/
├── theme.json        ← aponta para as imagens (caminhos relativos a esta pasta)
├── backgrounds/      ← fundo da tela inicial
├── bombs/            ← spritesheets das bombas (normal, super bomba, perfurante)
├── effects/          ← atlas da explosão
├── fonts/            ← fontes (Rye, usada no logo)
├── powerups/         ← um ícone por poder (bomb_up.webp, kick.webp, ...)
├── skins/            ← personagens (skin1.webp, skin2.png, ...)
├── tilesets/         ← um tema de tiles por pasta (grama, deserto, gelo, ...): veja tilesets/LEIAME.txt
└── ui/               ← menu, ranking, relógio e o tema escuro da partida (painéis, botões, corações)
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
| `tilesets` | temas de tiles por pasta: `{ "dir": "tilesets", "themes": ["grama", ...], "maps": { "classic": "grama", ... } }`. Cada tema tem `parede` (borda), `inquebravel` (pilares), `quebravel`, `piso_a`, `piso_b` e `piso_decorado`; as mecânicas (`agua`, `escorregadio`, `esteira`, `lava`, `portal`) ficam em um tema só e valem para qualquer mapa. Tem prioridade sobre `tiles` e `maps` |
| `items.<tipo>` | imagem de cada powerup (lista abaixo) |
| `bombs` | sprites das bombas: `normal`, `power` (super bomba), `pierce` (perfurante) e `search` (bomba de busca: quadros 0 a 2 parada, quadro 3 perseguindo). Cada um é um arquivo (`"bombs/bomb.webp"`) ou um spritesheet em uma linha: `{ "image": "bombs/bomb.png", "frames": 3, "fps": 7 }`. Os quadros são achados pela transparência (podem ter tamanhos diferentes); se a contagem não bater, usa grade uniforme com `frameWidth` e `gap`. Os quadros tocam em vai-e-vem (0,1,2,1,0…) desde que a bomba é solta. Sem `power` e `pierce`, o jogo desenha um anel laranja e espetos por cima da bomba normal. A chave antiga `bomb` (só a bomba normal) ainda vale |
| `flame` | chama da explosão: uma imagem para todas as casas (`"flame.png"`) ou um atlas por direção `{ "image": "effects/explosion.png", "grid": 7 }`. No atlas, a grade `grid`×`grid` tem as peças: centro `[3,3]`, trechos de braço horizontais `h` (`[2,3]`,`[4,3]`) e verticais `v` (`[3,2]`,`[3,4]`), escolhidos por casa, e as pontas de 1 casa `left` `[1,3]`, `right` `[5,3]`, `up` `[3,1]`, `down` `[3,5]`; o campo opcional `parts` troca as células de `[coluna, linha]` de cada peça. Os bulbos largos com asas das extremidades do atlas não são usados. O servidor diz a cada casa quais lados continuam em chamas, e o cliente escolhe a peça |
| `skins` | lista de skins de personagem (quantas quiser) — cada jogador escolhe a sua em **Mudar skin** |

Ids dos mapas: `classic`, `arena`, `cross`, `factory`, `diamond`, `volcano`, `big`, `portals`, `belt`, `maze`, `towers`, `fortress`, `columns`, `rings`, `grid3`, `converge`, `teleport`, `river`, `ice`, `open`, `walls`, `ice_stripes`, `chambers`, `belts_parallel`, `bastions`, `lava`.

### Powerups (`items`)

`bomb_up` (+1 bomba), `fire_up` (+1 alcance), `speed_up` (velocidade), `full_fire` (alcance máximo),
`remote` (controle remoto), `bomb_pass` (atravessa bombas), `wall_pass` (atravessa blocos),
`kick` (chuta bombas), `glove` (luva: arremessa), `punch` (soco), `shield` (colete),
`heart` (vida extra), `skull` (caveira/maldição), `line_bomb` (bombas em linha), `power_bomb` (super bomba), `pierce_bomb` (bomba perfurante), `search_bomb` (bomba de busca).

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

As skins que os jogadores enviam pelo jogo (**Mudar skin → Adicionar skin**) não ficam aqui: o servidor as salva em
`data/skins/` (fora de `public/`) e as mostra depois destas.

Se houver menos de 8 skins, as que faltam são completadas com os personagens coloridos padrão
(precisam existir pelo menos 6, um para cada jogador da sala). Se um arquivo não for encontrado, o navegador
avisa no console (F12) e usa o padrão.
