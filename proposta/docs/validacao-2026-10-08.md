# Validação completa do sistema FINORA — 08/10/2026

Ambiente: servidor local isolado (`NODE_ENV=test`, porta 3015) com banco MariaDB descartável (porta 3307). Ele usou a estrutura de produção e o catálogo de preços, copiados em modo somente leitura, sem dados de clientes. D4Sign ficou em modo mock e nenhum e-mail foi entregue.

## Resumo

| Área | Resultado |
|---|---|
| `npm test` (fluxo E2E de propostas e descontos) | ✅ passa (antes: **falhava** na aprovação de desconto) |
| Login, guardas de rota, papéis Diretor/Comercial | ✅ |
| Criação de proposta pela tela (PJ, CNPJ, serviços, vídeo) | ✅ |
| Página do cliente: PDF, contrato, estudo tributário, vídeo, aprovação com assinatura | ✅ |
| Aprovação parcial / recusa | ✅ após correção (antes: **erro 500** nas duas) |
| Upload de documentos (PDF, imagem, planilha, .pfx) | ✅ até 25 MB (antes: limite real ~1,5 MB) |
| Upload de certificado digital | ✅ |
| Webhook D4Sign e webhook de leads | ✅ |
| CRM: leads, estatísticas, motivo de perda, atividades | ✅ após correção |
| Responsividade 375 / 768 / 1280 px em todas as páginas | ✅ após correção |

## Bugs corrigidos

### Críticos (segurança ou perda de dados)
1. **Aprovação parcial aceitava preços enviados pelo cliente.** A rota pública `/aprovar-parcial` recalculava o total e gerava o contrato com os `valor` que vinham do navegador, então qualquer pessoa com o link podia alterar o valor do contrato. Agora preço e escopo vêm do banco; do cliente só vem *quais* serviços foram aprovados. Também bloqueia proposta já aprovada. (`routes/propostas.js`)
2. **Download de documentos sem autenticação.** `GET /api/documentos/:id/download` usava id sequencial e qualquer pessoa baixava qualquer documento. Agora o cliente usa `/api/propostas/:token/documentos/:docId/download`, que valida o token da proposta, e o dashboard exige JWT.
3. **`/publica` expunha `certificado_senha_criptografada` e `certificado_caminho`** para quem tinha o link da proposta. Esses campos foram removidos da resposta.
4. **XSS armazenado:** o nome do arquivo enviado pelo cliente era inserido sem escape no modal de documentos do dashboard. Agora é escapado (`escapeHTML`).
5. **Rotas sem autenticação:** `/api/prospeccao/*` agora exige token. `/api/relatorios/executivo-diario` exige token de Diretor. `/api/webhooks/*` agora exige `WEBHOOK_SECRET` (header `X-Webhook-Secret` ou `?secret=`).
6. **Embed de vídeo aceitava qualquer URL no iframe**, inclusive `javascript:`. Agora só aceita `https` do YouTube (com Shorts), Loom e Vimeo.

### Funcionais (afetam produção hoje)
7. **Aprovar desconto dava erro 500.** `itens_json` chega do MariaDB como objeto e o código fazia `JSON.parse` nele. O helper `lerJson` foi aplicado no back e no front. No dashboard, os itens das propostas e dos descontos apareciam vazios sem nenhum aviso.
8. **Aprovação parcial e recusa davam erro 500** depois de já gravar o status. O motivo era `usuario_id NULL` em `proposta_observacoes`, coluna que é NOT NULL. Na aprovação parcial, o contrato D4Sign e a notificação nunca eram enviados.
9. **Upload de documentos travava em ~1,5 MB**, enquanto a tela prometia 25 MB. O envio passou a ser binário (`application/octet-stream`, limite de 25 MB), com lista de extensões permitidas, rejeição de arquivo vazio, gravação assíncrona e mensagem de erro real na tela.
10. **Lista de documentos no dashboard sempre falhava.** A rota interna era capturada pela rota pública, e o caminho novo é `/api/propostas/:id/documentos-internos`.
11. **Estatísticas do CRM (`/api/leads/stats`) nunca funcionaram.** A rota caía em `/api/leads/:id`. Ela foi reordenada e o `PUT /api/leads/:id` duplicado, que nunca era executado, foi removido.
12. **O motivo de perda do lead não era gravado**, embora a tela dissesse "Motivo registrado!", e o relatório de motivos ficava sempre vazio.
13. **Responsividade:**
    - Os cards de métricas do dashboard estouravam a tela em 1280 px (7 colunas fixas).
    - A busca do dashboard e os filtros do CRM estouravam em 375 px.
    - O dashboard não tinha `<meta viewport>`.
