Feature: Alteração de Senha
    Scenario: Trocar a senha com a senha atual incorreta
        Given que o usuário está logado em qualquer página do sistema
        And que ele abre o modal de "Alterar Senha"
        When ele insere a "senha atual" incorreta
        And ele insere uma "nova senha" e "confirma" a nova senha
        And ele clica no botão "Salvar Alterações"
        Then o botão "Salvar Alterações" deve mostrar um spinner de carregamento
        And o modal não deve fechar
        And o sistema deve exibir uma mensagem de erro "A senha atual está incorreta."
        And o botão deve ser reativado 