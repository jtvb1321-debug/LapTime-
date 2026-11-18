"use client";

import { useActionState, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { reduzirImagem, TAMANHO_MAXIMO_BYTES } from "@/lib/foto-reduzida";
import { atualizarMeuPerfilAction } from "@/lib/perfil-piloto-actions";
import type { AcaoState } from "@/lib/operacao-actions";

const ESTADO_INICIAL: AcaoState = {};

export interface PerfilEditavel {
  nome: string;
  apelido: string;
  numero: number;
  nascimento: string;
  avatarUrl?: string;
}

export function EditarPerfilForm({ perfil }: { perfil: PerfilEditavel }) {
  const [estado, acao, pendente] = useActionState(
    atualizarMeuPerfilAction,
    ESTADO_INICIAL,
  );
  // Campos controlados: depois de um envio com erro o React limpa os campos sem valor controlado.
  const [nome, setNome] = useState(perfil.nome);
  const [apelido, setApelido] = useState(perfil.apelido);
  const [numero, setNumero] = useState(String(perfil.numero));
  const [nascimento, setNascimento] = useState(perfil.nascimento);
  // Só vai foto nova se o piloto escolheu uma; senão o servidor mantém a atual.
  const [fotoNova, setFotoNova] = useState("");
  const [erroFoto, setErroFoto] = useState("");

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
      setErroFoto("Imagem muito grande — escolha um arquivo de até 8 MB.");
      return;
    }
    try {
      setFotoNova(await reduzirImagem(arquivo));
      setErroFoto("");
    } catch {
      setErroFoto("Não foi possível ler a imagem. Use PNG, JPG ou WEBP.");
    }
  }

  return (
    <form action={acao} className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="fotoUrl" value={fotoNova} />

      <div className="flex items-center gap-4">
        <Avatar
          nome={apelido || "Foto"}
          avatarUrl={fotoNova || perfil.avatarUrl}
          tamanho="lg"
        />
        <div className="flex flex-col gap-1">
          <label
            htmlFor="foto-perfil"
            className="text-orange-ink w-fit cursor-pointer text-sm font-medium hover:underline"
          >
            {fotoNova || perfil.avatarUrl ? "Trocar foto" : "Escolher foto"}
          </label>
          <input
            id="foto-perfil"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={aoEscolherFoto}
          />
          {fotoNova ? (
            <p className="text-ink-3 text-xs">
              Foto nova escolhida. Salve para aplicar.
            </p>
          ) : null}
          {erroFoto ? (
            <p role="alert" className="text-orange-ink text-xs">
              {erroFoto}
            </p>
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
            minLength={2}
            maxLength={80}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
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
            minLength={2}
            maxLength={30}
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            className="campo"
          />
        </div>
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
            className="campo w-32"
          />
        </div>
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
            value={nascimento}
            onChange={(e) => setNascimento(e.target.value)}
            className="campo"
          />
        </div>
      </div>

      {estado.erro ? (
        <p role="alert" className="text-orange-ink text-sm">
          {estado.erro}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-ink text-sm font-medium">
          {estado.ok}
        </p>
      ) : null}

      <div>
        <Button type="submit" carregando={pendente}>
          Salvar perfil
        </Button>
      </div>
    </form>
  );
}
