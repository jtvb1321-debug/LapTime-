# Motor de cronometragem do Grid Lap

Este documento descreve o que existe, como funciona, as decisões tomadas e —
principalmente — **o estado real da integração com o decoder**.

## 1. Estado real da integração com o decoder (leia primeiro)

| Item                                           | Situação                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decoder físico (CalX Pro / "TranX" no LapTime) | **Não conectado.** Nenhum teste foi feito com o equipamento real.                                                                                |
| Protocolo, porta, formato das mensagens        | **Desconhecidos.** O fornecedor (Sisecom) não fornece documentação. Nada foi inventado.                                                          |
| Adaptador específico do CalX Pro               | **Não existe.** Só a interface de integração e os adaptadores genéricos.                                                                         |
| Adaptadores incluídos                          | `linhas-tcp` (genérico, configurável), `gravador` (estudo de protocolo), `simulador` (testes — sempre identificado como **SIMULADO** nas telas). |

Evidências coletadas no computador da pista (somente leitura, em 26/10/2026):

- O LapTime (Sisecom) guarda os dados em SQL Server local; o `LapTime.Server`
  escuta só em `127.0.0.1:18113` para a própria tela do LapTime.
- O Windows **não lista nenhum dispositivo USB nem porta COM de decoder**; só o
  adaptador USB-Ethernet (TP-Link) e periféricos comuns.
- No cabo do adaptador TP-Link chegam avisos _broadcast_ de ~342 bytes a cada
  ~3 s (compatíveis com um pedido de DHCP — **não confirmado**) e nenhum
  aparelho respondeu por IP.
- Um dispositivo USB que **falhou ao conectar** (`VID_0000&PID_0001`) esteve na
  porta 13 em 23/10/2026 (16:28–17:43). Pode ou não ser o decoder.
- O `LapTime.Server` não tinha conexão com nenhum aparelho no momento da coleta
  (decoder desligado do LapTime ou sem evento em andamento).

### Informações que ainda precisam ser obtidas do decoder

1. Por qual meio físico o decoder fala com o computador (rede/Ethernet, USB,
   serial, Bluetooth).
2. IP/porta (ou COM/baud) usados pelo LapTime — está em "Registro de Decoder".
3. Formato e enquadramento das mensagens (texto ou binário, delimitadores,
   checksum).
4. Se a mensagem traz o **horário da detecção** (e em que resolução/unidade) ou
   só o instante de recebimento; se há identificador de evento.
5. Formato do identificador do transponder (tamanho, zeros à esquerda, letras).
6. Se o decoder aceita **mais de um cliente ao mesmo tempo** (hoje parece aceitar
   um programa por vez: o coletor não pode dividir o decoder com o LapTime).
7. Comportamento em reinício/queda (reenvia passagens? mantém relógio?).

### Procedimento para testar a integração física (quando houver alguém na pista)

Fora de corrida e com o LapTime **fechado**:

1. Cadastrar o decoder em `/admin/cronometragem` (driver "Gravador").
2. No computador ligado ao decoder: `node coletor/coletor.mjs descobrir` e, se
   preciso, `--ativo --interface "<placa>"` (veja `coletor/LEIA-ME.md`).
3. Com `host`/`porta` achados, rodar o coletor com `"driver": "gravador"`,
   passar 2 ou 3 transponders pela antena e anotar quem passou e quando.
4. Com o arquivo em `coletor/capturas/` e as anotações: se for texto, configurar
   o `formato` do driver `linhas-tcp`; se for binário, escrever um driver
   (`coletor/LEIA-ME.md`, "Escrever um driver").
5. Só então trocar para o driver real, conferir passagens e horários contra o
   LapTime numa corrida de teste e registrar o resultado aqui.

Enquanto isso não for feito, **a integração com o decoder real não está
validada**.

## 2. Arquitetura