14. O erro 413 agora aparece em português.
15. `npm test`:
    - Agora termina com código 1 quando falha.
    - Não roda sem `.env.test`. Antes ele caía no `.env` de produção e o script apaga dados.

## Segunda rodada (decisões do responsável)

16. **Alçada de 20% aplicada no servidor.** `services/precoService.js` recalcula o preço de tabela de cada item, espelhando o motor de `public/script.js`, e mede o desconto real sem confiar no `descontoPercentual` enviado pelo navegador. Acima de 20%, um Comercial gera sempre uma solicitação para a diretoria, tanto em `POST /api/propostas` quanto em `/desconto-itens`. O total passa a ser sempre a soma dos itens.
    - Testado sem desconto e com cadeiras, faturamento, regime híbrido, DP, regulatório e certificado: 0% em todos os itens, ou seja, nenhum bloqueio indevido.
    - Testado com 20% (vai direto), 21% em um item, 25% e preço adulterado com 0% declarado (todos vão para a diretoria).
    - Testado com total adulterado (é recalculado) e com o Diretor dando 30% (vai direto).
    - Ao mudar a fórmula no `script.js`, é preciso atualizar o `precoService.js`.
17. **Proposta recusada não pode mais ser aprovada pelo link.** `/aprovar`, `/aprovar-parcial` e `/reativar` respondem 409. A tela esconde os botões e explica o motivo. O mesmo vale para proposta "Aguardando Aprovação" interna. O `/reativar` também deixou de voltar propostas aprovadas ou recusadas para "Pendente".
18. **Falha de e-mail agora aparece na tela.** As respostas trazem `emailEnviado`. A tela de criação mostra em vermelho que o e-mail NÃO foi enviado e oferece o link. Reenvio, renegociação e aprovação de desconto também avisam.
19. **Banco do zero.**
    - O `database.sql` agora é gerado do banco real por `scripts/gerar-database-sql.js`, que só faz leitura.
    - Ele traz a estrutura completa (27 tabelas, 16 FKs), o catálogo de preços e funis e o histórico de migrations. Não leva usuários, clientes nem configurações com segredos.
    - É idempotente. Verificado: banco vazio + `database.sql` + `migrate:latest` resultou em 0 diferenças de coluna contra produção.
    - O primeiro usuário Diretor ainda precisa ser criado manualmente.

## Testes em produção (após o deploy de 08/10, 17:20 UTC)

