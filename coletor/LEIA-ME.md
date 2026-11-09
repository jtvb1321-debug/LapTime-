# Coletor de decoders

Programa pequeno (Node 18+, sem dependências) que roda no computador ligado à
rede do decoder, lê as passagens dos transponders e as envia ao Grid Lap
(`/api/cronometragem/passagens`). Funciona como um leitor de código de barras:
o aparelho "bipa", a passagem aparece na tela em `/admin/cronometragem`.

```
decoder ──(rede)──► coletor ──(HTTP + token)──► Grid Lap ──► tela / resultados
```

## Agente do computador da pista (detecção automática)

Para o sistema **achar o decoder sozinho** quando ele é ligado ao computador da
pista, esse computador roda o agente (`agente.mjs`). Ele só **observa**: consulta
o sistema operacional (dispositivos USB, portas seriais e a tabela ARP da rede)
e avisa o Grid Lap a cada poucos segundos. Não captura pacotes, não abre portas e
não envia nada aos aparelhos.

**Jeito mais simples: o executável.** `npm run agente:exe` gera
`coletor/dist/GridLap-Agente.exe` (~100 MB, Windows x64, sem instalar Node).
Copie o arquivo para o computador do decoder e dê duplo clique: na primeira vez
ele pergunta o endereço do sistema e o código de pareamento, liga o computador
ao sistema e começa a vigiar (guarda a chave em `agente.json` e o registro em
`GridLap-Agente.log`, na pasta do `.exe`). Nas próximas vezes só vigia. Também
oferece iniciar junto com o Windows. O executável não é assinado: o Windows pode
avisar na primeira execução ("Mais informações → Executar assim mesmo"). Para
gerar de novo depois de mudar o agente, rode `npm run agente:exe`.

Passo a passo manual (linha de comando):

1. Em `/admin/cronometragem` → Equipamentos → **Computador da pista**, gere o
   código de pareamento (vale 15 minutos, uso único).
2. No computador da pista (Node 18+):
   `node coletor/agente.mjs parear CODIGO --servidor http://endereco-do-sistema`
3. Para iniciar junto com o Windows (uma vez):
   `powershell -ExecutionPolicy Bypass -File coletor\instalar-agente.ps1`
   (desfaz com `-Remover`; só cria um arquivo na pasta Inicializar do seu usuário).
