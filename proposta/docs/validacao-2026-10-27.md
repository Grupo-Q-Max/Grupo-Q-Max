# Validação completa — sistema-propostas-finora (27/10/2026)

## Contexto
Auditoria do projeto inteiro: `npm run lint` e `node --check` limpos, `npm ls` ok, leitura de `routes/`, `middleware/`, `services/`, `public/`, `database.sql`, `migrations/` e CI. Itens marcados com ✔ foram conferidos direto no código. Números de linha são de antes da Fase 1.

Resultado: cerca de 100 defeitos, agrupados em fases. Cada fase vira um PR, testado no ambiente QA (MariaDB 3307 + `finora-test` na porta 3015).

## Situação
- **Fase 1: feita** no branch `fix/validacao-2026-10-27-criticos`. `npm test` cobre os casos novos (proposta em análise bloqueada, pedido sem pai no painel, itens inválidos, números simultâneos, aprovação única, PUT parcial de regra).
  - Fora da Fase 1: CNPJ irregular não tem teste automatizado (depende da receitaws). A validade de 10 dias continua só no navegador, porque bloquear proposta expirada no servidor é regra de negócio a decidir.
  - O webhook D4Sign ignora `type_post=4` e não fecha proposta recusada ou em análise. Reenvio do `type_post=1` ainda repete os e-mails.
- **Fase 2: feita** no branch `fix/validacao-2026-10-27-seguranca`. `npm test` cobre: histórico por CNPJ restrito ao dono, login com tipos inválidos, perfil lido do banco, token D4Sign mascarado e importação do Radar IA recusada. XSS conferido nas telas (sem erro de JS; aviso na tela mostra HTML como texto).
  - Mantido de propósito: Comercial ainda transfere o próprio lead (agora só para usuário ativo); `.pfx/.p12` continua aceito no upload de onboarding (passou a ter limite por proposta).
  - **Ação no servidor antes do deploy:** definir `D4SIGN_WEBHOOK_SECRET` no `.env`. Sem ele, documentos novos não registram webhook e a proposta não muda sozinha ao ser assinada.
- **Fase 3: feita** no branch `fix/validacao-2026-10-27-jobs-banco`: trava nas varreduras de follow-up e lembretes, WhatsApp desligado não marca etapa como enviada, timeouts em D4Sign/Resend/Teams/WhatsApp, UUID D4Sign estrito, colunas inexistentes, contagem de visualizações, exclusão de lead em transação, PDF sem NaN, migration de índices, `database.sql` atualizado, `knexfile` com ambiente `test`.
  - Não feito, depende de decisão: fuso horário (definir antes do corte para o Azure, que usa UTC) e texto/regra das mensagens de follow-up ("expira em 24h" no 6º dia, envio para expiradas, contagem a partir da criação).
  - UNIQUE em `proposta_followups(proposta_id, tipo_etapa)` não foi criado: exigiria apagar duplicatas em produção. A trava em memória cobre o caso (PM2 com 1 instância).
  - Linhas `teste` do catálogo continuam no `database.sql` porque existem em produção; limpar pelo admin.
- **Fase 4: feita** no branch `fix/validacao-2026-10-27-frontend`: página do cliente (alerta quente, consultor no vCard, aprovação parcial), sessão (401 desloga, 403 não; JWT base64url), links do CRM, calculadora → proposta, URL de retorno do D4Sign, som/mudo em todas as páginas, eventos em tempo real, auditoria sem dados inventados, menu no celular, service worker, código e rotas sem uso removidos.
  - Mantido: `/api/relatorios/executivo-diario` (disparo manual do resumo diário; não há agendamento) e `GET /api/regras-calculo` (usado pelo admin). A tabela `crm_automacoes` continua no banco, sem rotas.
  - Usuários não têm telefone no cadastro: o WhatsApp do "consultor" abre sem número; o vCard leva nome e e-mail do vendedor.
- **Fase 5: feita** no branch `fix/validacao-2026-10-27-fase5`: faturamento anual tratado como anual nas contas de ROI/Fator R (página do cliente, formulário, roteiro e WhatsApp de follow-up; antes 12x maior), itens da proposta do webhook classificados, webhook D4Sign idempotente, reativação sem sobrescrever `criado_em`, importação CSV pela mesma fila de vendedores do banco e CI rodando `npm test` em MySQL 8.4 antes do deploy.
  - Mantido: preço fixo 1350/1850 da proposta automática do webhook de leads (regra comercial da campanha; decidir se passa a usar a tabela).
