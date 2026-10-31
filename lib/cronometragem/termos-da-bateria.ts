import QRCode from "qrcode";
import type { PainelDaCorrida } from "@/lib/cronometragem/corridas-store";
import { consultar } from "@/lib/db/conexao";
import type { Ator } from "@/lib/operacao/erros";
import { convitesVigentes, garantirConvite } from "@/lib/operacao/termo-store";

// Termo de cada piloto da bateria, pronto para assinar na própria tela da
// bateria: link único, QR e telefone para o WhatsApp.
export interface TermoDoPiloto {
  pilotoId: string;
  clienteId: string;
  nome: string;
  numero?: number;
  telefone: string;
  assinado: boolean;
  url: string | null;
  qr: string | null;
  expiraEm?: Date;
}

// Monta a lista de termos da bateria. Com `ator`, cria sozinho o link de quem
// ainda não assinou e não tem link (o operador não precisa "gerar" nada).
export async function termosDaBateria(
  painel: PainelDaCorrida,
  baseDoSistema: string,
  ator?: Ator,
): Promise<TermoDoPiloto[]> {
  const pilotos = painel.grid.filter((p) => p.clienteId && !p.vaga);
  if (pilotos.length === 0) return [];
  const ids = pilotos.map((p) => p.clienteId!);

  let convites = await convitesVigentes(ids);
  if (ator) {
    let criou = false;
    for (const p of pilotos) {
      if (p.termo === "pendente" && !convites.has(p.clienteId!)) {
        try {
          await garantirConvite(p.clienteId!, ator, painel.corrida.id);
          criou = true;
        } catch {
          // já assinou entre uma leitura e outra, ou cadastro removido
        }
      }
    }
    if (criou) convites = await convitesVigentes(ids);
  }

  const telefones = await consultar<{ id: string; telefone: string }>(
    "select id, telefone from cliente where id = any($1)",
    [ids],
  );
  const telefoneDe = new Map(telefones.map((t) => [t.id, t.telefone]));

  return Promise.all(
    pilotos.map(async (p) => {
      const convite = convites.get(p.clienteId!);
      const url =
        p.termo !== "valido" && convite
          ? `${baseDoSistema}/assinar/${convite.token}`
          : null;
      return {
        pilotoId: p.id,
        clienteId: p.clienteId!,
        nome: p.nome,
        numero: p.clienteNumero,
        telefone: telefoneDe.get(p.clienteId!) ?? "",
        assinado: p.termo === "valido",
        url,
        qr: url
          ? await QRCode.toString(url, { type: "svg", margin: 1, width: 144 })
          : null,
        expiraEm: convite?.expiraEm,
      };
    }),
  );
}