O deploy (PR #1, run 37815814125) terminou com sucesso. O `WEBHOOK_SECRET` foi configurado no servidor e o PM2 foi reiniciado. Todos os testes abaixo foram só de leitura, com o login de um Diretor real, sem criar nem alterar dados.

| Verificação | Resultado |
|---|---|
| Código publicado é o novo (marcadores no front) | ✅ |
| Saúde (`/api/admin/health-check`) | ✅ banco 2 ms, Outlook OAuth ok (`envio@qmax.com.br`), D4Sign conectado |
| Itens das propostas reais | ✅ 45/45 legíveis. **44/45 quebravam no código antigo** (itens sumiam no dashboard e a aprovação de desconto dava erro) |
| Dashboard, solicitações, CRM (stats, funis, etapas, leads, fila), prospecção, regras, admin | ✅ todos 200, < 0,7 s |
| Lista interna de documentos (80 propostas) | ✅ sem erro |
| Sem login: prospecção, webhook sem segredo, download de documento | ✅ 401 |
| Responsividade: 6 telas internas + 3 públicas × 375/768/1280 px | ✅ sem rolagem lateral nem erro de JS |

Ficou de fora em produção:
- **Links de propostas reais.** Abrir registraria visualização e mandaria alerta de "lead quente" ao vendedor.
- **Fluxos que gravam dados.** A proteção do ambiente bloqueou escrita no banco real.

Esses fluxos foram testados localmente (próxima seção). Numa tentativa anterior, 4 propostas QA (ids 692–695) e 2 usuários QA foram criados em produção e depois apagados. Nenhum documento foi gerado no D4Sign. Os diretores receberam 1 aviso de desconto de "QA VALIDAÇÃO - NÃO CONTATAR".

## Ciclo completo local (terceira rodada)

Ambiente isolado (banco 3307, D4Sign em mock). O transporte de e-mail foi trocado por um que grava cada mensagem em arquivo, então foi possível conferir destinatário, assunto e links sem enviar nada.

**Ciclo pela tela:**
1. O Comercial cria a proposta.
2. O cliente recebe o e-mail com o link certo (`BASE_URL`).
3. O cliente abre a proposta: vídeo Loom embutido, PDF disponível, visualização e tempo de leitura registrados.
4. O cliente envia PDF de 8 MB e JPG; o download volta íntegro.
5. O cliente aprova com assinatura: status Aprovada, contrato no D4Sign e e-mail ao cliente com o link de assinatura.
6. O D4Sign confirma a assinatura (webhook): e-mails de contrato assinado para cliente, comercial e diretores.
7. A página do cliente fica travada com "Proposta aprovada.".

Também passaram:
- Aprovação parcial pelo modal: o serviço recusado sai e o total é recalculado.
- Recusa pelo modal: a página trava e uma nova aprovação responde 409.
- No dashboard, o Diretor vê e baixa os documentos enviados.
- `npm test` passa.

**Bugs encontrados e corrigidos nesta rodada:**

20. **E-mails de "contrato assinado" só saíam se a proposta tivesse lead no CRM.** Proposta criada direto no gerador (a maioria) não avisava cliente, comercial nem diretores quando o contrato era assinado. Agora os e-mails saem sempre; só a atualização do lead continua condicional.
21. **O cliente nunca recebia o e-mail de "contrato assinado"**, mesmo com lead. O webhook buscava a proposta sem as colunas `email`, `nome_socio` e `valor_total`, então o destinatário era `undefined`. O aviso aos diretores também ia sem valor e sem nome do sócio.
22. **Falha no D4Sign ficava escondida.** Se o envio do contrato falhava, o cliente lia "Contrato enviado para assinatura" e ninguém da equipe sabia. Agora:
    - o cliente recebe "Nossa equipe enviará o contrato em breve";
    - a resposta traz `contratoEnviado`;
    - sai um e-mail interno "⚠️ CONTRATO NÃO ENVIADO AO D4SIGN" (para `NOTIFY_EMAIL`, mesmo destino do aviso de aprovação).

    Isso vale para aprovação total e parcial. Testado com credenciais inválidas contra o sandbox da D4Sign.
23. **Mock do D4Sign incompleto.** Em teste, o fluxo parava em "chaves de assinatura". O mock agora devolve chaves falsas e o ciclo local vai até o e-mail de assinatura. Isso não afeta a produção.

24. **Página do cliente com marca errada.** Proposta Tech (e também Lagerhaus/Auditoria) mostrava o bloco "Como funciona a troca da sua contabilidade para a FINORA?" e a aba dizia "FINORA". Agora o título usa a marca da proposta e o bloco de troca de contador aparece só para FINORA e QMAX Contábil, com o nome da marca. Os modais com texto fixo "FINORA" (FAQ, comparativo fiscal, diagnóstico, ROI e slides) não são abertos por nenhum botão da página e ficaram como estão.

> As correções 20–24 estão no branch `validacao-2026-10` e ainda não foram publicadas: falta um novo merge em `main`.

## Envio real ao D4Sign (conta live, 08/10)

Teste local com o banco de teste, mas com as credenciais reais do D4Sign (mesmo cofre de produção). O cliente da proposta foi `lucas.borges@grupoqmax.com.br`.

- Proposta Nº 20260016 "TESTE VALIDAÇÃO SISTEMA (D4Sign)" aprovada pela tela com assinatura desenhada.
- O D4Sign aceitou: documento `01a11caa-1ad7-7ec9-aabb-ffd67b5dc6ec`, 3 páginas, status **"Aguardando Assinaturas"**, 4 signatários (cliente, Hugo, Alessandra como testemunha, financeiro@ com aviso de recebimento). Isso foi confirmado direto na API do D4Sign.
- O link real de assinatura foi gerado e o D4Sign enviou os e-mails dele. Os e-mails do próprio sistema ficaram só capturados localmente.
- O webhook foi registrado com URL `localhost`, então a confirmação de assinatura deste documento não volta ao sistema. O pós-assinatura foi simulado localmente: e-mails para cliente, comercial e diretores ok.
- **O documento ficou ativo** por decisão do responsável. Hugo, Alessandra e financeiro@ receberam o pedido de assinatura de um contrato de teste.

**Corrigido nesta rodada:**

25. **Chave da API do D4Sign gravada nos logs.**
    - A URL do webhook usava `?secret=<cryptKey da API>` e era impressa no log a cada envio.
    - Cada chamada do D4Sign também gravava a chave no log HTTP. O JWT do SSE (`?token=`) ia para o log do mesmo jeito.
    - Agora o log HTTP mascara `secret=` e `token=` como `***`, e o log do D4Sign mostra a URL sem a query.
    - Há a opção de um segredo próprio, `D4SIGN_WEBHOOK_SECRET`, no lugar da cryptKey. O segredo antigo continua aceito, para os documentos já registrados não deixarem de avisar.
    - A validação passou a usar a mesma fonte de configuração do registro; antes podia divergir quando as credenciais vinham do banco.
    - **Recomendado:** gerar a cryptKey de novo no painel do D4Sign, porque ela já está nos logs antigos do PM2, e definir `D4SIGN_WEBHOOK_SECRET`.
26. **Acentos sumiam do nome do documento no D4Sign** ("VALIDAÇÃO" virava "VALIDAO"). Agora são convertidos ("VALIDACAO").

## Teste por empresa (FINORA, QMAX Contábil, Tech, Auditoria, Lagerhaus)

Ambiente local com D4Sign simulado, cada empresa escolhida pelo próprio card do gerador. Também foi testado um caso de Pessoa Física.

| Verificação | FINORA | Contábil | Tech | Auditoria | Lagerhaus |
|---|---|---|---|---|---|
| Catálogo de serviços próprio no gerador | ✅ | ✅ | ✅ (planos) | ✅ | ✅ |
| Preço conferido no servidor (sem aprovação indevida) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Página do cliente: título e marca | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bloco "troca de contabilidade" | aparece | aparece | oculto | oculto | oculto |
| PDF da proposta com a marca certa | ✅ | ✅ | ✅ | ✅ (corrigido) | ✅ (corrigido) |
| E-mails com a marca certa | ✅ | ✅ | ✅ | ✅ (corrigido) | ✅ |
| Aprovação + contrato (simulado) | ✅ | ✅ | ✅ | ✅ | ✅ |

**Corrigido nesta rodada:**

27. **Link público `/p/<número>` expunha propostas de qualquer cliente (falha grave, em produção hoje).** A rota curta aceitava id e número sequencial da proposta, além do token. Bastava abrir `grupoqmax.com.br/p/1`, `/p/2`… para ver dados de clientes (nome, CNPJ, CPF, e-mail, valores) e até aprovar ou recusar. Agora só o token aleatório abre a proposta; id e número caem em "link inválido".
28. **Rodapé dos PDFs com link de validação quebrado.** Os PDFs eram gerados sem o token e imprimiam "SHA-256 [FINORA-SECURE...] • Validação: /p/FINORA-SECURE" em todas as páginas, de todas as marcas. Agora o token é passado em todas as gerações (proposta, desconto, renegociação e contrato do D4Sign) e o rodapé traz o link completo (`<BASE_URL>/p/<token>`). Na prévia sem proposta salva, aparece "Prévia - documento sem validação". O emoji do cadeado, que a fonte do PDF não desenha e saía como "Ø=Þáþ", foi removido.
29. **PDF da proposta de Auditoria e Lagerhaus saía como FINORA** (nome, assinatura e texto "O FINORA foi desenvolvido…"). Agora cada uma tem cabeçalho e assinatura próprios (nome em texto, porque não há logo dessas marcas em `public/assets/logos`) e não recebe a apresentação de outra marca.
30. **Auditoria padronizada como "QMAX Auditoria"** nos e-mails, antes "FINORA Auditoria".
31. **Cobranças de contabilidade em propostas de outras marcas.** Certificado Digital (R$ 220, campo escondido com padrão "Não possui"), Pró-labore (R$ 70 por sócio) e Departamento Pessoal entravam sozinhos em Auditoria e Lagerhaus. O Certificado também entrava em Pessoa Física. Agora esses itens (e os regulatórios) só entram em FINORA e QMAX Contábil, e o Certificado só quando o campo está visível.

32. **Link curto `/p/<token>` era 404 em produção.** O proxy do servidor só encaminha `/proposta` e `/api` para o sistema, e `/p/...` caía no site institucional. Isso quebrava o link dos e-mails de follow-up enviados aos clientes, o "copiar link curto" da página do cliente e o link do rodapé dos PDFs. Pelo mesmo motivo, a falha do item 27 não estava acessível de fora em produção. Agora o link é `/proposta/p/<token>` (e `/p/` continua aceito). Publicado em 09/10 (PRs #4 e #5); conferido em produção que id e número caem em "link inválido".

**Pendente, crítico (dados da empresa necessários):**
- **Contratos com contratada errada ou CNPJ suspeito.** Existem dois textos de contrato diferentes:
  - **Pré-visualização do cliente** (`/contrato`, `services/contratoService.js`): usa CNPJs que parecem fictícios (FINORA 50.123.456/0001-89, Contábil 45.987.654/0001-12, Tech 48.321.654/0001-34, Auditoria 52.456.789/0001-01). A **Lagerhaus** sai em nome de "FINORA GESTÃO FINANCEIRA E BPO LTDA".
  - **Contrato enviado ao D4Sign** (`services/pdfService.js`, preâmbulo): usa para todas as marcas o "escritório contábil" de CNPJ 12.552.249/0001-99 e CRC, com Hugo como contador, inclusive em Tech e Lagerhaus.

  É preciso definir razão social e CNPJ reais de cada empresa e unificar os dois textos.
- O PDF da Tech não tem rodapé de validação (gerador próprio).

## Pontos para decisão (não alterados)
- **`BASE_URL` no `.env` do servidor:** confirme que é `https://grupoqmax.com.br`. Nenhuma rota de leitura mostra esse valor, e com `localhost` os links dos e-mails não abrem para o cliente.
- **Ação no deploy (feita em 08/10):** `WEBHOOK_SECRET` definido no servidor. Falta atualizar as URLs/headers nas ferramentas que chamam `/api/webhooks/leads` e `/api/webhooks/onboarding/notificar`.
- **Servidor:** disco em 93,55%; o processo `sistema` reiniciou 1267 vezes e o `qmax-api` está parado (outros sistemas no mesmo servidor).
- **Proxy:** confirme que o Nginx/Apache aceita corpo de até 25 MB (`client_max_body_size 25m`). Sem isso, o upload continua barrado no proxy.
- Se a consulta de CNPJ (receitaws) falhar, o status fica "ATIVA" (*fail-open*).
- **Os scripts `tests/test-*.js` (exceto `run-tests.js`) e `scripts/*` usam o `.env` de produção.**
- O JWT trafega em query string no SSE (`/api/notifications/stream?token=`). Não aparece mais nos logs HTTP (item 25), mas continua na URL.
- O botão "Objeções" em `index.html` usa um emoji de alvo/mira como ícone.

## Como repetir
1. Inicie o MariaDB de teste na porta 3307. A pasta de dados fica no scratchpad desta sessão; em outra máquina, crie um banco `proposta_test` com o schema de produção.
2. Rode `npm test`, que usa `.env.test`.
3. Suba o servidor com `.claude/launch.json` (configuração `finora-test`), que roda o `server.js` com `NODE_ENV=test` na porta 3015.
4. Use os usuários de QA definidos em `.env.test`.
