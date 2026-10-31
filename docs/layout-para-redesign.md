# Grid Lap: modelo de layout e menus (para redesenho)

Documento para entregar ao ChatGPT (ou a um designer). Descreve **o que existe hoje**:
estrutura, menus por perfil, telas, componentes e identidade visual. Não contém
código-fonte nem dados reais.

## Prompt sugerido (cole antes do documento)

> Você é um designer de produto e front-end sênior. Abaixo está o mapa completo de telas,
> menus e padrões visuais do Grid Lap, sistema de gestão de kartódromo e cronometragem.
> Proponha um redesenho do layout e da navegação **mantendo**: todas as rotas, os perfis
> e permissões, os textos em português do Brasil e as funcionalidades. Entregue: (1) diagnóstico
> dos problemas de uso, (2) nova arquitetura de navegação, (3) sistema de design (cores,
> tipografia, espaçamento, componentes), (4) wireframes descritos das telas principais em
> desktop e celular, (5) lista de mudanças por componente, em ordem de prioridade. Não invente
> funcionalidades que não estejam listadas. Código: Next.js 16 (App Router), React 19,
> TypeScript, Tailwind CSS v4; sem bibliotecas de UI externas.

## 1. Produto e públicos

Grid Lap: kartódromo com agenda de baterias, recepção, pagamentos, termo de responsabilidade
digital, cronometragem por transponder e resultados. Há também um site público de
campeonato (hoje em grande parte com dados de demonstração).

| Perfil | O que faz | Onde trabalha |
| --- | --- | --- |
| **admin** | tudo, inclusive financeiro, termo, equipamentos, usuários | painel completo |
| **fiscal** | opera provas, aplica penalidades, corrige resultados | painel (cronometragem e campeonato) |
| **operador** | opera sessões, inicia e encerra provas | painel (cronometragem) |
| **recepcao** | balcão: clientes, agenda, caixa | painel, sem campeonato nem dashboard |
| **piloto** | nenhuma ação administrativa | site + Área do piloto |
| **visitante** | consulta o site, cadastra-se, assina o termo por link | site público |

Uso típico do painel: **balcão (computador, perto da pista) e tablet/celular** (operador
na pista, cliente assinando o termo pelo celular via QR/WhatsApp).

## 2. Áreas e estruturas de página (shells)

1. **Site público** (`(site)`): cabeçalho horizontal (logo + links + conta), conteúdo
   centralizado (largura máx. 6xl), rodapé.
2. **Painel admin** (`(admin)/admin`): barra superior fina (altura 56 px) + **menu lateral**
   (240 px, recolhível em grupos) + área de conteúdo. No celular o menu vira gaveta aberta
   por botão "hambúrguer".
3. **TV / placar** (`(tv)/tv`): tela cheia para a pista.
4. **Overlays de transmissão** (`/overlay/grid`, `/live-timing`, `/resultado`): fundo
   transparente para OBS.
5. **Páginas avulsas**: `/login`, `/assinar/[token]` (termo no celular), animação de
   entrada pós-login (grafite + linha laranja desenhando um circuito ao redor da logo).

## 3. Menu do site público (cabeçalho)

`Início · Campeonato · Pilotos · Categorias · Horários · Regulamento · Inscrição`
+ à direita: **Entrar** (visitante) ou **Minha conta** (leva a `/admin` para equipe e a
`/area-do-piloto` para piloto). No celular: menu colapsado.

Submenu da seção Campeonato: Calendário, Classificação, Live timing, Resultados, Traçados.

## 4. Menu lateral do painel (por grupos)

Item ativo: fundo tingido + texto na cor de destaque; só o item mais específico acende.
Grupos "fixos" ficam soltos; os demais são recolhíveis (abre sozinho o grupo da página atual).

**Dia a dia** (sempre visível)
- Passo a passo (`/admin/balcao`): guia do fluxo do cliente até a pista
- Agenda (`/admin/operacao/agenda`)
- Cronometragem (`/admin/cronometragem`)
- Clientes (`/admin/operacao/clientes`)
- Caixa (`/admin/operacao/caixa`)

**Financeiro** (admin)
- Relatório do dia · Fluxo de caixa · Contas a pagar

**Campeonato** (oculto para recepção)
- Campeonatos, Etapas, Pilotos, Inscrições, Pagamentos, Categorias, Traçados, Vídeo do
  traçado, Patrocinadores, Karts do campeonato, Balizamento, Baterias do campeonato,
  Live timing, Resultados, Pontuação, Punições, Recursos (17 itens)

**Sistema** (oculto para recepção)
- Dashboard, Equipamentos (decoder, karts), Termo de responsabilidade, Relatórios,
  Configurações

Problema conhecido: o campeonato tem 17 itens e usa dados de demonstração; o dia a dia do
kartódromo mistura dois conceitos de "bateria" (agenda do balcão x campeonato).

## 5. Inventário de telas (rota → finalidade)