```
decoder ──(rede/USB/serial)──► coletor (drivers) ──HTTP + token──► /api/cronometragem/passagens
                                                                          │
                                       passagem (imutável) ◄──────────────┤  evento_rejeitado, decoder_evento
                                                │
                              motor (funções puras: lib/cronometragem/motor.ts)
                                                │
                     corrida / classificação / histórico / correções ──► telas (atualização a cada 2 s)
```

- **Camada de comunicação** (`coletor/`): separada do negócio. Cada driver abre a
  conexão, decodifica e entrega `{transponder, instanteMs?, forca?, eventoExterno?}`.
  Trocar de equipamento = novo driver, sem tocar no motor.
- **Entrada** (`app/api/cronometragem/passagens`): autenticada por token **por
  decoder** (hash SHA-256 no banco, revogável). Valida, grava, ignora reenvios e
  guarda o que rejeitou.
- **Motor** (`lib/cronometragem/motor.ts`): funções **puras** (sem banco, sem
  relógio). Entrada: configuração da corrida, participantes, passagens brutas e
  correções. Saída: o que aconteceu com **cada** passagem e a classificação.
- **Estado** (`lib/cronometragem/corridas-store.ts`): máquina de estados,
  vínculos, correções, relógio.
- **Telas** (uma entrada no menu, três abas): **Ao vivo** (`/admin/cronometragem`),
  **Corridas** (`/corridas`, `/corridas/[id]`) e **Equipamentos** (decoders em
  `/equipamentos`, `/transponders`, `/karts`).

### Tempo real

Não havia WebSocket/SSE no projeto. As telas se atualizam sozinhas por
`router.refresh()` a cada 2 s (5 s na lista) enquanto a aba está visível. O
contador regressivo é animado no navegador **a partir do prazo e do relógio do
servidor**, corrigido a cada atualização; o navegador nunca é a fonte da
verdade. Se for preciso latência menor, basta trocar o mecanismo (SSE) sem mudar
o motor.

## 3. Decisões técnicas importantes

1. **Voltas são derivadas, nunca gravadas.** O banco guarda só "o sensor X
   passou no instante Y" (imutável). Voltas, melhor volta e posição são sempre
   recalculadas. Assim passagem fora de ordem, reenvio e correção se resolvem
   sozinhos e o original nunca muda.
2. **Milissegundos inteiros.** Cada instante é arredondado a ms antes de
   qualquer subtração (sem acumular ponto flutuante). O instante vem do banco
   como `timestamptz` (µs) e é lido como `round(epoch*1000)`.
3. **Nada some em silêncio.** Toda passagem recebe um status e um motivo no
   motor (`largada`, `volta`, `volta_final`, `duplicada`, `antes_da_largada`,
   `depois_do_fim`, `apos_bandeira`, `invalidada`, `sem_participante`). Itens
   inválidos do coletor vão para `evento_rejeitado`.
4. **Horário da detecção preservado.** Se o driver informa `instanteMs`, é ele
   que vale (`relogio = 'decoder'`). Se não informa, o coletor marca o instante
   de recebimento e a passagem fica com `relogio = 'coletor'` (aparece com `*`
   nas telas). O sistema avisa quando o relógio do decoder destoa do servidor
   (mediana de `recebido_em − instante` > 5 s).
5. **Sem regra esportiva presumida.** Intervalo mínimo, regra de largada e
   encerramento são configuráveis por corrida (padrões em §6).
6. **Uma pista, um decoder, uma corrida ativa** (índice único parcial).
7. **Relógio da corrida no servidor.** Prazo = início + duração, persistido.

## 4. Banco de dados

Migrações aditivas (nenhum dado existente é apagado):

