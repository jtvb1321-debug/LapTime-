// Erro de regra de negócio (ex.: "Abra o caixa antes de receber"). A mensagem
// é escrita pra quem opera o balcão e pode ser mostrada na tela como está;
// qualquer outro erro é falha técnica e não deve vazar pra interface.
export class ErroNegocio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroNegocio";
  }
}

// Quem fez a ação (vai pra auditoria e pro registro do movimento).
export interface Ator {
  usuarioId: string;
  ip?: string | null;
}
