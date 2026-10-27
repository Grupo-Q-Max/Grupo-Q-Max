Feature: Delegação de Tarefas em Massa

Scenario: Delegar múltiplas empresas para um ou mais funcionários
    Given que o líder está logado no Painel de Liderança
    And que a lista de empresas está visível
    And que a lista de funcionários está visível
    When o líder seleciona as empresas "Empresa A", "Empresa B" e "Empresa C"
    And ele seleciona os funcionários "Evandro" e "Yuri"
    And ele clica no botão "Confirmar e Delegar"
    Then o sistema deve processar a delegação para todas as empresas e funcionários selecionados
    And o sistema deve exibir uma mensagem de sucesso indicando quantas delegações foram criadas
    And os funcionários "Evandro" e "Yuri" devem ver as empresas delegadas em seus painéis