| Migração                           | Conteúdo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0004_cronometragem`               | `decoder` (token em hash), `transponder`, `passagem` (**imutável**, única por decoder+transponder+instante).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `0005_corrida`                     | `corrida`, `corrida_piloto`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `0006_motor_cronometragem`         | Transponder (id interno, modelo, status, observações, `cadastrado`), `kart`, `config_cronometragem` (modelo de vínculo), estado/diagnóstico do decoder (`conectado`, `ultimo_erro`, `ultimo_ip`), `decoder_evento`, `evento_rejeitado`, `passagem.evento_externo` (único por decoder), 6 estados da corrida + regras + `resultado_final` (jsonb), kart/modelo na participação, `correcao_passagem` (**só pode ser anulada**, nunca apagada nem reescrita). Estados antigos renomeados (`aguardando→preparada`, `encerrada→finalizada`). |
| `0007_bateria_por_kart`            | `corrida_piloto.nomeado` (kart que entrou sozinho e ainda não tem nome), modelo de vínculo padrão = `kart`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `0008_sensores_do_kart`            | `kart_sensor` (histórico de sensores de cada kart; um sensor só pode estar ativo em um kart) e `corrida_piloto.sensores_extras` (outros sensores do mesmo kart lidos na bateria).                                                                                                                                                                                                                                                                                                                                                       |
| `0009_termo_digital_e_responsavel` | `cliente.numero` (número de cadastro sequencial), `corrida.responsavel_cliente_id`, `termo_aceite` (+ canal, assinatura PNG, hash do texto, documento, aparelho) e `termo_convite` (link de assinatura por cliente, com validade).                                                                                                                                                                                                                                                                                                      |
| `0010_computador_da_pista`         | `coletor_pareamento` (código de uso único), `coletor_computador` (token em hash, inventário, base) e `dispositivo_decoder` (perfil confirmado pelo operador).                                                                                                                                                                                                                                                                                                                                                                           |
| `0011_pilotos_da_reserva_e_fases`  | `reserva_piloto` (pilotos de cada reserva, com cadastro), `caixa_movimento.reserva_piloto_id` (pagamento por piloto), `corrida.fase`/`classificacao_id` (classificação e corrida) e `corrida_piloto.posicao_grid`; o índice de uma corrida por horário da agenda passa a ser por horário e fase.                                                                                                                                                                                                                                        |

Nomes em português seguindo o resto do projeto (equivalência com a sugestão do
pedido): `transponder`≈transponders, `decoder`≈decoder_devices,
`corrida`≈race_sessions, `corrida_piloto`≈race_participants,
`passagem`≈timing_events, voltas ≈ derivadas do motor (não há `lap_records`).

**Retenção:** `evento_rejeitado` e `decoder_evento` (diagnósticos) são apagados
após 90 dias por uma rotina diária do servidor. O texto bruto é limitado a 400
caracteres. `passagem`, `correcao_passagem` e `audit_log` são histórico e nunca
são apagados.

## 5. Modelo interno do evento de passagem

| Campo (pedido)                       | Onde está                                                                |
| ------------------------------------ | ------------------------------------------------------------------------ |
| Identificador único                  | `passagem.id`                                                            |
| Identificador externo do transponder | `passagem.transponder` (**texto**; zeros à esquerda preservados)         |
| Horário original da detecção         | `passagem.instante` (+ `relogio`: `decoder` ou `coletor`)                |
| Horário de recebimento               | `passagem.recebido_em`                                                   |
| Equipamento                          | `passagem.decoder_id`                                                    |
| Corrida                              | derivada pela janela de tempo e pelo vínculo (uma corrida ativa por vez) |
| Metadados técnicos                   | `forca`, `bruto` (≤ 400 car.), `evento_externo`                          |

## 6. Regras configuráveis (por corrida)

| Regra                            | Opções                                                                 | Padrão              |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| Duração                          | 1–240 min                                                              | 12 min              |
| Tempo mínimo entre leituras      | 1–600 s                                                                | 10 s                |
| Largada                          | `primeira_passagem` (a 1ª leitura é a largada) ou `largada_da_corrida` | `primeira_passagem` |
| Encerramento                     | `manual`, `proxima_passagem`, `corte_imediato`                         | `manual`            |
| Espera máxima (próxima passagem) | 0–3600 s                                                               | 120 s               |

Os padrões são só pontos de partida: **confirme com a regra real da pista**. O
intervalo mínimo depende do traçado e da velocidade dos karts — não existe
valor universal.

## 7. Máquina de estados

`preparada → pronta → em_andamento → encerrando → finalizada`, e `cancelada` a
partir de qualquer estado anterior a `finalizada`.

- **preparada**: grid em montagem. **pronta**: grid confirmado (todos com
  transponder ativo); qualquer mudança no grid volta para `preparada`.
- **em_andamento**: iniciada pelo operador (só a partir de `pronta`).
- **encerrando**: o tempo acabou (o servidor marca o instante exato do prazo) ou
  o operador deu a bandeira. O que acontece depois depende do encerramento
  configurado.
- **finalizada**: grava `encerrada_em` e o **resultado publicado**
  (`resultado_final`). Correções posteriores são aplicadas à classificação atual
  e o painel avisa que ela difere da publicada.
- Cancelar exige motivo e fica auditado.

O relógio roda no servidor (`lib/cronometragem/relogio.ts`, iniciado em
`instrumentation.ts`): a cada segundo chama `avancarCorridas()`, que é
idempotente e só lê o banco. Depois de uma reinicialização ela retoma a corrida
de onde está. Também é chamada ao abrir a tela e a cada passagem recebida.

## 8. Vínculo transponder ↔ kart ↔ piloto

Dois modelos, escolhidos em `/admin/cronometragem/transponders`:

- **Do piloto (B)** — o operador vincula o sensor ao piloto (lista de sensores
  lidos ou "capturar o próximo sensor", como bipar um código de barras); o kart
  usado é só registrado.
- **Do kart (A)** — o transponder é fixo no kart (`kart.transponder_fixo`); o
  piloto escolhe o kart e o sensor vem dele.

Regras: o mesmo sensor não vai a dois participantes de corridas abertas (nem da
mesma corrida); o mesmo kart pode correr com pilotos diferentes em corridas
diferentes; **a participação grava o transponder, o kart e o modelo usados
naquela corrida** — mudar o cadastro depois não altera o histórico;
transponder inativo/em manutenção não pode ser vinculado; sensores
desconhecidos geram alerta. Toda alteração de vínculo vai para `audit_log`. Não
se troca o modelo com corrida ativa.

## 9. Correções administrativas e auditoria

- **Invalidar passagem** e **inserir passagem manual** (permissão
  `resultado.corrigir`: admin e fiscal). A passagem original permanece; a
  correção guarda quem, quando e por quê, e só pode ser **anulada** (com motivo).
- O banco recusa apagar passagens e correções, e recusa reescrever correções.
- Início/fim/cancelamento de corrida, vínculos, cadastros e correções são
  registrados em `audit_log` (somente inclusão).

## 10. Segurança

- Configuração de decoders, transponders e karts: só `equipamento.administrar`
  (administrador). Operar corrida: `sessao.operar` / `prova.iniciar_encerrar`.
  Ver: `cronometragem.ver` (admin, fiscal, operador).
- O endpoint de passagens exige o token do decoder (não aceita cookie de
  usuário). Token mostrado uma única vez; só o hash fica no banco; pode ser
  renovado (invalida o anterior).
- O IP de origem é registrado (`decoder.ultimo_ip`, quando o servidor recebe o
  cabeçalho). **Não há restrição por IP**: a defesa é o token — use HTTPS ou a
  rede local da pista.
- Tokens e senhas não são enviados ao navegador.

## 11. Testes

`npm test` (Vitest; os testes de banco precisam de `TEST_DATABASE_URL`):
motor puro (`tests/motor.test.ts`), fluxo completo no banco
(`tests/corridas.test.ts`), entrada de dados, coletor e API
(`tests/cronometragem.test.ts`). Os dados são fictícios. **Nenhum teste
automatizado valida o equipamento físico.**

## 12. Limitações conhecidas

- Sem driver do CalX Pro; sem validação física.
- Atualização por consulta periódica (2 s), não por push.
- O decoder aceita (provavelmente) um programa por vez: o Grid Lap não pode
  dividir o decoder com o LapTime; substituí-lo exigiria o driver e a
  desinstalação/ desligamento do LapTime na pista.
- Sem restrição por IP no endpoint.
- Classificação só para corrida **por tempo** (voltas válidas, depois ordem de
  chegada). Outras modalidades pedem outra regra de ordenação.
- O vínculo ao cadastro de pilotos do campeonato (`piloto`) não foi feito: a
  participação usa nome (e cliente quando vem da agenda).

## 13. Roteiro de teste local (com o simulador)

Pré-requisitos: sistema em `http://127.0.0.1:3001` (login de demonstração
`admin@gridlap.com.br`, qualquer senha) e `coletor/config.json` apontando para
um decoder de teste com o driver "Simulador" (já criado neste computador).

