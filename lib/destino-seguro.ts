// Destino pós-login: só caminho interno do próprio site. Recusa o que o
// navegador trataria como outro site: "//host", "/\\host" (barra invertida vira
// "/"), "http://...", caracteres de controle e textos muito longos.
const CAMINHO_INTERNO = /^\/(?![\/\\])[^\\\u0000-\u001f\u007f]*$/;

export function destinoSeguro(valor: string, padrao = "/"): string {
  return valor.length <= 500 && CAMINHO_INTERNO.test(valor) ? valor : padrao;
}
