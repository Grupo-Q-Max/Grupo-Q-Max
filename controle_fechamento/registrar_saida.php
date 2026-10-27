<?php
session_start();
require_once 'assets/backend/config.php';

if (isset($_SESSION['log_id'])) {
    $log_id = $_SESSION['log_id'];

    @$stmt = $conexao->prepare(
        "UPDATE logs_acesso 
         SET 
             data_logout = NOW(), 
             duracao_sessao_min = TIMESTAMPDIFF(MINUTE, data_login, NOW()),
             duracao_sessao_horas = TIMESTAMPDIFF(SECOND, data_login, NOW()) / 3600 -- <<< ALTERAÇÃO AQUI
         WHERE id = ? AND data_logout IS NULL"
    );
    @$stmt->bind_param('i', $log_id);
    @$stmt->execute();
    @$stmt->close();
}

exit();
