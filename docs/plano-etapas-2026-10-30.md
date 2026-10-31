# Grid Lap: diagnóstico e plano por etapas (30/10/2026)

Referência: funcionalidades públicas do LapTime, com implementação própria.
Nada aqui afirma equivalência com o LapTime. Nada foi testado com decoder real.

## Diagnóstico

| Área | Situação | Observação |
| --- | --- | --- |
| Clientes/pilotos | Parcial | Cadastro, busca e aviso de duplicidade existem. Falta histórico de participação por cliente. |
| Reservas/agenda | Completo | Grade, capacidade, lotação, pagamento por piloto. Estados individuais da reserva não existem. |
| Recepção/check-in | **Novo (etapa 1)** | Termo e pagamento já eram checados; presença agora é registrada e auditada. Ainda não bloqueia a largada. |
| Baterias | Parcial | Estados preparada→pronta→em andamento→encerrando→finalizada/cancelada, fases classificação/corrida. Faltam "check-in" e "resultado publicado" como estados e a bateria por número de voltas. |
| Cronometragem | Completo | Passagens brutas imutáveis, motor puro, tempo mínimo, duplicados, invalidação com motivo. |
| Regras de prova | **Novo (etapa 1)** | DNS/DNF/DSQ e penalidade em tempo, com motivo e auditoria (`docs` no motor). Bandeiras e pausa ainda ausentes. |
| Ao vivo/TV/público | Parcial | Painel operacional real; placar TV, ao vivo público e rankings ainda usam dados de demonstração. Sem indicador de conexão. |
| Financeiro/relatórios | Parcial | Caixa e pagamentos reais; sem relatório de ocupação/receita por período. |
| Permissões/auditoria | Completo | Validado no servidor (ver auditoria de 30/10). |
| Integrações | Pendente | Ver abaixo. |

## Regras da etapa 1 (documentadas no motor)

- Penalidade (0 a 3600 s) soma ao tempo total e ao instante de chegada usado no desempate; as voltas não mudam.
- DSQ e DNS não têm posição e ficam no fim (DNS antes de DSQ).
- DNF mantém as voltas feitas, mas fica atrás de quem terminou.
- Toda ocorrência exige motivo (mín. 3 caracteres) e gera auditoria com antes/depois.
- Ocorrência vale também depois da bateria encerrada (correção); bateria cancelada não aceita.

## Plano

1. **Regras e check-in** (feito, falta aplicar no sistema em uso): migração `0013`, motor, ações, telas, 9 testes novos.
2. Estados da bateria (check-in obrigatório para largar, resultado publicado) e bateria por número de voltas.
3. Bandeiras e pausa; indicador de conexão e recuperação nas telas ao vivo.
4. Placar TV, ao vivo público e rankings por traçado/categoria com dados reais; histórico do cliente.
5. Relatórios de ocupação, participantes e receita.
6. Adaptadores: camada própria com o simulador identificado; RMonitor (feed de placar em texto, documentado) como primeiro adaptador. MYLAPS fica pendente: sem credencial nem endpoint confirmados, não será inventado.
