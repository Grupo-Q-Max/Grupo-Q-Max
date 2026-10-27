Feature: Importação de Empresas
    
    Scenario: Importar empresas de uma planilha Excel com sucesso
        Given que o usuário está na tela de "Cadastro de Empresas"
        And uma planilha chamada "novas_empresas.xlsx" com as colunas "enpresa" e "cnpj" está disponível
        And que nenhum CNPJ na planilha já existe no sistema
        When o usuário seleciona e enviar a planilha "novas_empresas.xlsx"
        And o sistema processa o arquivo
        Then o sistema deve cadastrar todas as empresas da planilha
        And uma mensagem de sucesso deve ser exibida, indicando o número de empresas importadas 