1. **Ao vivo** (`/admin/cronometragem`) e **Equipamentos**: rode `iniciar-simulador.bat`. O decoder
   aparece como "SIMULADO" e "Decoder conectado"; as passagens `SIM1001…SIM1004`
   entram em "Últimas passagens". Pare o simulador: em ~30 s vira "Coletor offline".
2. **Equipamentos → Transponders**: os `SIM…` aparecem como "Desconhecido". Abra um, cadastre
   (nome "Kart 1", situação Ativo).
3. **Corrida**: em _Corridas → Nova corrida_, duração 2 min, tempo mínimo 5 s,
   encerramento "Cada piloto termina na próxima passagem". Adicione 2 pilotos.
4. **Vínculo**: em cada piloto use "Capturar próximo sensor" (com o simulador
   rodando) ou "Vincular" na lista de sensores lidos.
5. **Marcar como pronta → Iniciar corrida**: acompanhe o contador, a
   classificação e o histórico (cada leitura com situação e motivo).
6. **Fim**: no fim do tempo a corrida vira "Encerrando" e finaliza sozinha quando
   todos cruzam a linha. Confira o "Resultado final".
7. **Correção**: no histórico, "Invalidar" uma passagem (com motivo) e veja a
   classificação mudar e a passagem original permanecer; anule a correção.