- **Fase 6: feita** no branch `fix/validacao-2026-10-27-fase6` (decisões de 27/10):
  - Validade de 10 dias checada no servidor: aprovar/aprovar parcial de proposta vencida dá 409. O cliente reativa uma vez pelo link; depois o consultor usa "Renovar validade" no dashboard (coluna `propostas.validade_inicia_em`).
  - Follow-up: aviso de vencimento no 9º dia ("vence amanhã"); proposta vencida não recebe mais mensagens.
  - Telefone do consultor (`usuarios.telefone`): cadastrado no admin/configurações do CRM; WhatsApp e cartão de contato da página do cliente usam esse número.
  - Contratada por marca configurável no admin (D4Sign → "Contratada por Marca"), usada no contrato do D4Sign e na minuta do cliente. Campos vazios usam o texto atual (escritório contábil, CNPJ 12.552.249/0001-99). **Falta preencher os dados reais de cada marca.**
  - Preço da proposta automática do site: mantido 1350/1850 (decisão).
  - PDF da Tech com rodapé de validação; labels `for` nos formulários.
  - Fuso horário: produção já roda em -03 (servidor America/Sao_Paulo, MariaDB SYSTEM -03). O app agora fixa `-03:00` na sessão do banco, no driver e no knex, e `TZ=America/Sao_Paulo` no PM2: nada muda hoje e o Azure (UTC) continua em horário de Brasília.

## Decisões (27/10)
- Assinatura em `/aprovar`: grava nome e CPF do signatário em `proposta_observacoes`. A imagem desenhada é descartada; a assinatura com validade é a do D4Sign.
- Radar IA (Fase 2/4): marcar como simulado e bloquear importação para o CRM.
- Código e rotas mortos (Fase 4): remover.

---

## Fase 1 — Fluxos quebrados e bypass de aprovação (crítico)

Fluxo de desconto/aprovação
- ✔ `routes/propostas.js:1841` — `precisaAprovacao ? "Pendente" : "Pendente"`. Proposta-filha com desconto > alçada fica aprovável pelo cliente. Trocar para `"Aguardando Aprovação"` (igual `:346`) e conferir que `solicitacoes.js:166` volta para `Pendente` ao aprovar.
- ✔ `routes/solicitacoes.js:74` — `JOIN propostas pai` (inner) esconde pedidos de desconto criados junto com a proposta (sem pai). Diretor nunca vê; proposta trava. Trocar para `LEFT JOIN` e calcular `percentual_solicitado` com `COALESCE` / fallback; ajustar `dashboard-admin.js` para pai nulo.
- `routes/propostas.js:872-984` `GET /:token/link-assinatura` (público) gera contrato D4Sign sem checar status; webhook `:1556` marca `Aprovada` sem checar status. Aplicar `MENSAGEM_BLOQUEIO_APROVACAO` (já existe, `:67`) aqui e no webhook.
- `/aprovar` `:1002`: bloquear também `Aprovada`/expirada; usar `db.transacao` + `FOR UPDATE` (padrão de `/reativar`) contra clique duplo → 2 docs D4Sign.
- `/reenviar` `:1388`, `/recusar` `:1344`: checar status.
- Webhook D4Sign `:1546`: `type_post=4` (um signatário) não pode marcar `Aprovada`; idempotência (não reenviar e-mails/Teams se já `Aprovada`).
- Validação de itens: `quantidade` e `valor` sem validação em `validations/propostaValidation.js:10-20` → total negativo/fracionado escapa da alçada. Exigir `quantidade` inteiro ≥1, `valor` ≥0, `servico` obrigatório. `precoService.js:164-166` deve considerar `quantidade`. `desconto-itens` `:1759` e `desconto` global `:1739` passam a usar os schemas já existentes (`itemPropostaSchema`, `solicitacaoDescontoGlobalSchema`, hoje não usados); `discountService.js:52` rejeitar percentual negativo.
- `precoService.js:87` usa `valor_base || 0`; front usa `valor_base || BASE[codigo]` (`script.js:601`). Espelhar fallback no servidor.

Criação de proposta
- ✔ `routes/propostas.js:297-304` CNPJ irregular adiciona item sem `servico` → insert `:389` recebe `undefined` → 500 sempre. Pôr `servico` no item.
- Numeração: `webhooks.js:94` usa `ano+leadId`, resto usa `MAX+1` sem lock (`propostas.js:222`, `:1796`) → colisão no `UNIQUE uk_numero_proposta`, lead do webhook perdido. Centralizar `proximoNumeroProposta(conexao)` em `services/proposalHelpers.js` com `SELECT ... FOR UPDATE` dentro da transação; webhook passa a usar.
- PDF/e-mail rodam depois do `commit` dentro do mesmo try (`propostas.js:416`, `:1905`, `solicitacoes.js:323`) → 500 com dado salvo, retry duplica. Envolver pós-commit em try/catch próprio e responder sucesso com `emailEnviado:false`.
- receitaws (`:275`) dentro da transação aberta: mover para antes de `getConnection`.

