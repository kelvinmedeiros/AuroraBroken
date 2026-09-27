# AuroraBroken

![AuroraBroken](client/sprites/aurorabroken-logo.png)

RPG de ação em português com campanha solo e cooperativo opcional para até quatro jogadores.

![Acendendo e usando uma fogueira no jogo](docs/fogueira-gameplay.gif)

*Capturas reais: fogueira apagada e ativação no cenário em camadas. A animação repete a demonstração; a fogueira permanece acesa na campanha.*

## Rodar

O projeto local fica em `C:\Projects\AuroraBroken`. Na raiz, execute `npm start` e abra http://localhost:3000. O próprio servidor entrega o cliente e o Socket.IO: não é necessário iniciar um segundo servidor. As dependências existentes bastam; numa instalação nova use `npm run install-all`.

`npm run dev` reinicia o servidor quando arquivos mudam. Recarregue o navegador após editar o cliente. `npm test` executa testes de geometria, combate, progressão, salvamento e integração real das salas.

## Jogar

- WASD ou setas: andar. Espaço: atacar na direção do personagem.
- Shift: esquivar (breve invulnerabilidade, recarga de 1,2 s).
- E: fogueira, portal, inscrição ou runa próxima. R: renascer após cair.
- I: armas e armaduras. Q: técnica da arma (30 energia, recarga 4 s). F: projétil perfurante (40 energia, recarga 3 s).
- J: diário e bestiário. M: mapa com objetivos. Esc: menu. F3: colisões.
- Em telas de toque, botões de movimento e ação aparecem automaticamente.

O Guerreiro tem ataques curtos e rápidos; a Feiticeira alcança mais longe. Ataques não atravessam paredes. Os círculos inimigos avisam onde o dano acontecerá. Malênio entra em fúria abaixo de metade da vida.

Derrote os três guardiões do Jardim das Cinzas para abrir seu portal norte. A Cidadela do Sol Partido tem um portal de retorno ao sul. Derrote Malênio e entre no castelo pelo portal junto à fachada. A terceira fase, **Cripta da Primeira Aurora**, contém sete inimigos, incluindo Espectros e o chefe Custódio. Leia a inscrição com E e ative as três runas na ordem indicada para abrir a câmara norte. Derrote o Custódio para concluir a história. Os mortos não reaparecem ao trocar de mapa; renascer restaura apenas os inimigos sobreviventes do mapa quando nenhum outro jogador vivo está nele.

## Armas e armaduras

O Guerreiro escolhe espada, lança ou machado. A Feiticeira escolhe cajado, varinha ou grimório. Cada arma tem dano, alcance, direção e intervalo próprios: a lança oferece estocadas longas, o machado troca velocidade por impacto, a varinha concentra ataques rápidos e o grimório atinge ao redor. Q acompanha a arma: redemoinho, estocada, ruptura sísmica, nova arcana, raio concentrado ou círculo solar. Técnicas causam o dobro do dano e desaceleram inimigos por dois segundos. F lança energia que atravessa vários inimigos, mas para em paredes e no selo fechado.

Equipe separadamente **elmo/capuz, peitoral/manto, luvas, grevas/perneiras e botas**, além da arma. Guerreiro: Vigia, Ferro Solar e Guardião da Aurora. Feiticeira: Aprendiz, Tecelã do Eclipse e Oráculo da Aurora. Complete o Jardim para liberar o segundo conjunto e vença Malênio para liberar o terceiro. Misture peças em **Equipar · I**; a tela mostra dano, defesa, regeneração e aparência. As cores das peças são aplicadas ao sprite animado, e a arma aparece na mão. A defesa reduz o dano recebido; peças melhores também aumentam poder e, em alguns conjuntos, regeneração de energia. Cada participante tem equipamento próprio, validado pelo servidor e salvo com seu perfil.

![Tela de armas e armaduras](docs/equipamentos.jpg)

## Fogueiras

Cada mapa começa com a fogueira apagada. Aproxime-se e pressione **E** para acendê-la uma única vez por campanha. Ela restaura sua vida, torna a área próxima segura e define seu ponto de retorno. Depois, **E** permite descansar, com oito segundos de recarga. O estado aceso é compartilhado pela sala; cada jogador registra seu próprio ponto de retorno ao interagir. Fogueiras e checkpoints persistem em saves, exportações e reinícios. Saves antigos começam com as fogueiras apagadas.

## Solo e cooperativo

