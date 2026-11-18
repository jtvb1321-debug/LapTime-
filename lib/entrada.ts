// Animação de entrada após o login. O cookie nasce no login bem-sucedido, vale
// por poucos minutos e é apagado quando a animação termina, então aparece uma
// vez por entrada autenticada (e não ao navegar entre páginas).
export const COOKIE_ENTRADA = "gridlap_entrada";
export const VALIDADE_ENTRADA_S = 120;

// Só as telas que mostram a animação recebem o cookie.
export function destinoComEntrada(destino: string): boolean {
  return /^\/(admin|area-do-piloto)(\/|\?|$)/.test(destino);
}