Front ligado a isso
- ✔ `visualizar.html:1941` manda `nomeSignatario/cpfSignatario/assinaturaBase64`; `/aprovar` ignora o body. Feito: nome/CPF vão para `proposta_observacoes`.
- ✔ `script.js:1189` manda `proposta_id` no PUT `/api/leads/:id`, mas `leads.js:207` não permite → lead nunca liga à proposta. Adicionar `proposta_id` aos permitidos com checagem `donoProposta` para Comercial.
- ✔ `script.js:2984` QR code com token fixo `4f45…` e URL sem `/p/`. Setar `window.tokenPropostaAtual` após salvar; usar `/proposta/p/${token}`.
- ✔ `routes/regras.js:50-86` PUT sobrescreve todas as colunas; telas mandam só parte (`dashboard-admin.js:913`, `:1159`, `:1298`) → preço PF/PJ vira null, empresa vira FINORA, multiplicadores zeram. Trocar para update parcial (só campos presentes, lista branca), padrão já usado em `leads.js:207`.

## Fase 2 — Segurança (XSS, autorização, dependências)

XSS armazenado (dado de vendedor ou de formulário público vira script na sessão do Diretor)
- `services/contratoService.js:123-153` HTML do contrato sem escape (dados vêm do webhook público). Usar `esc()` de `emailService.js`.
- `dashboard-propostas.js:458,474`, `dashboard-admin.js:45,75-89,584,592`, `crm.js:737,884,888`, `script.js:2552`: objeto/strings dentro de `onclick`. Padrão de correção único: guardar dado em `Map`/array por id e passar só o id no `onclick` (ou `data-id` + listener). Strings visíveis via `escapeHTML`.
- `prospeccao.html:836-864,961-975` sem helper de escape: incluir `js/dashboard-utils.js` e usar `escapeHTML`.
- `qmax-theme.js:180-186,270-281` override de `alert` usa `innerHTML` → trocar para `textContent` (preserva `\n` com `white-space: pre-line`).
- Baixo: demais `innerHTML` com nomes internos (lista em `crm-config.html:383`, `crm.js:2147`, `dashboard-metricas.js:453`, `dashboard-admin.js` catálogo, `visualizar.html:1068`, `script.js:933-946,1957`, `index.html:2021,2246`) → `escapeHTML`/`esc`.

Autorização (Comercial vê só o seu — regra de 15/10)
- `propostas.js:139-165` `historico-cnpj` e `:1445-1480` `historico`: filtrar por `criado_por` para Comercial; não devolver `token_acesso` de registros alheios.
- `leads.js:935-958` `pesquisa-clientes`: filtrar `vendedor_id`/`criado_por`; validar `q` string.
- `leads.js:305,362` POST: Comercial não define `vendedor_id`/`proposta_id` alheio (igual PUT `:214`).
- `leads.js:409-450` `/transferir`: Comercial não transfere; alvo precisa estar `ativo`.
- `middleware/auth.js:19-27`: já lê `ativo` do banco; ler `role` junto (mesma query).
- `automacoes.js:14` `/api/ai/diagnostico` sem auth; `/alerta-quente` público sem throttle → limitar (1 por token/10 min em memória ou checar última observação).
- `/api/config/sistema` devolve `d4sign_token/secret` ao browser (`dashboard-admin.js:1519`): mascarar no GET, só gravar se vier novo valor.
- `error.message` vazando para cliente: `automacoes.js:26,39,95,152`, `webhooks.js:184,226`, `prospeccao.js:238,331,370,527` → `next(error)`.
- Upload público `propostas.js:730-792`: limitar quantidade/total por token, bloquear status final, `.pfx/.p12` só pela rota cifrada, `decodeURIComponent` em try.
- `d4signService.js:539` sem `D4SIGN_WEBHOOK_SECRET` usa cryptKey como `?secret=` → exigir variável própria.
- Login `auth.js:35-42`: bcrypt dummy quando e-mail não existe (timing), validar tipos.

Dependências / CI
- ✔ `npm audit --omit=dev`: 5 vulns (3 high) — follow-redirects (axios), ip-address, nodemailer addressparser, zod <4.6.6. `npm audit fix` resolve dentro dos ranges.
- ✔ `.github/workflows/deploy.yml:43,51` `appleboy/*@master` → fixar tag/sha.

