Feature: Autenticação de Usuário
Scenario: Login com sucesso usando credenciais válidas 
Given que o usuário está na página de login 
When ele insere seu "nome de usuário" e "senha" válidos 
And ele clica no botão "Acessar Sistema"
Then ele deve ser redirecionado para a página do seu perfil (DP, Fiscal, Contábil, etc.)
And ele deve ver uma mensagem de sucesso "Login realizado com sucesso!"