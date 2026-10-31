// Registro dos drivers. Para suportar uma marca nova: crie um arquivo aqui
// com o mesmo formato dos existentes (veja ../LEIA-ME.md) e registre abaixo.
import { driver as gravador } from "./gravador.mjs";
import { driver as linhasTcp } from "./linhas-tcp.mjs";
import { driver as simulador } from "./simulador.mjs";

export const DRIVERS = {
  [linhasTcp.id]: linhasTcp,
  [gravador.id]: gravador,
  [simulador.id]: simulador,
};