## Fase 3 — Jobs, serviços, banco

- `server.js:203` follow-up a cada 15 min sem trava; `followUpService.js:76-82` checa→envia→insere; WhatsApp `fetch` sem timeout → flag `rodando` em memória + `UNIQUE (proposta_id, tipo_etapa)` em `proposta_followups` (migration) + `AbortSignal.timeout`.
- `whatsappService.js:57-59` desligado devolve `sucesso:true` → follow-up marcado como enviado e nunca reenviado. Devolver `sucesso:false, simulado:true` e não gravar etapa.
- `whatsappService.js:128` usa `valor_total` mas payload tem `total` → "R$ NaN".
- `followUpService.js:25,71,128`: mensagem "expira em 24h" no dia 6 com validade de 10 dias; segue mandando para expiradas; usa `criado_em` em vez de data de liberação. Decidir texto e regra com o comercial.
- Timeouts ausentes: `d4signService.js:79-123,146-192` (`http.request`), `teamsService.js:275-295` (+`res.resume()`), Resend `emailService.js:43-74`.
- `emailService.dispararEmail` engole erro e devolve null; callers (`d4signService.js:422`, `propostas.js:1024,1226`) logam sucesso. Checar retorno.
- `ip_assinatura` guarda IP ou UUID D4Sign (`propostas.js:891,1006,1170`): IPv6 vira "UUID", mock `mocked_d4sign_doc_uuid_*` conta como real. Ponytail: tratar mock e IPv6 na checagem existente; coluna própria fica para depois.
- `reminderService.js` setInterval 30 s sem trava → mesma flag `rodando`.
- Fuso: pool sem `timezone`, `TZ` não definido no PM2; datas manuais UTC-3 em `propostas.js:234` vs `NOW()` nos jobs. Definir `TZ=America/Sao_Paulo` em `ecosystem.config.js` e `timezone: "-03:00"`… — atenção à migração Azure (UTC). Decidir antes do corte para o Azure.
- Colunas inexistentes no código: `investimento_mensal` (`propostas.js:1044`), `justificativa_desconto` (`:946,:1100,:1288`), `criador_email/nome` não selecionados em `/aprovar` e `/aprovar-parcial` (`:1107,:1295` → signatário vendedor some do D4Sign), `p.visualizacoes` (`automacoes.js:87`).
- `propostas.js:572-579` contagem de visualização lida depois do insert → sempre "reaberta".
- `leads.js:500` 4 params para 3 placeholders (inócuo com `query`, mas limpar); `leads.js:463` delete de lead sem transação deixa `lead_atividades` órfã.
- Índices faltando (`database.sql`): `leads(funil_id, vendedor_id, criado_por, status, proposta_id)`, `lead_comentarios(lead_id)`, `lead_atividades(lead_id)` e `(concluido, alerta_enviado, data_hora)`, `proposta_visualizacoes(proposta_id)`, `propostas(ip_assinatura)`, `propostas(cnpj)`, `proposta_documentos(proposta_id)`. Uma migration só; carregar skill `database-modeling` antes.
- `database.sql` gerado em 08/10: falta `reativada_pelo_cliente_em` e 2 linhas de `knex_migrations`; tem linhas `teste` em `servicos_proposta`/`topicos_pdf`. Regenerar com `scripts/gerar-database-sql.js` depois da nova migration.
- `knexfile.js` sem env `test`; `DB_PASS` vs `DB_PASSWORD` (`config/db.js:16`). Adicionar `test: development`-igual e ler os dois nomes.
- `pdfService.js:122,671,726,212`: `formatarMoeda` sem milhar/NaN, soma sem `||0`, "(undefined%)", `split` em Date.
- Zod 4: `error.errors` → `error.issues` (`leads.js:296,554`, `propostas.js:209`).
- `webhooks.js:168` WhatsApp sem `await/.catch`; `routes/regras.js:738` handler async sem try; `funis.js:61`, `regras.js:50,301,533` sem 404 em `affectedRows===0`; `solicitacoes.js:100` `alterar` sem checar `Pendente`.
- `routes/propostas.js:2033-2037` e `webhooks.js:221` hardcode `/proposta` / `localhost:3005` → `APP_BASE_PATH`/`BASE_URL` (`linkCurto`).

## Fase 4 — Frontend funcional