8. **Karts**: cadastre um kart com transponder fixo, mude o modelo de vínculo
   para "do kart" e repita com a escolha do kart.

## 14. Ciclo da bateria (estilo LapTime)

O modelo padrão da instalação é o **transponder fixo no kart** (migração 0007).

1. **Antes da bateria — cada kart recebe um sensor e é cadastrado.** Em
   _Equipamentos → Karts_, o sensor aparece em "sensores lidos que ainda não são
   de nenhum kart" assim que o kart (com o sensor instalado) passa pelo
   decoder; basta digitar o número do kart. Isso é feito uma vez.
2. **Nova bateria** (um clique em _Ao vivo_ ou _Baterias_): repete as regras da
   última. Não há grid a montar nem a confirmar: **Iniciar bateria**.
3. **Depois da largada, o kart entra sozinho na classificação na 1ª passagem**
   (entra como "Kart N", sem nome). Só entram karts cadastrados e ativos, com
   transponder ativo.
4. **Depois da 1ª passagem, dá-se o nome do piloto** ao kart, na própria
   classificação (digitado, ou escolhido na lista de pilotos da bateria, que
   vem das reservas da agenda). O nome também pode ser corrigido depois que a
   bateria terminou.
5. **Durante a bateria**: classificação ao vivo, **volta a volta ao vivo** (uma
   coluna por piloto, a volta mais recente no topo) e o tempo restante do
   relógio do servidor.
6. **Ao fim** (finalizada): painel "Relatórios da bateria" com PDF de
   **Qualificação (melhor volta)**, **Volta a volta**, **Resultado final** e o
   **Relatório completo** (os três juntos): abrir/imprimir ou baixar. As mesmas
   três visões ficam na tela.
7. **Nova bateria** de novo: o ciclo recomeça; os karts já estão cadastrados.

Interpretação adotada: uma bateria produz as três visões (qualificação =
ordenada pela melhor volta; resultado final = voltas e ordem de chegada). Se a
pista usar uma qualificação **separada** antes da corrida (duas fases, com o
grid da corrida vindo da qualificação), isso ainda não está modelado.