4. Na tela, desconecte o decoder e clique em **Registrar o que está ligado
   agora**. Ao conectar o decoder, ele aparece em destaque ("Apareceu depois do
   registro"); clique em **Este é o decoder** e dê um nome. Dali em diante o
   sistema o reconhece sozinho sempre que ele for ligado (mesmo em outra porta USB).

`node coletor/agente.mjs ver` mostra o que o computador enxerga, sem enviar nada.
O arquivo `coletor/agente.json` guarda o token do computador: não compartilhe.

**Limite importante:** isso identifica _que_ o decoder foi ligado e _qual_
aparelho é. **Ler as passagens** continua dependendo de conhecer o protocolo do
CalX Pro (veja abaixo); enquanto não houver driver, a detecção não traz tempos.

## CalX Pro: plug-and-play

O driver `drivers/calx-pro.mjs` lê o CalX Pro (conversor serial→rede Eport-EP20
dentro dele) pela porta TCP **5100**, em texto, **só leitura** (nunca envia nada
ao decoder). O agente liga tudo sozinho, sem token e sem `config.json`:

1. **Detecta** o decoder: pelo MAC conhecido (`34:ea:e7:57:78:41`) ou, na faixa do
   cabo (`192.168.137.0/24`; outras em `GRIDLAP_FAIXAS_DECODER`), qualquer
   aparelho novo que mande `xCALXPRO` na porta 5100 em até ~6 s.
2. **Cadastra** o decoder no sistema (`POST /api/cronometragem/coletor/decoder`,
   autenticado pelo token do computador): cria o decoder uma vez por computador e
   devolve a chave dele (guardada em `decoder-calx.json`).
3. **Lê** e envia as passagens pela fila segura (`fila-calx.jsonl`); o IP pode
   mudar a cada DHCP (o MAC é procurado de novo a cada conexão). Cópias locais:
   `capturas/calx-*.log` (bytes brutos) e `passagens/AAAA-MM-DD.csv`.

Protocolo (captura real, `tests/fixtures/calx-pro-captura-real.log`): cada
mensagem = SOH + campos separados por TAB + CR LF, último campo `xCALXPRO`;
passagem `@ <decoder> <seq> <transponder> <tempo_s> <leituras> <força> <estado>`
e sinal de vida `$ <decoder> <seq> <ruído> 0` a cada ~4,7 s. O `tempo_s` é o
tempo desde que o decoder ligou: a hora real usa a menor diferença
"chegada − tempo"; se o tempo volta, o decoder reiniciou e a referência
recomeça. O mesmo transponder em menos de 3 s é leitura dupla e é ignorado; o
servidor ainda recebe `eventoExterno = calx-<decoder>-<seq>-<tempo>`.

**Ligação física:** decoder → cabo de rede → adaptador USB-Ethernet (TP-Link,
`VID_2357&PID_0601`) → PC. O decoder pede IP por DHCP; sem DHCP ele cai em
`169.254.x` e o Windows não alcança. Rode **uma vez, como administrador**,
`Preparar rede do decoder.cmd` (ativa o Compartilhamento de Internet Wi-Fi →
placa do decoder; a placa fica `192.168.137.1`). Se o agente vir o adaptador com
IP `169.254.x`, a tela Equipamentos mostra o aviso. (O Grid Lap em si **não**
roda como administrador: o PostgreSQL recusa.)

**Teste sem o aparelho:** `Testar Decoder (simulador).cmd` sobe um decoder de
mentira (`calx.mjs simular`) em `127.0.0.1:5100` e aponta o agente para ele
(`calx-host.txt`, ou a variável `GRIDLAP_CALX_HOST`). Em até 1 minuto a tela
mostra o "Decoder CalX Pro" conectado (marcado SIMULADO) com as passagens.

**Diagnóstico** (`node agente\calx.mjs ...`): `achar`, `portas IP`, `gravar IP
PORTA`, `ouvir`, `tudo`, `configurar` (modo manual com token: cria
`config.json`; com ele o agente deixa a leitura para o `coletor.mjs`) e
`simular`.

## O que existe e o que NÃO existe

- Existe: o caminho completo (fila segura, envio, banco, tela), a busca de
  aparelhos na rede, um driver genérico de **texto por TCP**, um **simulador** e
  um **gravador** para estudar protocolos.
- **CalX Pro:** existe driver (`drivers/calx-pro.mjs`), baseado em captura real
  do aparelho (veja a seção acima). Outras marcas continuam sem driver.
- "Qualquer decoder" vale para os que (a) se conectam por rede/TCP e (b) têm um
  driver. O driver genérico cobre os que mandam **uma linha de texto por
  passagem**; os demais pedem um driver próprio (um arquivo pequeno).

## Começar (sem equipamento): simulador

1. Em `/admin/cronometragem`, cadastre um decoder com o driver "Simulador" e
   copie o token (aparece uma única vez).
2. Crie `coletor/config.json`:

   ```json
   {
     "servidor": "http://localhost:3001",
     "token": "gl_dec_…",
     "driver": "simulador",
     "aceleracao": 10
   }
   ```

3. `node coletor/coletor.mjs rodar` — as passagens `SIM1001…` aparecem na tela.

## Conectar um decoder real

1. Ligue o computador na rede do decoder.
2. Procure o aparelho:

   ```
   node coletor/coletor.mjs descobrir                         (só observa)
   node coletor/coletor.mjs descobrir --udp 9000 --segundos 15 (escuta UDP)
   node coletor/coletor.mjs descobrir --ativo --interface "Ethernet 4"
   ```

3. Preencha `coletor/config.json` (modelo: `exemplo.config.json`) com o endereço
   encontrado. Com `"host": "auto"` e `"faixa"`/`"interface"`, o coletor procura
   sozinho o aparelho que o driver reconhece e reconecta se ele mudar de IP.
4. `node coletor/coletor.mjs rodar`.

### Cuidados com a busca

- A parte passiva (tabela ARP, escuta UDP) não envia nada.
- `--ativo` abre conexões TCP nas portas candidatas **da faixa que você
  indicar** e só espera o que o aparelho mandar sozinho (não envia dados).
  Decoders que aceitam **um programa por vez** podem tratar essa conexão como o
  programa: faça fora de corrida e com o LapTime (ou equivalente) fechado.
- Faixas maiores que /22 são recusadas.

## Estado da conexão e diagnóstico

A cada ~10 s o coletor manda um batimento com o **estado da ligação com o
decoder** (conectado ou não, último erro) e, quando acontecem, os eventos de
conexão (coletor iniciado, decoder conectado/desconectado, erro). O painel
`/admin/cronometragem` usa isso para distinguir três situações:

| Painel mostra                       | Significa                                                               |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Decoder conectado                   | coletor ativo e ligado ao decoder                                       |
| Coletor ativo, decoder desconectado | o coletor fala com o sistema, mas perdeu o decoder (veja o último erro) |
| Coletor offline                     | o sistema não recebe sinal do coletor há mais de 30 s                   |

Um driver informa isso chamando `conectado(true|false)` e `erro("mensagem")`
(o `linhas-tcp` já faz, e reconecta sozinho com espera crescente de 2 a 30 s).
Cada passagem pode levar também `eventoExterno` (identificador do evento no
equipamento, quando existir): o sistema ignora repetições dele.

## Garantias de entrega

Cada passagem é gravada em `coletor/fila.jsonl` antes de ser enviada e só sai de
lá quando o sistema confirma. Se a rede ou o servidor cair, o coletor reenvia
depois; o sistema ignora passagens repetidas (mesmo decoder + transponder +
instante). O registro de passagens no banco é somente de inclusão.

## Estudar um decoder novo

1. Cadastre-o com o driver "Gravador" e rode o coletor com
   `"driver": "gravador"`, `host` e `porta` do aparelho (com o outro programa
   fechado). Ele só **recebe** e grava tudo em `coletor/capturas/*.log`
   (hora, hexadecimal, texto).
2. Passe transponders na antena durante a gravação e anote o que passou (qual
   transponder, em que momento).
3. Com o arquivo e as anotações dá para ver se é texto (use o driver genérico
   com o `formato` certo) ou binário (escreva um driver).

## Escrever um driver

Crie `coletor/drivers/minha-marca.mjs`, exporte `driver` e registre em
`drivers/index.mjs`:

```js
export const driver = {
  id: "minha-marca",
  nome: "Minha marca",
  portasComuns: [], // portas TCP que a busca deve testar
  reconhece(bytes, config) {
    return false;
  }, // bytes que o aparelho manda sozinho → é ele?
  async iniciar(config, { emitir, conectado, erro, log }) {
    // abre a conexão, decodifica e, a cada passagem:
    emitir({ transponder: "1312815", instanteMs: 1761500000123, forca: 98 });
    conectado(true); // enquanto estiver ligado ao aparelho
    return { parar() {} };
  },
};
```

Sem `instanteMs`, a passagem leva a hora em que o coletor a recebeu (marcada
com `*` na tela). Use a hora do decoder sempre que ele a informar.

## Arquivos

| Arquivo                                  | Para quê                              |
| ---------------------------------------- | ------------------------------------- |
| `coletor.mjs`                            | comandos `descobrir` e `rodar`        |
| `descoberta.mjs`                         | busca passiva (ARP/UDP) e ativa (TCP) |
| `envio.mjs`                              | fila em disco, envio, batimento       |
| `drivers/`                               | simulador, texto por TCP, gravador    |
| `config.json`, `fila.jsonl`, `capturas/` | locais (não versionados)              |
