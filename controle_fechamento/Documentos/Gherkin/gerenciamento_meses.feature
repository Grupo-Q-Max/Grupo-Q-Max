Feature: Gerenciamento de Meses

    Scenario: Bloquear um mês para edição 
        Given que o administrador está logado no Painel de Gestão Geral
        And a lista de meses está visível
        And o mÊs "Janeiro/2025" está com o status "Liberada"
        When o administrador clica no botão "Bloquear Edição" para o mês "Janeiro/2025"
        Then o status de edição do mês "Janeiro/2025" deve ser alterado para "Bloqueada"
        And uma mensagem de sucesso deve ser exibida