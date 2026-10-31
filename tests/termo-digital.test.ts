import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cadastrarPilotoNaBateria,
  criarCorrida,
  definirResponsavel,
  finalizarCorrida,
  iniciarCorrida,
  lerCorrida,
  lerPainel,
  removerPiloto,
} from "@/lib/cronometragem/corridas-store";
import { consultar } from "@/lib/db/conexao";
import { migrar } from "@/lib/db/migrar";
import { buscarClientes, criarCliente } from "@/lib/operacao/clientes-store";
import {
  assinarPorConvite,
  convitesVigentes,
  garantirConvite,
  lerConvite,
  situacaoDoTermo,
  termoAtual,
  ultimoAceiteDoCliente,
} from "@/lib/operacao/termo-store";
import { criarEsquemaDeTeste, temBancoDeTeste } from "./helpers/banco";

// PNG 1x1 válido, maior que o mínimo aceito (preenchido com um bloco extra).
function assinaturaDeTeste(): string {
  const cabecalho = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const corpo = Buffer.alloc(400, 7);
  return `data:image/png;base64,${Buffer.concat([cabecalho, corpo]).toString("base64")}`;
}

describe.skipIf(!temBancoDeTeste)("termo digital e pilotos cadastrados", () => {
  let banco: Awaited<ReturnType<typeof criarEsquemaDeTeste>>;
  const ator = { usuarioId: "operador-1" };

  async function erroDe(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return (erro as Error).message;
    }
    return "";
  }

  async function assinar(token: string, versao: number, nome: string) {
    await assinarPorConvite(
      token,
      {
        assinante: nome,
        porMenor: false,
        assinaturaPng: assinaturaDeTeste(),
        termoVersao: versao,
      },
      { ip: "203.0.113.5", userAgent: "teste" },
    );
  }

  beforeAll(async () => {
    banco = await criarEsquemaDeTeste();
    await migrar();
  });
  afterAll(async () => {
    await banco.remover();
  });

  it("todo cliente tem número de cadastro sequencial e a busca aceita o número", async () => {
    const a = await criarCliente(
      { nome: "Ana Souza", telefone: "11999990001" },
      ator,
    );
    const b = await criarCliente(
      { nome: "Beto Lima", telefone: "11999990002" },
      ator,
    );
    expect(b.numero).toBe(a.numero + 1);
    expect((await buscarClientes(String(b.numero)))[0]?.id).toBe(b.id);
    expect((await buscarClientes("beto"))[0]?.id).toBe(b.id);
  });

  it("link do termo: reaproveita o vigente, o cliente assina e fica registrado", async () => {
    const c = await criarCliente(
      { nome: "Carla Dias", telefone: "11999990003" },
      ator,
    );
    const termo = await termoAtual();
    expect((await situacaoDoTermo(c.id)).situacao).toBe("pendente");

    const convite = await garantirConvite(c.id, ator);
    expect(convite.token).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect((await garantirConvite(c.id, ator)).token).toBe(convite.token);
    expect((await convitesVigentes([c.id])).get(c.id)?.token).toBe(
      convite.token,
    );

    const lido = await lerConvite(convite.token);
    expect(lido).toMatchObject({
      estado: "valido",
      cliente: { id: c.id, nome: "Carla Dias", menor: false },
    });
    expect((await lerConvite("nao-existe-nenhum-token-assim")).estado).toBe(
      "invalido",
    );

    // recusas: nome curto, assinatura vazia/inválida, texto desatualizado
    expect(
      await erroDe(
        assinarPorConvite(
          convite.token,
          {
            assinante: "Ca",
            porMenor: false,
            assinaturaPng: assinaturaDeTeste(),
            termoVersao: termo.versao,
          },
          {},
        ),
      ),
    ).toMatch(/nome completo/);
    expect(
      await erroDe(
        assinarPorConvite(
          convite.token,
          {
            assinante: "Carla Dias",
            porMenor: false,
            assinaturaPng: "data:image/png;base64,AAAA",
            termoVersao: termo.versao,
          },
          {},
        ),
      ),
    ).toMatch(/assinatura/i);
    expect(
      await erroDe(
        assinarPorConvite(
          convite.token,
          {
            assinante: "Carla Dias",
            porMenor: false,
            assinaturaPng: assinaturaDeTeste(),
            termoVersao: termo.versao + 1,
          },
          {},
        ),
      ),
    ).toMatch(/atualizado/);

    await assinar(convite.token, termo.versao, "Carla Dias");
    expect((await situacaoDoTermo(c.id)).situacao).toBe("valido");
    const aceite = await ultimoAceiteDoCliente(c.id);
    expect(aceite).toMatchObject({
      canal: "link",
      assinante: "Carla Dias",
      versao: termo.versao,
    });
    expect(aceite?.assinaturaPng).toMatch(/^data:image\/png;base64,/);
    const [linha] = await consultar<{
      texto_hash: string;
      ip: string;
      user_agent: string;
    }>(
      "select texto_hash, ip, user_agent from termo_aceite where cliente_id = $1",
      [c.id],
    );
    expect(linha.texto_hash).toHaveLength(64);
    expect(linha.ip).toBe("203.0.113.5");

    // o link só vale uma vez, e o aceite não pode ser alterado nem apagado
    expect(await erroDe(assinar(convite.token, termo.versao, "Carla"))).toMatch(
      /já foi assinado/,
    );
    expect((await lerConvite(convite.token)).estado).toBe("usado");
    expect(await erroDe(garantirConvite(c.id, ator))).toMatch(
      /já tem um termo válido/,
    );
    expect(
      await erroDe(
        consultar("update termo_aceite set assinante_nome = 'X'").then(
          () => undefined,
        ),
      ),
    ).toMatch(/somente de inclusão/);
  });

  it("link vencido é recusado; menor de idade precisa do responsável legal", async () => {
    const termo = await termoAtual();
    const menor = await criarCliente(
      {
        nome: "Davi Costa",
        telefone: "11999990004",
        nascimento: `${new Date().getFullYear() - 10}-03-15`,
      },
      ator,
    );
    const convite = await garantirConvite(menor.id, ator);
    expect(await lerConvite(convite.token)).toMatchObject({
      cliente: { menor: true },
    });
    expect(
      await erroDe(assinar(convite.token, termo.versao, "Davi Costa")),
    ).toMatch(/responsável legal/);
    await assinarPorConvite(
      convite.token,
      {
        assinante: "Marta Costa",
        documento: "123.456.789-00",
        porMenor: true,
        assinaturaPng: assinaturaDeTeste(),
        termoVersao: termo.versao,
      },
      {},
    );
    expect(await ultimoAceiteDoCliente(menor.id)).toMatchObject({
      assinante: "Marta Costa",
      porMenor: true,
      documento: "123.456.789-00",
    });

    const vencido = await criarCliente(
      { nome: "Eva Lopes", telefone: "11999990005" },
      ator,
    );
    const c2 = await garantirConvite(vencido.id, ator);
    await consultar(
      "update termo_convite set expira_em = now() - interval '1 minute' where token = $1",
      [c2.token],
    );
    expect((await lerConvite(c2.token)).estado).toBe("expirado");
    expect(await erroDe(assinar(c2.token, termo.versao, "Eva Lopes"))).toMatch(
      /venceu/,
    );
    // pedir de novo gera um link novo
    expect((await garantirConvite(vencido.id, ator)).token).not.toBe(c2.token);
  });

  it("bateria avulsa: responsável, pilotos um a um, e só inicia com todos os termos", async () => {
    const termo = await termoAtual();
    const resp = await criarCliente(
      { nome: "Fabio Reis", telefone: "11999990006" },
      ator,
    );
    const id = await criarCorrida({ nome: "Bateria avulsa" }, ator);
    await definirResponsavel(id, resp.id, true, ator);
    let painel = (await lerPainel(id))!;
    expect(painel.responsavel).toMatchObject({
      nome: "Fabio Reis",
      numero: resp.numero,
    });
    expect(painel.grid.map((g) => [g.nome, g.termo])).toEqual([
      ["Fabio Reis", "pendente"],
    ]);
    // definir de novo não duplica o responsável na lista
    await definirResponsavel(id, resp.id, true, ator);
    expect((await lerPainel(id))!.grid).toHaveLength(1);

    // piloto novo (cadastro na hora) e piloto já cadastrado (pelo número)
    const novo = await cadastrarPilotoNaBateria(
      id,
      { nome: "Gabi Nunes", telefone: "(11) 99999-0007" },
      ator,
    );
    expect(novo.numero).toBeGreaterThan(resp.numero);
    const existente = (await buscarClientes("Ana Souza"))[0];
    await cadastrarPilotoNaBateria(id, { clienteId: existente.id }, ator);
    expect(
      await erroDe(
        cadastrarPilotoNaBateria(id, { clienteId: existente.id }, ator),
      ),
    ).toMatch(/já está nesta bateria/);
    // mesmo nome e telefone: reaproveita o cadastro, sem número novo
    const repetido = await cadastrarPilotoNaBateria(
      id,
      { nome: "Gabi Nunes", telefone: "11999990007" },
      ator,
    ).catch((e: Error) => e.message);
    expect(repetido).toMatch(/já está nesta bateria/);
    expect(
      await erroDe(cadastrarPilotoNaBateria(id, { nome: "X" }, ator)),
    ).toMatch(/nome|telefone/i);

    painel = (await lerPainel(id))!;
    expect(painel.grid).toHaveLength(3);
    // ninguém assinou ainda: a bateria não inicia
    const mensagem = await erroDe(iniciarCorrida(id, ator));
    expect(mensagem).toMatch(/Termo pendente/);
    expect(mensagem).toMatch(/Fabio Reis/);
    expect(mensagem).toMatch(/Gabi Nunes/);
    expect((await lerCorrida(id))?.estado).toBe("preparada");

    // todos assinam pelo link
    for (const g of painel.grid) {
      if (g.termo === "valido") continue;
      const c = await garantirConvite(g.clienteId!, ator, id);
      await assinar(c.token, termo.versao, g.nome);
    }
    painel = (await lerPainel(id))!;
    expect(painel.grid.every((g) => g.termo === "valido")).toBe(true);
    await iniciarCorrida(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("em_andamento");
    await finalizarCorrida(id, ator);
  });

  it("vaga aberta da reserva: preenche com o piloto cadastrado ou remove, e o termo vale", async () => {
    const termo = await termoAtual();
    const resp = await criarCliente(
      { nome: "Hugo Pires", telefone: "11999990008" },
      ator,
    );
    // vaga criada como a agenda cria: linha sem cliente, ligada a uma reserva
    const id = await criarCorrida({ nome: "Com vaga" }, ator);
    await definirResponsavel(id, resp.id, true, ator);
    await consultar(
      `insert into bateria_slot (id, inicio, duracao_min, capacidade, preco_centavos)
       values ('slot-t', now() + interval '1 day', 12, 8, 5000)`,
    );
    await consultar(
      `insert into reserva (id, slot_id, cliente_id, pilotos, valor_centavos)
       values ('res-t', 'slot-t', $1, 2, 10000)`,
      [resp.id],
    );
    await consultar(
      `insert into corrida_piloto (id, corrida_id, nome, reserva_id, modelo_vinculo)
       values ('cp-vaga', $1, 'Vaga 2 de Hugo Pires', 'res-t', 'kart')`,
      [id],
    );
    let painel = (await lerPainel(id))!;
    expect(painel.grid.find((g) => g.id === "cp-vaga")).toMatchObject({
      vaga: true,
      termo: "sem_cadastro",
    });

    const c = await garantirConvite(resp.id, ator, id);
    await assinar(c.token, termo.versao, "Hugo Pires");
    expect(await erroDe(iniciarCorrida(id, ator))).toMatch(
      /Vaga sem piloto cadastrado/,
    );

    await cadastrarPilotoNaBateria(
      id,
      { nome: "Iara Moura", telefone: "11999990009", vagaId: "cp-vaga" },
      ator,
    );
    painel = (await lerPainel(id))!;
    expect(painel.grid.find((g) => g.id === "cp-vaga")).toMatchObject({
      nome: "Iara Moura",
      vaga: false,
      termo: "pendente",
    });
    expect(await erroDe(iniciarCorrida(id, ator))).toMatch(/Iara Moura/);

    // sem assinatura, quem não vai correr sai da lista e a bateria libera
    await removerPiloto("cp-vaga", ator);
    await iniciarCorrida(id, ator);
    expect((await lerCorrida(id))?.estado).toBe("em_andamento");
    await finalizarCorrida(id, ator);
  });
});