Regras relacionadas: um sensor pode estar planejado em mais de uma bateria
(preparada/pronta); só não pode estar em duas ao mesmo tempo quando uma delas
está correndo, nem em dois participantes da mesma bateria.

### Pilotos novos a cada bateria

Os pilotos mudam de uma bateria para a outra; os karts e os sensores não. Na
preparação da bateria, a seção **Pilotos desta bateria** recebe vários nomes de
uma vez (um por linha; até 60, tudo ou nada: um nome inválido recusa a lista
inteira). Depois da 1ª passagem de cada kart, o nome é escolhido nessa lista.
"Nova bateria" copia só as regras: a lista de pilotos começa vazia.

### Sensor novo em um kart (sensor com problema)

Em _Equipamentos → Karts → Sensores e dados_ de cada kart:

- **Adicionar novo sensor ao kart:** o sensor precisa já ter sido lido pelo
  decoder (passe o kart com o sensor novo pela pista; ele aparece na lista) ou
  ser digitado. Com **"O sensor anterior deu problema"** marcado (padrão
  quando o kart já tem sensor), o antigo sai de uso e vai para
  _manutenção_; sem a marca, o kart passa a ter os dois sensores ativos.
- **Tirar de uso:** exige motivo; o sensor continua no histórico do kart.
- O sensor novo vira o principal (`kart.transponder_fixo`). O histórico guarda
  quem pôs/tirou, quando e o motivo, e tudo vai para `audit_log`
  (`kart.sensor_adicionar`, `kart.sensor_remover`).
- **No meio de uma bateria:** a leitura do sensor novo conta para o mesmo kart e
  o mesmo piloto (fica registrado em `sensores_extras`; o motor atribui as
  passagens dos dois sensores ao mesmo participante). Baterias já terminadas não
  mudam.
- Um sensor em manutenção ou inativo não leva ao kart e não pode ser reaproveitado
  em outro kart sem antes ser reativado em _Transponders_.

### Responsável, pilotos cadastrados e termo digital

Na preparação da bateria (seção **Responsável e pilotos desta bateria**):

- **Responsável:** quem responde pela bateria. Vem da reserva quando a bateria
  nasce da agenda; na avulsa, marca-se "É o responsável" ao cadastrar o piloto
  ou usa-se o botão na busca de cadastros.
