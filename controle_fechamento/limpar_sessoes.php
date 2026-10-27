<?php
// Este script deve ser chamado por uma Cron Job no seu servidor
require_once 'assets/backend/config.php';

// Define o tempo limite. Qualquer sessão sem atividade por mais de 15 minutos será encerrada.
$minutos_limite = 15;

// Encontra todos os logs abertos (data_logout IS NULL)
// cuja última atividade foi há mais de X minutos.
$query = "
    UPDATE logs_acesso
    SET 
        data_logout = ultima_atividade,
        duracao_sessao_min = TIMESTAMPDIFF(MINUTE, data_login, ultima_atividade),
        duracao_sessao_horas = TIMESTAMPDIFF(SECOND, data_login, ultima_atividade) / 3600
    WHERE 
        data_logout IS NULL 
        AND ultima_atividade < NOW() - INTERVAL ? MINUTE
";

$stmt = $conexao->prepare($query);
$stmt->bind_param('i', $minutos_limite);
$stmt->execute();

// Imprime quantas sessões foram encerradas (útil para o log da Cron Job)
echo "Sessões encerradas: " . $stmt->affected_rows;
$stmt->close();
?>