Solo é o padrão e não carrega nem conecta o Socket.IO. O progresso é salvo no armazenamento local do navegador a cada dois segundos e ao sair. Cada **Iniciar nova jornada** cria um save separado. Em **Arquivos e saves** você pode selecionar, renomear, carregar, salvar manualmente, exportar JSON e importar uma campanha. Importar sempre cria um novo registro, preservando os anteriores. O save antigo é reconhecido como **Jornada original**. O autosave afeta apenas a campanha ativa.

Cooperativo: escolha o mesmo código de sala nos computadores conectados ao servidor. Informe seu nome; para duas abas no mesmo navegador, use nomes diferentes. As batalhas, chefes e progressão são compartilhadas; personagens de mapas diferentes não aparecem juntos. O servidor aceita comandos, nunca posições ou dano enviados pelo cliente. Até quatro participantes por sala.

As salas são salvas a cada 5 segundos, ao salvar manualmente, ao sair e no encerramento normal do servidor. Arquivos separados ficam em `saves/multiplayer/CODIGO.json`, com cópia anterior `.json.bak`. O servidor restaura as salas depois de reiniciar. Um identificador aleatório salvo no navegador, por sala e nome, recupera o personagem; use o mesmo navegador e endereço para manter esse perfil. Se a conexão cair, entre novamente pelo menu. O perfil antigo não é apagado.

Em **Saves**, qualquer participante pode salvar/exportar a sala. Só o criador, sozinho na sala, pode importar um arquivo multiplayer. Uma cópia permanente anterior à importação fica em `saves/multiplayer/backups/`. Para restaurar em outro servidor ou quando perdeu o perfil do criador, crie uma nova sala e importe o arquivo. Use outro código para uma nova campanha. Os saves não ficam na pasta pública do site. `SAVE_DIR` permite escolher outro diretório do servidor.

O servidor escuta em `0.0.0.0:3000` para permitir rede local. Neste PC use http://localhost:3000; em outro PC da mesma rede use o endereço da rede local exibido no menu Cooperativo. `localhost` no segundo PC aponta para o segundo PC, não para o servidor. `HOST` e `PORT` permitem escolher interface e porta. O Windows já possui permissão de entrada para este Node.js; não foi necessário desativar firewall ou configurar encaminhamento no roteador. O PC servidor precisa permanecer ligado e executando `npm start`.

## Cenários em camadas e profundidade

Os três mapas usam imagens contendo **somente o chão**: `ground-garden.png`, `ground-ash.png` e `ground-dungeon.png`. Árvores, árvores secas, pedras, galhos, barreiras, santuário e castelo são PNGs transparentes separados. São 62 objetos no Jardim e 59 na Cidadela, com árvores nas bordas, pedras extras e ruínas. A cripta tem 15 objetos e uma parede dividindo as câmaras, com passagem central controlada pelo puzzle.

O desenho segue esta ordem: chão, galhos baixos e sombras, depois objetos altos e personagens ordenados pela posição dos pés. Ao passar ao norte de uma árvore, o personagem fica atrás da copa; ao passar ao sul, aparece à frente. A copa não bloqueia movimento: a colisão fica na base do tronco. Inimigos usam a mesma regra visual, no solo e no cooperativo.

`client/scenery.mjs` define tipo, posição, largura, ponto de apoio e base de colisão de cada objeto. Edite `SCENERY` para distribuir objetos e `PROP_TYPES` para ajustar suas dimensões. O editor administrativo mostra os objetos sobre o piso e permite ocultar essa camada para inspecionar o chão. Mudanças nos polígonos não movem as imagens dos objetos.

A configuração antiga do cenário é migrada uma vez: as colisões antigas são substituídas pelas bases dos novos objetos, mantendo os ajustes de dificuldade. A cópia anterior fica em `config/world-settings.json.before-layers.bak`. Saves solo e identidades multiplayer do nome antigo são copiados automaticamente para as novas chaves do navegador; campanhas simultâneas são conciliadas pela data de atualização. Os arquivos originais não são apagados.

## Painel de administração

Abra **http://localhost:3000/admin.html** no PC que executa o servidor, ou use o link no menu. O painel não permite administrar pela rede local.

