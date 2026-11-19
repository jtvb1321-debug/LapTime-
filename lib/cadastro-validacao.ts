// Validação do cadastro público de piloto (entrada externa: o navegador pode
// ser contornado, então tudo é conferido de novo no servidor).

// Foto: só imagem embutida (PNG, JPG ou WEBP) e pequena. O formulário reduz a
// foto antes de enviar; o limite do servidor de ações é de 1 MB por envio.
export const FOTO_MAX_CARACTERES = 700_000;
const FOTO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const COR = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Idade em anos completos numa data (ambas AAAA-MM-DD).
export function idadeDe(nascimento: string, hoje: string): number {
  const [na, nm, nd] = nascimento.split("-").map(Number);
  const [ha, hm, hd] = hoje.split("-").map(Number);
  return ha - na - (hm < nm || (hm === nm && hd < nd) ? 1 : 0);
}

// Data de nascimento real (sem 31/02) e com idade de 5 a 100 anos; null se estiver certa.
export function erroDoNascimento(
  nascimento: string,
  hoje: string,
): string | null {
  if (!DATA.test(nascimento)) return "Informe a data de nascimento.";
  const [a, m, d] = nascimento.split("-").map(Number);
  const real = new Date(Date.UTC(a, m - 1, d));
  if (
    real.getUTCFullYear() !== a ||
    real.getUTCMonth() !== m - 1 ||
    real.getUTCDate() !== d
  ) {
    return "A data de nascimento não existe.";
  }
  const idade = idadeDe(nascimento, hoje);
  if (nascimento > hoje || idade < 5 || idade > 100) {
    return "Informe uma data de nascimento válida (idade de 5 a 100 anos).";
  }
  return null;
}

// Tira caracteres de controle (inclusive o byte nulo, que o banco recusa).
export function limparTexto(valor: FormDataEntryValue | null): string {
  return String(valor ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

export function corValida(valor: string, padrao: string): string {
  return COR.test(valor) ? valor : padrao;
}

export interface DadosDoCadastro {
  nome: string;
  apelido: string;
  email: string;
  senha: string;
  nascimento: string;
  pesoKg: number;
  fotoUrl: string;
}

// Devolve a mensagem de erro (em português) ou null se estiver tudo certo.
export function erroDoCadastro(
  d: DadosDoCadastro,
  hoje: string,
): string | null {
  if (d.nome.length < 2 || d.nome.length > 80) {
    return "O nome deve ter de 2 a 80 caracteres.";
  }
  if (d.apelido.length < 2 || d.apelido.length > 30) {
    return "O apelido deve ter de 2 a 30 caracteres.";
  }
  if (d.email.length > 120 || !EMAIL.test(d.email)) {
    return "Informe um e-mail válido.";
  }
  if (d.senha.length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  if (d.senha.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  const erroNascimento = erroDoNascimento(d.nascimento, hoje);
  if (erroNascimento) return erroNascimento;
  if (!Number.isFinite(d.pesoKg) || d.pesoKg < 20 || d.pesoKg > 250) {
    return "Informe um peso válido (de 20 a 250 kg).";
  }
  if (
    d.fotoUrl &&
    (d.fotoUrl.length > FOTO_MAX_CARACTERES || !FOTO.test(d.fotoUrl))
  ) {
    return "Foto inválida: use uma imagem PNG, JPG ou WEBP.";
  }
  return null;
}
