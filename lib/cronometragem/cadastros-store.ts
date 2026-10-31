import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { registrarAuditoria } from "@/lib/audit";
import { consultar, transacao } from "@/lib/db/conexao";
import { ErroNegocio, type Ator } from "@/lib/operacao/erros";

export type StatusTransponder = "ativo" | "inativo" | "manutencao";
export type StatusKart = "ativo" | "manutencao" | "inativo";
export type ModeloVinculo = "kart" | "piloto";

export const STATUS_TRANSPONDER: StatusTransponder[] = [
  "ativo",
  "inativo",
  "manutencao",
];
export const STATUS_KART: StatusKart[] = ["ativo", "manutencao", "inativo"];

// O identificador externo é TEXTO: preserva zeros à esquerda e qualquer
// formato que o decoder use. Só se recusa o que não cabe com segurança no banco.
export const REGEX_CODIGO = /^[A-Za-z0-9_-]{1,32}$/;

export interface Transponder {
  id: string;
  codigo: string;
  rotulo?: string;
  modelo?: string;
  status: StatusTransponder;
  observacoes?: string;
  cadastrado: boolean;
  criadoEm: Date;
  atualizadoEm: Date;
  ultimaLeituraMs: number | null;
  leituras: number;
  kartFixo?: string;
}

interface LinhaTransponder {
  id: string;
  codigo: string;
  rotulo: string | null;
  modelo: string | null;
  status: StatusTransponder;
  observacoes: string | null;
  cadastrado: boolean;
  criado_em: Date;
  atualizado_em: Date;
  ultima_leitura_ms: number | null;
  leituras: number;
  kart_fixo: string | null;
}

function transponderDeLinha(l: LinhaTransponder): Transponder {
  return {
    id: l.id,
    codigo: l.codigo,
    rotulo: l.rotulo ?? undefined,
    modelo: l.modelo ?? undefined,
    status: l.status,
    observacoes: l.observacoes ?? undefined,
    cadastrado: l.cadastrado,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
    ultimaLeituraMs: l.ultima_leitura_ms,
    leituras: l.leituras,
    kartFixo: l.kart_fixo ?? undefined,
  };
}

const SELECT_TRANSPONDER = `
  select t.id, t.codigo, t.rotulo, t.modelo, t.status, t.observacoes,
         t.cadastrado, t.criado_em, t.atualizado_em,
         (select round(extract(epoch from max(p.instante)) * 1000)::float8
            from passagem p where p.transponder = t.codigo) as ultima_leitura_ms,
         (select count(*)::int from passagem p where p.transponder = t.codigo) as leituras,
         (select k.numero from kart k where k.transponder_fixo = t.codigo) as kart_fixo
    from transponder t`;

// Busca por identificador, nome ou modelo. Os desconhecidos (lidos pelo
// decoder e ainda não cadastrados) vêm primeiro.
export async function listarTransponders(busca = ""): Promise<Transponder[]> {
  // Sem caracteres de controle (o byte nulo derruba a consulta) e com limite.
  const termo = busca
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 60);
  const linhas = await consultar<LinhaTransponder>(
    `${SELECT_TRANSPONDER}
      where $1 = '' or t.codigo ilike '%' || $1 || '%'
         or coalesce(t.rotulo, '') ilike '%' || $1 || '%'
         or coalesce(t.modelo, '') ilike '%' || $1 || '%'
      order by t.cadastrado, t.codigo
      limit 300`,
    [termo],
  );
  return linhas.map(transponderDeLinha);
}

export async function lerTransponder(
  codigo: string,
): Promise<Transponder | null> {
  const linhas = await consultar<LinhaTransponder>(
    `${SELECT_TRANSPONDER} where t.codigo = $1`,
    [codigo],
  );
  return linhas[0] ? transponderDeLinha(linhas[0]) : null;
}

export async function contarDesconhecidos(): Promise<number> {
  const [l] = await consultar<{ n: number }>(
    "select count(*)::int as n from transponder where not cadastrado",
  );
  return l.n;
}