- Escolha um dos mapas e um objeto. Arraste seus vértices, mova o polígono inteiro ou edite as coordenadas exatas. A ferramenta de retângulo cria uma colisão ao arrastar; a de polígono recebe cliques nos cantos e termina em **Concluir polígono**.
- Use a grade para alinhar posições, o botão de colisões para comparar com a arte, ou duplique/exclua objetos. Para adicionar ou remover vértices, edite as linhas X, Y. **Aplicar vértices** transfere o texto ao desenho.
- **Desfazer/Refazer** recupera alterações locais. É possível restaurar um mapa, restaurar todos os padrões, exportar/importar JSON e descartar alterações.
- Ajuste vida, velocidade, dano, alcance, tempo de aviso e intervalo de ataque de cada inimigo. Também há velocidade e multiplicador de dano do jogador, distância de perseguição e presets Tranquilo, Original e Desafiador.
- **Salvar e aplicar** publica as mudanças: cooperativo recebe imediatamente; solo consulta a configuração a cada cinco segundos. Inimigos mortos continuam mortos e inimigos vivos preservam a proporção de vida durante a alteração.

O servidor rejeita números fora dos limites, polígonos cruzados ou sem área e colisões sobre entradas, fogueiras, portais ou pontos dos inimigos. Configurações persistem em `config/world-settings.json`, com a versão anterior em `.json.bak`; `SETTINGS_DIR` permite outro diretório. Para recuperar a cópia anterior, importe o arquivo `.bak` pelo painel (renomeie uma cópia para `.json`) e salve. Publicações concorrentes são rejeitadas para evitar sobrescrever outro painel.

![Editor de colisões e dificuldade](docs/painel-admin.jpg)

## Organização

- `client/world.mjs`: mapas, polígonos de colisão, portais, pontos de surgimento e tipos de inimigos. As coordenadas dos objetos e colisões usam diretamente o mundo de 2048 × 2048 unidades. Posição de atores é o centro dos pés; a colisão não depende das dimensões da arte.
- `client/engine.mjs`: simulação compartilhada pelo navegador solo e pelo servidor cooperativo, em passos de 1/60 s.
- `client/app.mjs`, `style.css`, `index.html`: desenho, controles, menus e história. `game.js` é o ponto de entrada.
- `client/save.mjs`: formato versionado e validação do salvamento solo.
- `api/server.js`: arquivos estáticos, salas, validação de entrada e snapshots a 20 Hz.
- `client/collisions.json`: arquivo Tiled antigo mantido como referência; as bases ativas são geradas por `scenery.mjs`, com alterações do admin aplicadas por `settings.mjs`.

Os sprites animados dos jogadores recebem as cores dos equipamentos por região. Os seis tipos de inimigo usam artes em perspectiva top-down, em `client/sprites/*-topdown.png`. As fogueiras usam `bonfire-unlit.png` e `bonfire-lit.png`, ambos com transparência. Há uma imagem por tipo de inimigo, com movimento leve aplicado no desenho; não são folhas de animação direcional. Os prompts estão em `client/sprites/topdown-prompts.json` e `client/sprites/expansion-prompts.json`.

Os três pisos ativos têm **1254 × 1254** pixels, sem objetos ou marcas embutidas. As imagens antigas permanecem somente como referência. O mundo lógico continua com 2048 × 2048 unidades. A geometria de colisão é independente da resolução da imagem. Galhos caídos são decorativos; árvores e construções têm arte e colisão independentes. Logo e objetos foram gerados com imagegen; prompts e caminhos estão em `client/sprites/layers-prompts.json` e `client/sprites/expansion-prompts.json`.

- `client/settings.mjs`: validação e aplicação compartilhada de colisões e dificuldade.
- `client/admin.html`, `admin.mjs`, `admin.css`: editor visual.
- `api/admin.mjs`: acesso local, publicação e persistência das configurações.
- `docs/`: captura animada da fogueira e imagem do painel.

## Verificação

`npm test` cobre alcance e direção de ataques, esquiva, colisões e caminhos, portais, chefes, salas reais Socket.IO, saves separados, reinício do servidor, fogueiras persistentes e publicação administrativa com controle de acesso e revisão. Os testes também cobrem profundidade, passagem sob copas, acesso ao castelo, runas, bloqueio do selo, seis armas, energia, defesa por armadura e migração dos saves. O painel, os cenários e o menu de equipamentos foram conferidos no navegador.

## Compatibilidade da expansão

Configurações de duas fases são migradas para três, mantendo colisões personalizadas e dificuldade e acrescentando as novas bases. O backup fica em `config/world-settings.json.before-dungeon.bak`. Saves antigos preservam guardiões vencidos e recebem os sete inimigos da cripta; a vitória final passa a exigir Custódio e puzzle concluído. Fogueiras anteriores são preservadas; a da nova fase começa apagada.

`client/equipment.mjs` define armas, conjuntos por classe e desbloqueios. Puzzle e projéteis são simulados em `engine.mjs`; todos na sala compartilham a sequência de runas e a abertura do selo.
