Feature: Edição de Dados na Tabela
Scenario: Alterar um campo de texto e salvar com sucesso
Given que o usuário está logado na página do seu setor (ex: dp.php)
And que a Edição para o mês está "Liberada"
And que a tabela exibe a lista de empresas
When ele clica na célula "Observação" de uma empresas
And ele edita o conteúdo da célula para "Verificar novo contrato."
And ele clica fora da célula para salvar
Then o sistema deve enviar uma requisição para o backend
And a célula deve ser atualizada com o novo valor "Veificar novo contrato."
And o usuário deve receber uma notificação de sucesso