export interface DadosTransponder {
  rotulo?: string;
  modelo?: string;
  status: StatusTransponder;
  observacoes?: string;
}

function validarDadosTransponder(d: DadosTransponder) {
  if (!STATUS_TRANSPONDER.includes(d.status)) {
    throw new ErroNegocio("Escolha a situação do transponder.");
  }
  if ((d.rotulo?.length ?? 0) > 40) throw new ErroNegocio("Nome longo demais.");
  if ((d.modelo?.length ?? 0) > 80)
    throw new ErroNegocio("Modelo longo demais.");
  if ((d.observacoes?.length ?? 0) > 500) {
    throw new ErroNegocio("Observações longas demais (máximo 500).");
  }
}

// Cadastra (ou confirma o cadastro de) um transponder. Serve tanto para
// registrar um sensor novo antes de ele ser lido quanto para "cadastrar" um
// desconhecido que o decoder já leu.
export async function salvarTransponder(
  codigoBruto: string,
  dados: DadosTransponder,
  ator: Ator,
): Promise<void> {
  const codigo = codigoBruto.trim();
  if (!REGEX_CODIGO.test(codigo)) {
    throw new ErroNegocio(
      "Identificador inválido (use letras, números, hífen ou sublinhado; até 32 caracteres).",
    );
  }
  const limpo: DadosTransponder = {
    rotulo: dados.rotulo?.trim() || undefined,
    modelo: dados.modelo?.trim() || undefined,
    status: dados.status,
    observacoes: dados.observacoes?.trim() || undefined,
  };
  validarDadosTransponder(limpo);
  await transacao(async (cliente) => {
    const { rows: antes } = await cliente.query(
      "select rotulo, modelo, status, observacoes, cadastrado from transponder where codigo = $1 for update",
      [codigo],
    );
    await cliente.query(
      `insert into transponder (codigo, rotulo, modelo, status, observacoes, cadastrado)
       values ($1, $2, $3, $4, $5, true)
       on conflict (codigo) do update
         set rotulo = excluded.rotulo, modelo = excluded.modelo,
             status = excluded.status, observacoes = excluded.observacoes,
             cadastrado = true, atualizado_em = clock_timestamp()`,
      [
        codigo,
        limpo.rotulo ?? null,
        limpo.modelo ?? null,
        limpo.status,
        limpo.observacoes ?? null,
      ],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: antes[0] ? "transponder.atualizar" : "transponder.cadastrar",
        entidade: "transponder",
        entidadeId: codigo,
        antes: antes[0] ?? undefined,
        depois: limpo,
      },
      cliente,
    );
  });
}

export interface UsoDoTransponder {
  corridaId: string;
  corridaNome: string;
  estado: string;
  participante: string;
  kartNumero?: string;
  iniciadaEm: Date | null;
}

// Em quais corridas o transponder foi usado (vínculo gravado NA corrida:
// continua certo mesmo que o cadastro mude depois).
export async function historicoDoTransponder(
  codigo: string,
  limite = 50,
): Promise<UsoDoTransponder[]> {
  const linhas = await consultar<{
    corrida_id: string;
    corrida_nome: string;
    estado: string;
    participante: string;
    kart_numero: string | null;
    iniciada_em: Date | null;
  }>(
    `select c.id as corrida_id, c.nome as corrida_nome, c.estado,
            p.nome as participante, p.kart_numero, c.iniciada_em
       from corrida_piloto p join corrida c on c.id = p.corrida_id
      where p.transponder = $1
      order by coalesce(c.iniciada_em, c.criado_em) desc
      limit $2`,
    [codigo, limite],
  );
  return linhas.map((l) => ({
    corridaId: l.corrida_id,
    corridaNome: l.corrida_nome,
    estado: l.estado,
    participante: l.participante,
    kartNumero: l.kart_numero ?? undefined,
    iniciadaEm: l.iniciada_em,
  }));
}

