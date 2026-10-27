Feature: Delegação Individual de Tarefas 
    Scenario: Delegar uma empresa para um funcionário
        Given que o administrador está na tela "Gerenciar Funcionários"
        And a tabela de empresas ativas está visível
        And a empresa "Exemplo Ltda" não tem nenhuma tarefa "Fiscal" delegada
        When o administrador clica no botão "Delegar" para a empresa "Exemplo Ltda"
        And ele seleciona o "Responsável" como "Rodrigo Dante Penhalves"
        And ele clica no botão "Salvar" no modal
        Then a delegação da tarefa "Fiscal" para a empresa "Exemplo Ltda" deve ser salva
        And a empresa "Exemplo Ltda" deve aparecer no painel do funcionário "Rodrigo Penhalves"
        And o status de "Fiscal" da empresa deve ser atualizado para "Delegar"