// Link do WhatsApp com a mensagem já escrita: o operador clica e o WhatsApp
// abre pronto pra enviar. O sistema NÃO envia nada sozinho.
export function linkWhatsApp(telefone: string, mensagem: string): string {
  let digitos = telefone.replace(/\D/g, "");
  // Telefone nacional (10 ou 11 dígitos, com DDD) ganha o DDI do Brasil.
  if (digitos.length <= 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}