// ---------------------------------------------------------------- Karts

export interface SensorDoKart {
  codigo: string;
  ativo: boolean;
  adicionadoEm: Date;
  removidoEm: Date | null;
  motivoRemocao?: string;
}

export interface Kart {
  id: string;
  numero: string;
  apelido?: string;
  status: StatusKart;
  // Sensor principal (o mais recente dos ativos).
  transponderFixo?: string;
  // Histórico de sensores do kart, do mais novo para o mais antigo.
  sensores: SensorDoKart[];
  observacoes?: string;
}

export async function listarKarts(): Promise<Kart[]> {
  const linhas = await consultar<{
    id: string;
    numero: string;
    apelido: string | null;
    status: StatusKart;
    transponder_fixo: string | null;
    observacoes: string | null;
  }>(
    `select id, numero, apelido, status, transponder_fixo, observacoes
       from kart order by lower(numero)`,
  );
  const sensores = await consultar<{
    kart_id: string;
    transponder: string;
    adicionado_em: Date;
    removido_em: Date | null;
    motivo_remocao: string | null;
  }>(
    `select kart_id, transponder, adicionado_em, removido_em, motivo_remocao
       from kart_sensor order by id desc`,
  );
  const porKart = new Map<string, SensorDoKart[]>();
  for (const s of sensores) {
    const lista = porKart.get(s.kart_id) ?? [];
    lista.push({
      codigo: s.transponder,
      ativo: s.removido_em === null,
      adicionadoEm: s.adicionado_em,
      removidoEm: s.removido_em,
      motivoRemocao: s.motivo_remocao ?? undefined,
    });
    porKart.set(s.kart_id, lista);
  }
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    apelido: l.apelido ?? undefined,
    status: l.status,
    transponderFixo: l.transponder_fixo ?? undefined,
    sensores: porKart.get(l.id) ?? [],
    observacoes: l.observacoes ?? undefined,
  }));
}

export interface DadosKart {
  numero: string;
  apelido?: string;
  status: StatusKart;
  // Só no cadastro: o primeiro sensor. Depois, use adicionarSensorAoKart.
  transponderFixo?: string;
  observacoes?: string;
}

function limparKart(d: DadosKart): DadosKart {
  const numero = d.numero.trim();
  if (numero.length < 1 || numero.length > 12) {
    throw new ErroNegocio("Informe o número do kart (até 12 caracteres).");
  }
  if (!STATUS_KART.includes(d.status)) {
    throw new ErroNegocio("Escolha a situação do kart.");
  }
  const transponderFixo = d.transponderFixo?.trim() || undefined;
  if (transponderFixo && !REGEX_CODIGO.test(transponderFixo)) {
    throw new ErroNegocio("Transponder inválido.");
  }
  if ((d.apelido?.length ?? 0) > 40)
    throw new ErroNegocio("Apelido longo demais.");
  if ((d.observacoes?.length ?? 0) > 500) {
    throw new ErroNegocio("Observações longas demais (máximo 500).");
  }
  return {
    numero,
    apelido: d.apelido?.trim() || undefined,
    status: d.status,
    transponderFixo,
    observacoes: d.observacoes?.trim() || undefined,
  };
}

function traduzirErroKart(erro: unknown): never {
  const e = erro as { code?: string; constraint?: string };
  if (e?.code === "23505" && e.constraint === "kart_numero_unico") {
    throw new ErroNegocio("Já existe um kart com esse número.");
  }
  if (
    e?.code === "23505" &&
    (e.constraint === "kart_transponder_fixo_unico" ||
      e.constraint === "kart_sensor_ativo")
  ) {
    throw new ErroNegocio("Esse sensor já está em outro kart.");
  }
  if (e?.code === "23503") {
    throw new ErroNegocio(
      "Esse transponder ainda não foi lido nem cadastrado: cadastre-o primeiro.",
    );
  }
  throw erro;
}

interface OpcoesDoSensor {
  // true = o sensor anterior deu problema: sai de uso e fica "em manutenção".
  substituir: boolean;
  motivo?: string;
}