- **Pilotos:** cada um é um cliente com **número de cadastro** (busca por número,
  nome ou telefone, ou cadastro novo na hora com nome, telefone e nascimento).
  Bateria avulsa: um por um. Bateria da agenda: o cliente da reserva é o
  responsável e o 1º piloto; as demais vagas da reserva ficam abertas ("Vaga 2
  de ...") até cadastrar o piloto (ou removê-las).
- **Termo:** em _Enviar termos (link e QR)_ cada piloto tem um link único
  (\`/assinar/<token>\`, válido por 7 dias, uso único) para abrir pelo WhatsApp
  (mensagem pronta; o sistema não envia sozinho), QR ou na própria tela do
  balcão. O cliente lê o texto, marca que concorda, informa o nome (e documento,
  opcional) e desenha a assinatura. Menor de 18 anos: assina o responsável legal.
- **Registro:** o aceite é imutável e guarda a assinatura (PNG), o hash SHA-256
  do texto assinado, a versão, IP, aparelho, canal e data/hora; o comprovante
  aparece na ficha do cliente. Se o texto do termo for atualizado no meio, a
  assinatura é recusada e o cliente relê.
- **Bloqueio:** a bateria **não inicia** enquanto houver piloto cadastrado sem
  termo válido na versão vigente, ou vaga aberta da reserva sem piloto.
  Remover o piloto/a vaga libera a bateria. A assinatura no balcão por marcação
  (ficha do cliente) continua valendo como alternativa.
- A página pública não exige login; limita tentativas por IP e por link. Para o
  link abrir no celular do cliente, configure \`URL_PUBLICA\` (ex.:
  \`https://gridlap.com.br\`); sem isso o link usa o endereço em que o operador
  está logado (ex.: \`127.0.0.1\`, que só abre no próprio computador).

Pendências externas: o texto do termo é um modelo e precisa de revisão
jurídica; a validade da assinatura eletrônica simples (desenhada + evidências)
deve ser confirmada pelo jurídico do kartódromo.

### Detecção automática do decoder (agente do computador da pista)

O agente (`coletor/agente.mjs`, ver `coletor/LEIA-ME.md`) é pareado uma vez por um
código de uso único gerado em _Equipamentos → Computador da pista_ e envia o
inventário do que está ligado (USB, portas seriais, vizinhos da rede) para
`POST /api/cronometragem/coletor/inventario` (token do computador, em hash no
banco). O sistema compara com a **base** (o que estava ligado antes) e destaca o
que apareceu depois; o operador confirma "Este é o decoder" e o perfil
(`usb:VID_xxxx&PID_yyyy`, `serial:COMn` ou `rede:mac`) fica salvo: nas próximas
vezes o decoder é reconhecido sozinho. Computador sem contato há 30 s aparece
como desconectado; "Desligar este computador" revoga o token.

O que isto **não** faz: ler passagens. Reconhecer _qual aparelho_ é o decoder não
revela o protocolo; sem o driver do CalX Pro (ainda desconhecido), não há tempos.
Segurança: só leitura do sistema operacional; endpoint de pareamento com limite
de tentativas por IP; sem acesso a nada além do inventário.

### Fluxo completo da bateria (reserva → sorteio → classificação → corrida)

1. **Reserva (agenda):** o cliente reserva N pilotos; quem reservou entra como
   piloto 1. O balcão cadastra os demais (nome, telefone, nascimento — ou o
   número de cadastro de quem já tem), cada um com número de cadastro. As
   reservas antigas foram preenchidas pela migração com o responsável como piloto 1.
2. **Pagamento por piloto:** o valor da reserva é dividido igualmente entre os
   pilotos (centavos que sobram vão para os primeiros). Ao lado de cada nome:
   _Pago · forma_, _Parcial_ ou _A pagar_. Um pagamento lançado para um piloto
   cobre aquele piloto; o lançado para a reserva toda cobre os pilotos na ordem
   do cadastro. Estorno desfaz. Recebe-se no caixa aberto (agenda ou tela da
   bateria). Bateria avulsa (sem reserva) não tem cobrança registrada.
3. **Abrir a bateria** (Cronometrar): os pilotos cadastrados entram com o nome; o
   que faltar vira vaga aberta. Cadastrar piloto na reserva depois também ocupa
   a vaga. Por padrão a bateria tem duas fases (classificação e corrida);
   "Corrida única" continua disponível.
4. **Termo:** cada piloto assina por link/QR (ver acima). Bloqueia o início.
5. **Sorteio dos karts:** cada piloto sem kart recebe, ao acaso, um kart
   disponível (ativo e com sensor); o sensor já está no kart. "Refazer o
   sorteio" recomeça. Falta de karts é avisada com os números. **Apto** = termo
   assinado + kart definido.
6. **Classificação:** inicia-se a bateria; os sensores são lidos a partir da
   largada (duração padrão 5 min, a confirmar com a pista). Ao finalizar, o
   botão **Criar a corrida** (duração escolhida na hora, padrão 12 min) gera a
   corrida com os mesmos pilotos, karts e sensores, **largando na ordem da melhor
   volta** da classificação (quem não fez tempo, atrás). A corrida é cronometrada
   à parte, e os relatórios (qualificação, volta a volta, resultado) saem de cada fase.

Limites: não existe relatório único das duas fases (cada fase tem o seu); o
sorteio decide só o kart de cada piloto (a posição de largada vem da
classificação); a divisão do valor é igual entre os pilotos.

O agente também vira um executável único (`npm run agente:exe` →
`coletor/dist/GridLap-Agente.exe`, feito com o `--build-sea` do Node): duplo clique,
primeira execução guiada (endereço + código), chave em `agente.json` e registro
em `GridLap-Agente.log` na pasta do `.exe`, opção de iniciar com o Windows. Não é
assinado digitalmente (SmartScreen/antivírus podem avisar). Requisito de rede: o
computador do decoder precisa alcançar o endereço do sistema (para teste local,
o sistema deve escutar na rede e o firewall liberar a porta; em servidor, use o
endereço publicado e configure `URL_PUBLICA`).

### Balcão simplificado (agendar e abrir a bateria)

- **Agendar numa tela só:** na agenda, "Agendar uma bateria" pede dia, hora, quem
  reservou (nome e telefone) e quantos pilotos. O horário é criado na hora (duração,
  karts por bateria e preço vêm da última bateria criada; o preço só é pedido na
  primeira vez). Não é preciso "gerar baterias do dia" (continua existindo, recolhido,
  para abrir horários a reservas feitas pelo site).
- **Agenda enxuta:** mostra as baterias com reserva; "Já encerradas" e "Horários
  livres" ficam recolhidos.
- **Abrir bateria:** um clique no cartão do horário cria (ou reabre) a bateria da
  agenda, com classificação/corrida e os pilotos reservados.
- **Bateria agora:** botão no topo da agenda e na aba Baterias; bateria sem
  agendamento, pilotos um a um.
- **Cadastro de piloto em uma linha:** nome + telefone + Adicionar (nascimento e
  "já tem cadastro" ficam recolhidos). O 1º piloto cadastrado vira o responsável;
  quem é cadastrado numa bateria da agenda ocupa a vaga aberta da reserva e passa a
  fazer parte dela (pagamento por piloto).

### Passo a passo do balcão e menu enxuto

- **/admin/balcao** (entrada do admin): mostra a bateria em foco (em andamento; senão
  a em preparação mais nova; senão a classificação recém-terminada, para criar a
  corrida; senão a última finalizada), a lista de passos com o que já foi feito e o
  **próximo passo** em destaque, "Hoje na agenda" com "Abrir bateria", e um resumo
  "Como funciona". A lógica fica em `lib/cronometragem/passo-a-passo.ts` (função pura
  `passosDoFluxo`, testada). Pagamento é passo opcional (não bloqueia).
- **Termos na tela da bateria:** enquanto a bateria não começou, o bloco "Termos
  para assinar" aparece logo abaixo do botão Iniciar, com QR, "Assinar aqui",
  WhatsApp e link de cada piloto. O link de quem ainda não assinou é criado sozinho
  ao abrir a tela (quem pode operar). A página `/termos` é a mesma lista em tela cheia.
- **Menu:** Passo a passo, Agenda, Cronometragem, Clientes e Caixa sempre à vista;
  Financeiro, Campeonato e Sistema (Dashboard, Equipamentos, Termo, Relatórios,
  Configurações) recolhidos. O dashboard passou para `/admin/dashboard`.

### Classificação (5 min) e corrida (12 min) automáticas

- A classificação nasce com **5 min** e termina **sozinha** no fim do tempo (corte
  imediato); a corrida nasce com **12 min**. Os dois tempos são editáveis em
  "Tempos (editar)" na tela da bateria (a corrida planejada, até ela ser criada;
  depois, na própria corrida). Com a bateria rodando, o novo tempo só vale se
  ainda estiver no futuro. **A CONFIRMAR com a pista:** 5 e 12 min.
- **Encerrar antes:** "Encerrar a classificação agora". **Pular:** "Pular
  classificação" (antes de iniciar) vai direto à corrida, sem tempos, com o grid
  na ordem de cadastro.
- Ao terminar a classificação (no tempo, antes ou pulada), a **corrida é criada na
  hora** (mesmos pilotos, karts e sensores; grid pela melhor volta) e a tela leva
  até ela; basta iniciar. No fim da corrida, a classificação final e os PDFs.
- Baterias criadas antes desta mudança mantêm a regra "manual" de encerramento
  (a classificação espera o clique); as novas usam o encerramento automático.