### Balcão / operação (`/admin/operacao/*`, `/admin/balcao`)
| Rota | Tela |
| --- | --- |
| `/admin/balcao` | Passo a passo: botões "Agendar uma bateria" e "Bateria agora", agenda de hoje, "como funciona" |
| `/admin/operacao/agenda` | Agenda de baterias do dia (grade de horários, lotação, abrir bateria) |
| `/admin/operacao/reservar` | Nova reserva: cliente, pilotos, valor |
| `/admin/operacao/clientes` | Lista e busca de clientes; cadastro rápido |
| `/admin/operacao/clientes/[id]` | Ficha do cliente (termo, histórico) |
| `/admin/operacao/clientes/relacionamento` | Relacionamento/contatos |
| `/admin/operacao/caixa` e `/caixa/[id]` | Caixa aberto, pagamentos, sangria, fechamento |
| `/admin/operacao/recibo/[id]` | Recibo imprimível |
| `/admin/operacao/relatorio` | Relatório do dia |
| `/admin/operacao/financeiro` | Fluxo de caixa |
| `/admin/operacao/contas` | Contas a pagar |
| `/admin/operacao/termo` | Edição do termo de responsabilidade |

### Cronometragem (`/admin/cronometragem/*`)
| Rota | Tela |
| --- | --- |
| `/admin/cronometragem` | Visão geral e baterias recentes |
| `/admin/cronometragem/corridas` | Lista de baterias |
| `/admin/cronometragem/corridas/[id]` | **Tela da bateria**: pilotos e check-in, pagamento, termos, sorteio de karts, iniciar/encerrar, classificação ao vivo, ocorrências (DNS/DNF/DSQ/penalidade), passagens, relatório |
| `/admin/cronometragem/corridas/[id]/termos` | Termos da bateria (links/QR) |
| `/admin/cronometragem/equipamentos` | Decoder, agente do computador da pista |
| `/admin/cronometragem/karts` · `/transponders` | Cadastro de karts e sensores |

### Campeonato (admin, dados de demonstração)
`/admin/campeonatos, etapas, pilotos, inscricoes, pagamentos, categorias, tracados,
video-tracado, patrocinadores, karts, balizamento, baterias, live-timing, resultados,
pontuacao, punicoes, recursos, relatorios, configuracoes, dashboard`

### Site público
`/` (início) · `/campeonato` · `/campeonato/calendario|classificacao|live-timing|resultados|tracados` ·
`/pilotos` e `/pilotos/[slug]` · `/categorias` e `/categorias/[slug]` · `/horarios` ·
`/regulamento` · `/inscricao` · `/cadastro` · `/area-do-piloto` · `/login`

### Outras
`/tv` (placar) · `/overlay/grid|live-timing|resultado` · `/assinar/[token]` (assinatura do termo)

## 6. Identidade visual atual

- **Fundo geral:** imagem de pista (clara, bandeiras quadriculadas) sobre cinza `#f4f5f7`.
- **Superfícies:** branco `#ffffff`, bordas `#e3e6ec` / `#ccd1db`.
- **Texto:** `#171a23` (principal), `#5b6270`, `#9399a6`.
- **Cabeçalho escuro:** `#12141b`. Animação de entrada: grafite `#17191e`.
- **Cor de destaque:** o token chama-se `orange` mas hoje vale **roxo `#7c3aed`** (`#8b5cf6` suave).
  A logo e a animação de entrada usam **laranja `#f97316`**. Há inconsistência a resolver:
  decidir a cor de destaque oficial (a logo é laranja/preto).
- **Tipografia:** Inter (texto) e Roboto Mono (números, códigos).
- **Raios/sombras:** cantos `rounded-md`/`rounded-lg`, bordas finas, quase sem sombra.
- **Logo:** `logo-gridlap.webp` 2000×667, fundo **branco opaco** (não transparente).
- **Estados:** `StatusPill` (etiquetas de cor por situação), posições com `PosicaoBadge`.

## 7. Componentes existentes (reaproveitar ou redesenhar)

`PageHeader` (título + descrição + ações), `Card/CardBody`, `Button` (primary escuro,
secondary com borda, ghost), `StatusPill`, `StatCard`, `DataTable`, `Dialog`, `Avatar`,
`CategoriaBadge`, `PosicaoBadge`, `RaceBadge`, formulário de ação (`FormAcao`: botão que
mostra "feito/erro"), `AdminSidebar`, `AdminTopbar`, `SiteHeader`, `SiteFooter`.

## 8. Fluxo principal que o layout deve facilitar

Cliente entra em contato → **Agendar** (data, hora, nome, telefone, nº de pilotos) →
cadastro de cada piloto → **termo** (QR/WhatsApp, assinatura no celular) → **pagamento**
por piloto → **check-in** → **sorteio de karts** → **iniciar** (classificação 5 min, depois
corrida 12 min, automática) → **ocorrências** → **resultado e relatório**.
O balcão pediu: menos passos, menu mais simples, tudo do cliente até a pista num fluxo só.

## 9. Restrições (não mudar)

- Rotas e nomes de perfis; permissões validadas no servidor.
- Português do Brasil; datas e moeda em BRL.
- Funciona em celular (375 px) e tablet; tela do operador legível à luz do dia.
- Sem vídeo/bibliotecas pesadas; respeitar `prefers-reduced-motion`.
- Acessibilidade: foco visível, contraste AA, alvos de toque ≥ 44 px no celular.
- Sem dados pessoais reais em mockups.

## 10. O que pedir de volta

1. Nova árvore de navegação (por perfil), com no máximo ~7 itens no primeiro nível.
2. Tokens de design (cor de destaque oficial, neutros, tipografia, escala de espaçamento).
3. Wireframes (texto ou imagem) de: Passo a passo, Agenda, Tela da bateria, Clientes,
   Caixa, Login/entrada, site público (início) e placar TV, em desktop e celular.
4. Lista de componentes novos/alterados com estados (normal, hover, foco, erro, vazio, carregando).