// Põe um sensor ativo no kart (e o torna o principal). O sensor vira um
// transponder cadastrado, com o nome do kart se ainda não tinha nome.
async function colocarSensorNoKart(
  cliente: PoolClient,
  kart: { id: string; numero: string },
  codigo: string,
  ator: Ator,
  opcoes: OpcoesDoSensor,
): Promise<{ removidos: string[] }> {
  const { rows: t } = await cliente.query<{ status: string }>(
    "select status from transponder where codigo = $1",
    [codigo],
  );
  if (!t[0]) {
    throw new ErroNegocio(
      "Esse sensor ainda não foi lido nem cadastrado: passe o kart pelo decoder ou cadastre-o em Transponders.",
    );
  }
  if (t[0].status !== "ativo") {
    throw new ErroNegocio(
      `Esse sensor está ${t[0].status === "manutencao" ? "em manutenção" : "inativo"}.`,
    );
  }
  const { rows: uso } = await cliente.query<{
    kart_id: string;
    numero: string;
  }>(
    `select ks.kart_id, k.numero from kart_sensor ks join kart k on k.id = ks.kart_id
      where ks.transponder = $1 and ks.removido_em is null`,
    [codigo],
  );
  if (uso[0]) {
    throw new ErroNegocio(
      uso[0].kart_id === kart.id
        ? "Esse sensor já é deste kart."
        : `Esse sensor já está no kart ${uso[0].numero}.`,
    );
  }

  let removidos: string[] = [];
  if (opcoes.substituir) {
    const { rows } = await cliente.query<{ transponder: string }>(
      `update kart_sensor
          set removido_em = clock_timestamp(), removido_por = $2, motivo_remocao = $3
        where kart_id = $1 and removido_em is null returning transponder`,
      [kart.id, ator.usuarioId, opcoes.motivo?.trim() || "Sensor substituído"],
    );
    removidos = rows.map((r) => r.transponder);
    if (removidos.length > 0) {
      await cliente.query(
        `update transponder set status = 'manutencao', atualizado_em = clock_timestamp()
          where codigo = any($1) and status = 'ativo'`,
        [removidos],
      );
    }
  }
  await cliente.query(
    `insert into kart_sensor (kart_id, transponder, adicionado_por)
     values ($1, $2, $3)`,
    [kart.id, codigo, ator.usuarioId],
  );
  await cliente.query(
    "update kart set transponder_fixo = $2, atualizado_em = clock_timestamp() where id = $1",
    [kart.id, codigo],
  );
  await cliente.query(
    `update transponder
        set cadastrado = true, rotulo = coalesce(rotulo, $2),
            atualizado_em = clock_timestamp()
      where codigo = $1`,
    [codigo, `Kart ${kart.numero}`],
  );
  return { removidos };
}

// Adiciona um sensor novo a um kart (ex.: o sensor antigo deu problema). Com
// `substituir`, o sensor anterior sai de uso e fica em manutenção; sem ele,
// o kart passa a ter os dois (qualquer um que ler conta para o mesmo kart).
// Baterias já terminadas não mudam: guardam o sensor que usaram.
export async function adicionarSensorAoKart(
  kartId: string,
  codigoBruto: string,
  opcoes: OpcoesDoSensor,
  ator: Ator,
): Promise<void> {
  const codigo = codigoBruto.trim();
  if (!REGEX_CODIGO.test(codigo)) throw new ErroNegocio("Informe o sensor.");
  try {
    await transacao(async (cliente) => {
      const { rows } = await cliente.query<{
        id: string;
        numero: string;
        transponder_fixo: string | null;
      }>(
        "select id, numero, transponder_fixo from kart where id = $1 for update",
        [kartId],
      );
      if (!rows[0]) throw new ErroNegocio("Kart não encontrado.");
      const { removidos } = await colocarSensorNoKart(
        cliente,
        rows[0],
        codigo,
        ator,
        opcoes,
      );
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "kart.sensor_adicionar",
          entidade: "kart",
          entidadeId: kartId,
          antes: { transponderFixo: rows[0].transponder_fixo },
          depois: { transponderFixo: codigo, substituiu: removidos },
          motivo: opcoes.substituir ? (opcoes.motivo?.trim() ?? null) : null,
        },
        cliente,
      );
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) throw erro;
    traduzirErroKart(erro);
  }
}

