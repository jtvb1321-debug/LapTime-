"use client";

import { SeletorEstado } from "@/components/ui/seletor-estado";
import { useActionState, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AssinaturaPiloto } from "@/components/overlay/assinatura-piloto";
import { ApresentacaoPiloto } from "@/components/pilotos/apresentacao-piloto";
import { FotoMacacao } from "@/components/site/foto-macacao";
import { reduzirImagem, TAMANHO_MAXIMO_BYTES } from "@/lib/foto-reduzida";
import { useMockStore } from "@/lib/use-mock-store";
import {
  cadastroPilotoMockAction,
  type CadastroState,
} from "@/lib/cadastro-actions";
import type { Categoria } from "@/lib/types";

const ESTADO_INICIAL: CadastroState = {};
const COR_NUMERO_PADRAO = "#8b5cf6";
const COR_ASSINATURA_PADRAO = "#f2f5f7";

export function CadastroForm({
  categoriasIniciais,
}: {
  categoriasIniciais: Categoria[];
}) {
  const [categorias] = useMockStore("gridlap:categorias", categoriasIniciais);
  const [state, formAction, pending] = useActionState(
    cadastroPilotoMockAction,
    ESTADO_INICIAL,
  );
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [apelido, setApelido] = useState("");
  const [numero, setNumero] = useState("");
  const [corNumero, setCorNumero] = useState(COR_NUMERO_PADRAO);
  const [corAssinatura, setCorAssinatura] = useState(COR_ASSINATURA_PADRAO);
  const [fotoCorpo, setFotoCorpo] = useState("");
  const [recortando, setRecortando] = useState(false);
  const [foto, setFoto] = useState("");
  const [erroFoto, setErroFoto] = useState("");

  async function aoEscolherFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErroFoto("Imagem muito grande — escolha um arquivo de até 8 MB.");
      return;
    }
    try {
      setFoto(await reduzirImagem(arquivo));
      setErroFoto("");
    } catch {
      setErroFoto(
        "Não foi possível ler a imagem. Use um arquivo PNG, JPG ou WEBP.",
      );
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="fotoUrl" value={foto} />
      <input type="hidden" name="fotoCorpo" value={fotoCorpo} />

      <div className="flex items-center gap-4">
        <Avatar
          nome={apelido || "Foto"}
          avatarUrl={foto || undefined}
          tamanho="lg"
        />
        <div className="flex flex-col gap-1">
          <label className="text-orange-ink w-fit cursor-pointer text-sm font-medium hover:underline">
            {foto ? "Trocar foto" : "Escolher foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={aoEscolherFoto}
            />
          </label>
          {erroFoto ? (
            <p className="text-orange-ink text-xs">{erroFoto}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className="text-ink text-sm font-medium">
            Nome completo
          </label>
          <input
            id="nome"
            name="nome"
            required
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            placeholder="Nome e sobrenome"
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="apelido" className="text-ink text-sm font-medium">
            Como quer ser chamado
          </label>
          <input
            id="apelido"
            name="apelido"
            required
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="Nome que aparece no site e na transmissão"
            className="campo"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-ink text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-ink text-sm font-medium">
            Criar senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            required
            minLength={6}
            className="campo"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nascimento" className="text-ink text-sm font-medium">
            Data de nascimento
          </label>
          <input
            id="nascimento"
            name="nascimento"
            type="date"
            required
            min="1900-01-01"
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pesoKg" className="text-ink text-sm font-medium">
            Peso (kg)
          </label>
          <input
            id="pesoKg"
            name="pesoKg"
            type="number"
            inputMode="numeric"
            required
            min={1}
            className="campo"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="uf" className="text-ink text-sm font-medium">
            Estado
          </label>
          <SeletorEstado id="uf" name="uf" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoriaId" className="text-ink text-sm font-medium">
          Categoria
        </label>
        <select
          id="categoriaId"
          name="categoriaId"
          required
          defaultValue=""
          className="campo"
        >
          <option value="" disabled>
            Selecione
          </option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="border-border-strong flex flex-col gap-3 rounded-md border border-dashed p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="numero" className="text-ink text-sm font-medium">
            Número (não pode repetir)
          </label>
          <input
            id="numero"
            name="numero"
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={999}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex.: 21"
            className="campo w-32"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="corNumero" className="text-ink text-sm font-medium">
              Cor do número
            </label>
            <div className="flex items-center gap-2">
              <input
                id="corNumero"
                name="corNumero"
                type="color"
                value={corNumero}
                onChange={(e) => setCorNumero(e.target.value)}
                className="border-border-strong h-9 w-14 cursor-pointer rounded-md border"
              />
              <span className="text-ink-3 font-mono text-xs uppercase">
                {corNumero}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="corAssinatura"
              className="text-ink text-sm font-medium"
            >
              Cor da assinatura
            </label>
            <div className="flex items-center gap-2">
              <input
                id="corAssinatura"
                name="corAssinatura"
                type="color"
                value={corAssinatura}
                onChange={(e) => setCorAssinatura(e.target.value)}
                className="border-border-strong h-9 w-14 cursor-pointer rounded-md border"
              />
              <span className="text-ink-3 font-mono text-xs uppercase">
                {corAssinatura}
              </span>
            </div>
          </div>
        </div>

        <div className="border-border flex flex-col gap-3 border-t pt-4">
          <p className="text-ink text-sm font-medium">
            Seu vídeo de apresentação
          </p>
          <FotoMacacao
            fotoCorpo={fotoCorpo}
            aoMudar={setFotoCorpo}
            aoOcupar={setRecortando}
          />
          <p className="text-ink-3 text-xs">
            No vídeo, a &ldquo;cor do número&rdquo; pinta o número, a linha e a
            faixa fina; a &ldquo;cor da assinatura&rdquo; pinta a faixa grande.
          </p>
          {fotoCorpo ? (
            <ApresentacaoPiloto
              parado
              fotoUrl={fotoCorpo}
              dados={{
                numero: Number(numero) || 0,
                nome: nomeCompleto || apelido || "Seu nome",
                corFaixa: corAssinatura,
                corDestaque: corNumero,
              }}
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-ink-3 text-xs">
            Sua assinatura aparece quando você faz a pole, vence ou crava a
            volta mais rápida:
          </p>
          <div className="flex justify-start rounded-md bg-[#10222b] p-4">
            <AssinaturaPiloto
              numero={Number(numero) || 0}
              nome={apelido || "Seu nome"}
              corNumero={corNumero}
              corAssinatura={corAssinatura}
              motivo="pole"
            />
          </div>
        </div>
      </div>

      {state.erro ? (
        <p className="text-orange-ink text-sm">{state.erro}</p>
      ) : null}

      <Button
        type="submit"
        disabled={pending || recortando}
        className="self-start"
      >
        {pending
          ? "Criando conta…"
          : recortando
            ? "Aguarde o recorte da foto…"
            : "Criar conta de piloto"}
      </Button>
    </form>
  );
}
