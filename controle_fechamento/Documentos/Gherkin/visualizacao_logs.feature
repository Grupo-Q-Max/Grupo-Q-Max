Feature: Visualização de Logs de Atividade

    Scenario: Acessar e filtrar logs de alteração de um funcionário
        Given que o líder está logado no Painel de Liderança
        When ele clica no botão "Logs de Alterações"
        And ele clica na aba do funcionário "Rodrigo Penhalves"
        Then o sistema deve exibir o histórico de alterações feitas por "Rodrigo Penhalves"
        And os dados da tabela devem incluir a data/hora, a empresa, o campo alterado e os valores antigo e novo