// Tira um sensor de uso no kart (sem apagar: fica no histórico).
export async function removerSensorDoKart(
  kartId: string,
  codigo: string,
  motivoBruto: string,
  ator: Ator,
): Promise<void> {
  const motivo = motivoBruto.trim();
  if (motivo.length < 3) throw new ErroNegocio("Informe o motivo.");
  await transacao(async (cliente) => {
    const { rows: kart } = await cliente.query<{
      transponder_fixo: string | null;
    }>("select transponder_fixo from kart where id = $1 for update", [kartId]);
    if (!kart[0]) throw new ErroNegocio("Kart não encontrado.");
    const { rowCount } = await cliente.query(
      `update kart_sensor
          set removido_em = clock_timestamp(), removido_por = $3, motivo_remocao = $4
        where kart_id = $1 and transponder = $2 and removido_em is null`,
      [kartId, codigo, ator.usuarioId, motivo],
    );
    if (!rowCount)
      throw new ErroNegocio("Esse sensor não está em uso neste kart.");
    if (kart[0].transponder_fixo === codigo) {
      const { rows: restante } = await cliente.query<{ transponder: string }>(
        `select transponder from kart_sensor
          where kart_id = $1 and removido_em is null order by id desc limit 1`,
        [kartId],
      );
      await cliente.query(
        "update kart set transponder_fixo = $2, atualizado_em = clock_timestamp() where id = $1",
        [kartId, restante[0]?.transponder ?? null],
      );
    }
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "kart.sensor_remover",
        entidade: "kart",
        entidadeId: kartId,
        antes: { sensor: codigo },
        motivo,
      },
      cliente,
    );
  });
}

export interface SensorSemKart {
  codigo: string;
  leituras: number;
  ultimaLeituraMs: number | null;
}

// Sensores que o decoder já leu e que ainda não estão em nenhum kart (os mais
// recentes primeiro) — é daqui que se cadastra um kart novo ou se adiciona
// um sensor a um kart.
export async function sensoresSemKart(limite = 30): Promise<SensorSemKart[]> {
  const linhas = await consultar<{
    codigo: string;
    leituras: number;
    ultima_ms: number | null;
  }>(
    `select t.codigo,
            (select count(*)::int from passagem p where p.transponder = t.codigo) as leituras,
            (select round(extract(epoch from max(p.instante)) * 1000)::float8
               from passagem p where p.transponder = t.codigo) as ultima_ms
       from transponder t
      where t.status = 'ativo'
        and not exists (select 1 from kart_sensor ks
                         where ks.transponder = t.codigo and ks.removido_em is null)
      order by ultima_ms desc nulls last, t.codigo
      limit $1`,
    [limite],
  );
  return linhas.map((l) => ({
    codigo: l.codigo,
    leituras: l.leituras,
    ultimaLeituraMs: l.ultima_ms,
  }));
}

