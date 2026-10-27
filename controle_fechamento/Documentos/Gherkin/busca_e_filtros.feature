Feature: Busca e Filtros de Empresas 

    Scenario: Filtrar empresas por tributação e responsável
        Given que o líder está na tela de gestão "DP Admin"
        And que a tabela de empresas exibe todas as empresas do mês
        When ele seleciona a "Tributação" como "Simples Nacional"
        And ele seleciona o "Responsável" como "Rodrigo Dante Penhalves"
        And ele clica no botão "Filtrar"
        Then a tabela deve exibir apenas as empresas com a tributação "Simples Nacional"
        And que são delegadas ao responsável "Rodeigo Dante Penhalves"
        And os cards de estatísticas devem ser atualizados para refletir o resultado do filtro