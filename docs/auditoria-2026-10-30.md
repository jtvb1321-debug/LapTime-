# Auditoria técnica do Grid Lap — 30/10/2026

Ambiente: cópia isolada do sistema (porta 3100, esquema próprio no Postgres de
testes, usuários e dados **fictícios**, contas demo desligadas). O banco em uso
(`public`) não foi alterado. Ao final, a instância, o esquema e as credenciais
de teste foram removidos.

## O que foi verificado (e como)

| Área | Método | Evidência |
| --- | --- | --- |
| 63 páginas × visitante e 5 perfis | **Teste executado** (HTTP, 42 páginas do admin × 6 papéis + 19 públicas) | todas as respostas batem com as permissões do código, exceto o item M5 abaixo |
| 8 rotas de API (sem login, token falso, perfil errado, métodos, corpo inválido) | Teste executado | itens M4 e B1 |
| Login: campo vazio, senha errada, bloqueio após 5 tentativas (inclusive e-mail em maiúsculas/espaços), login correto, sair, redirecionamento | Teste executado no navegador | itens A1, B2 |
| Cadastro público: 20 entradas inválidas/hostis, duplicidade, foto, XSS | Teste executado | itens A2, M3 |
| Agenda, clientes, pagamentos (valores inválidos, clique triplo), termo (assinatura, clique triplo) | Teste executado | itens B3, B4, B5, B6 |
| Buscas/filtros com byte nulo, aspas, curingas, texto de 100 mil caracteres | Teste executado | item M1 |
| Layout em 375 px (23 telas) e 1024 px | Teste executado (medição de estouro no navegador) | itens M6, M7 |
| Console e log do servidor | Executado | erros só dos casos acima |
| SQL montado com texto, `dangerouslySetInnerHTML`, `eval`, redirecionamentos | **Análise de código** | nenhuma SQL concatenada; 1 uso de HTML (SVG do QR, sem texto do usuário) |
| Testes existentes | Executado | 171 → **180** passam; tsc limpo; ESLint 0 avisos |

## Falhas encontradas e corrigidas

| # | Gravidade | Falha | Como reproduzir | Correção |
| --- | --- | --- | --- | --- |
| A1 | **Alta** | Redirecionamento aberto no login | `/login?redirectTo=/\dominio-externo` e entrar: o navegador ia para o domínio externo | `lib/destino-seguro.ts` (+ `lib/auth-actions.ts`) |
| A2 | **Média** | Cadastro público sem validação: e-mail "abc", idade 9999, peso 1 bilhão, nome de 20 mil caracteres, foto com `javascript:` ou URL externa, cores com CSS | enviar o formulário com esses valores | `lib/cadastro-validacao.ts`, `lib/cadastro-actions.ts` |
| M1 | Média | Busca com byte nulo (`%00`) dava erro 500 (Clientes, Reservar, Bateria, Transponders) | `?q=%00` | texto limpo/limitado em `clientes-store.ts` e `cadastros-store.ts` |
| M2 | Média | Fotos acima de ~750 KB davam erro 500 (a tela prometia 2 MB; o servidor aceita 1 MB) | enviar foto de 1 MB | foto reduzida no navegador (512 px), `components/site/cadastro-form.tsx` |
| M3 | Média | Limite de tentativas do pareamento contornável com `X-Forwarded-For` forjado | 14 tentativas, depois outro IP forjado | teto global (40/10 min) em `parear/route.ts` |
| M4 | Média | API de patrocinadores devolvia 500 com corpo inválido | `PUT` com texto, `[{}]`, tipos errados | validação em `lib/patrocinadores-store.ts` + rota (400) |
| M5 | Média | 19 telas do campeonato abriam para a recepção pela URL (só o menu as escondia) | logar como recepção e abrir `/admin/pilotos` | grupo de rotas `(campeonato)` com layout que barra a recepção |
| M6 | Média | Botões do cabeçalho passavam da tela no celular (Passo a passo 457 px, Agenda 552 px, Financeiro, Relatório) | 375 px | `components/ui/page-header.tsx` |
| M7 | Média | Equipamentos com 841 px de largura no celular (e outras telas com tabela ao lado de formulário) | 375 px | `grid-cols-1` nos grids de 7 páginas |
| M8 | Média | Sem cabeçalhos de segurança; `X-Powered-By` exposto | `curl -I` | `next.config.ts` |
| B1 | Baixa | Tela de login listava `admin@...` e dizia "qualquer senha" mesmo com contas demo desligadas | abrir `/login` | só aparece com `AUTH_CONTAS_DEMO=1` |
| B2 | Baixa | Erro de login sem `role="alert"` e e-mail apagado após a falha | errar a senha | `components/auth/login-form.tsx` |
| B3 | Baixa | Agendar que falha (dia passado, lotação) deixava horário vazio na agenda | agendar para ontem | `agendarBateria` valida antes e desfaz |
| B4 | Baixa | Mesmo nome e telefone gerava dois cadastros; nome de 500 e documento de 5 mil caracteres aceitos (quebravam o layout) | cadastrar duas vezes | limites e aviso de duplicidade (`clientes-store.ts`, `operacao-actions.ts`) |
| B5 | Baixa | Clique repetido em "Assinar o termo" terminava com "já foi assinado" no lugar da confirmação (1 aceite era gravado) | tocar 3 vezes | trava de envio em `assinatura-digital.tsx` |
| B6 | Baixa | Código sem uso e diretivas de lint obsoletas | `eslint` | limpeza |

Testes novos: `tests/auditoria-correcoes.test.ts` (9 testes).

## Verificado e sem falha
Visitante/piloto barrados em todo o admin; permissões por perfil corretas no
servidor; bloqueio de login após 5 falhas; encerrar sessão; validação de valores
de pagamento (saldo, zero, negativo, texto); clique triplo em "Agendar" (1
reserva); HTML no nome escapado; sem SQL concatenada; APIs do coletor exigem
token; PDF exige permissão.

## Não testado / bloqueios / pendências
- **Playwright não está instalado** (e baixar navegadores exige autorização): os fluxos foram testados com o navegador integrado e scripts HTTP. Sem suíte e2e repetível.
- **Equipamento real:** nada foi testado com decoder.
- **CSP e HSTS:** não incluídos (CSP exige `nonce` no Next; HSTS pertence ao proxy HTTPS). Recomendado antes de expor na internet.
- **`X-Forwarded-For` é confiado** para IP de auditoria e limites: só é seguro atrás de proxy que o sobrescreva.
- **Recuperação de senha não existe** no sistema; senha mínima de 6 caracteres (recomendável 8+); `AUTH_CONTAS_DEMO` ligado no ambiente local: desligar antes de uso real.
- **Bloqueio por e-mail permite negação de acesso** a uma conta (5 tentativas travam por 10 min).
- **Telas do campeonato** usam dados de demonstração/`localStorage` (lista de patrocinadores "pisca" com dados fictícios antes de carregar) e a **inscrição pública não grava** (modo demonstração).
- Concorrência de pagamentos: verificada só por leitura de código (trava a reserva na transação); sem teste de carga.
- Exportações: só PDFs (cobertos por testes existentes); não há CSV.
- API devolve 401 (não 403) para perfil logado sem permissão.
- O computador reiniciou e o sistema local não subiu sozinho: usar `iniciar-local.ps1` (início automático com o Windows não existe).