export async function salvarKart(
  id: string | null,
  dados: DadosKart,
  ator: Ator,
): Promise<void> {
  const d = limparKart(dados);
  try {
    await transacao(async (cliente) => {
      if (id === null) {
        const novo = `kart-${randomUUID()}`;
        await cliente.query(
          `insert into kart (id, numero, apelido, status, observacoes)
           values ($1, $2, $3, $4, $5)`,
          [novo, d.numero, d.apelido ?? null, d.status, d.observacoes ?? null],
        );
        if (d.transponderFixo) {
          await colocarSensorNoKart(
            cliente,
            { id: novo, numero: d.numero },
            d.transponderFixo,
            ator,
            { substituir: false },
          );
        }
        await registrarAuditoria(
          {
            usuarioId: ator.usuarioId,
            ip: ator.ip,
            acao: "kart.criar",
            entidade: "kart",
            entidadeId: novo,
            depois: d,
          },
          cliente,
        );
        return;
      }
      const { rows: antes } = await cliente.query<{
        numero: string;
        apelido: string | null;
        status: string;
        transponder_fixo: string | null;
        observacoes: string | null;
      }>(
        "select numero, apelido, status, transponder_fixo, observacoes from kart where id = $1 for update",
        [id],
      );
      if (!antes[0]) throw new ErroNegocio("Kart não encontrado.");
      await cliente.query(
        `update kart set numero = $2, apelido = $3, status = $4,
                observacoes = $5, atualizado_em = clock_timestamp()
          where id = $1`,
        [id, d.numero, d.apelido ?? null, d.status, d.observacoes ?? null],
      );
      // Mudar o campo "sensor" do cadastro equivale a trocar o sensor do kart.
      if (
        d.transponderFixo &&
        d.transponderFixo !== antes[0].transponder_fixo
      ) {
        await colocarSensorNoKart(
          cliente,
          { id, numero: d.numero },
          d.transponderFixo,
          ator,
          { substituir: false, motivo: "Troca pelo cadastro do kart" },
        );
        // o sensor anterior sai de uso (sem ir para manutenção)
        await cliente.query(
          `update kart_sensor
              set removido_em = clock_timestamp(), removido_por = $2,
                  motivo_remocao = 'Troca pelo cadastro do kart'
            where kart_id = $1 and removido_em is null and transponder <> $3`,
          [id, ator.usuarioId, d.transponderFixo],
        );
      }
      await registrarAuditoria(
        {
          usuarioId: ator.usuarioId,
          ip: ator.ip,
          acao: "kart.atualizar",
          entidade: "kart",
          entidadeId: id,
          antes: antes[0],
          depois: d,
        },
        cliente,
      );
    });
  } catch (erro) {
    if (erro instanceof ErroNegocio) throw erro;
    traduzirErroKart(erro);
  }
}

// ------------------------------------------------------- Configuração

export async function lerModeloDeVinculo(): Promise<ModeloVinculo> {
  const [linha] = await consultar<{ modelo_vinculo: ModeloVinculo }>(
    "select modelo_vinculo from config_cronometragem",
  );
  return linha?.modelo_vinculo ?? "piloto";
}

export async function salvarModeloDeVinculo(
  modelo: ModeloVinculo,
  ator: Ator,
): Promise<void> {
  if (modelo !== "kart" && modelo !== "piloto") {
    throw new ErroNegocio("Escolha o modelo de vínculo.");
  }
  await transacao(async (cliente) => {
    const { rows } = await cliente.query<{ modelo_vinculo: ModeloVinculo }>(
      "select modelo_vinculo from config_cronometragem for update",
    );
    if (rows[0]?.modelo_vinculo === modelo) return;
    // Trocar o modelo no meio de uma corrida deixaria o grid ambíguo.
    const { rowCount } = await cliente.query(
      "select 1 from corrida where estado in ('em_andamento', 'encerrando')",
    );
    if (rowCount) {
      throw new ErroNegocio(
        "Há uma corrida em andamento: troque o modelo de vínculo depois que ela terminar.",
      );
    }
    await cliente.query(
      `update config_cronometragem
          set modelo_vinculo = $1, atualizado_em = clock_timestamp(), atualizado_por = $2`,
      [modelo, ator.usuarioId],
    );
    await registrarAuditoria(
      {
        usuarioId: ator.usuarioId,
        ip: ator.ip,
        acao: "config_cronometragem.modelo_vinculo",
        entidade: "config_cronometragem",
        antes: { modeloVinculo: rows[0]?.modelo_vinculo },
        depois: { modeloVinculo: modelo },
      },
      cliente,
    );
  });
}
