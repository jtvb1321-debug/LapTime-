# Deploy do Grid Lap na Discloud

App `gridlap` (https://gridlap.discloud.app), banco no Supabase.

## Variáveis (painel Discloud > Variáveis — nunca no repositório)
| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do **Session pooler** do Supabase (porta 5432), sem `?sslmode=` |
| `DATABASE_SSL` | `1` (SSL com verificação do certificado) |
| `DATABASE_CA` | certificado da CA do Supabase (PEM; quebras de linha como `\n`) |
| `COOKIE_SECURE` | `1` |
| `AUTH_CONTAS_DEMO` | `0` |
| `URL_PUBLICA` | `https://gridlap.discloud.app` |

As migrações rodam sozinhas na primeira inicialização (instrumentation.ts).

## Publicar
```bash
bash deploy/discloud/montar-pacote.sh <pasta-saida>      # árvore atual
cd <pasta-saida> && discloud upload                      # app novo; depois: discloud app commit gridlap
```
O commit pode responder 524 (timeout da Cloudflare) mas o deploy segue:
`discloud app status gridlap` e `discloud app logs gridlap .`.