- `visualizar.html:1615` e `:1704` `iniciarRastreadorTempoLeitura` duplicada → alerta quente morto. Remover a primeira.
- `visualizar.html:1153,1732` WhatsApp/vCard do "consultor" usam telefone/e-mail do próprio cliente. `/publica` precisa devolver contato do vendedor (`usuarios` join) — sem `SELECT *` (`propostas.js:528-609` hoje expõe `ip_assinatura`, `cpf_socio`): lista explícita de colunas.
- `visualizar.html:2252` aprovação parcial lê `itens_json`; usar `itens`.
- CRM links: `crm.js:833` `?id=` (página só lê `token`), `crm.js:1470,1892` `lead.token_acesso` nunca vem de `GET /api/leads` → incluir `p.token_acesso` via join em `leads.js:25-52` (respeitando dono) e usar `linkCurto`.
- 403 de permissão desloga usuário (`crm.js:70`, `script.js:131`) → só 401 desloga; esconder botões de Diretor para Comercial.
- `atob` em JWT base64url quebra (`dashboard-init.js:5`, `crm.js:1117`, `qmax-theme.js:212`) → helper que troca `-_` e faz padding, em `dashboard-utils.js`.
- `toggleMuteSound` indefinido em `admin.html:151`, `crm.html:89`, `crm-config.html:287`, `prospeccao.html:303` → mover função para `qmax-theme.js` (carregado em todas).
- `prospeccao.html:1098` manda `?fat=&clinica=`; `index.html:555` lê `nomeClinica…` → alinhar nomes.
- `dashboard-admin.js:1556,1588` grava URL de retorno D4Sign relativa → absoluta com `location.origin`.
- `dashboard-propostas.js:1135,1147,1153` modal de auditoria: `dev.nome` → `dev.label`; remover IP `127.0.0.1` e protocolo inventados.
- `crm.js:583` lê `finora_id` que login não grava → ler id do JWT.
- Mobile: sidebar some em ≤900px sem menu alternativo (`styles.css:2523`, `proposta-v2-fix.css:328`) → botão hambúrguer simples.
- Eventos SSE sem listener (`novo_lead_webhook`, `leitura_quente_alerta`, `proposta_reativada`, …) → ligar os relevantes ao toast já existente.
- `sw.js:33` `respondWith(undefined)` em miss offline; SW registrado na página pública do cliente (`visualizar.html:16`) → remover registro na página pública e fazer fallback `fetch`.
- `routes/prospeccao.js:350` título com 🎯 (ícone de alvo proibido) → trocar emoji.
- Código morto (remover, sem trigger nem HTML): `script.js:3281-3300` hub WhatsApp, `:3093` comparativo, `:3651` diagnóstico IA, `crm.js:1290` `switchView`; rotas sem chamador listadas na auditoria (`/api/login` alias, `relatorios/executivo-diario`, `prospeccao/gerar-copy`, `ai/diagnostico`, `propostas/:id/desconto`, `regras-calculo`, automações de funil nunca executadas `funis.js:89`). Decidido: remover.

## Pendências que dependem da empresa (não código)
- Contratos com CNPJ fictício / contratada errada (`contratoService.js`, preâmbulo `pdfService.js`) — já no relatório de 08/10, ainda aberto.
- Radar IA (`prospeccao.js:421-489`) inventa telefone/CNPJ e importa como lead real (risco LGPD).
- PDF da Tech sem rodapé de validação.
- `docs/migracao-azure-mysql.md` não versionado; follow-up/WhatsApp/Teams sem doc.

## Testes e CI
- `npm test` não roda no CI; cobre só login, criação sem desconto, desconto global/item, `/publica`, `/historico`.
- Fase 1 já adicionou casos em `tests/run-tests.js`. Falta: Comercial em `historico-cnpj` alheio (Fase 2) e CNPJ irregular (precisa simular a receitaws).
- `tests/run-tests.js` cleanup ainda deixa órfãos em `proposta_visualizacoes` e `proposta_followups`.
- O servidor de teste tenta enviar e-mail pelo Outlook real (SMTP recusa com `530 5.7.57`): `.env.test` tem `EMAIL_USER` preenchido. Esvaziar para o e-mail ficar desligado de fato.

## Como verificar cada fase
1. Banco QA (MariaDB na porta 3307, banco `proposta_test`) e `NODE_ENV=test npx knex migrate:latest --env development`.
2. Servidor com `NODE_ENV=test` na porta 3015.
3. `npm test` antes e depois da fase; `npm run lint`; `npm audit --omit=dev`.
4. Na tela: criar proposta → pedido de desconto aparece para o Diretor → aprovar → link do cliente → aprovar; CRM liga proposta ao lead; QR code abre a proposta certa; editar preço no admin mantém PF/PJ; celular (375px) mostra menu.
5. Um PR por fase. Merge na `main` publica em produção: só com OK.
