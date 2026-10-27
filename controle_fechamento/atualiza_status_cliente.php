<?php
// Define o caminho para o PHP CLI (Command Line Interface), bom para scripts de automação
#!/usr/bin/php
/**
 * Script de Automação para Atualizar Status de Clientes
 * * Finalidade: Manter a tabela 'controle_fechamento' atualizada, preenchendo
 * os campos de meses com "Não é cliente" com base nas datas de obrigação e saída.
 * * Execução: Este script foi projetado para ser executado via Cron Job.
 */

// Define o fuso horário para evitar erros de data/hora
date_default_timezone_set('America/Sao_Paulo');

// Inclui o arquivo de configuração do banco de dados
// Use __DIR__ para garantir que o caminho esteja correto, não importa de onde o script seja chamado.
require_once __DIR__ . '/assets/backend/config.php';

// Função simples para registrar mensagens com data e hora
function log_message($message) {
    echo "[" . date('Y-m-d H:i:s') . "] " . $message . PHP_EOL;
}

log_message("--- INICIANDO SCRIPT DE ATUALIZAÇÃO DE STATUS DE CLIENTES ---");

// Texto padrão para status de não-cliente
$texto_status = 'Não é cliente';

// Lista das colunas de meses que serão verificadas e atualizadas
$meses_colunas = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

try {
    // ----------------------------------------------------------------------------------
    // TAREFA 1: Atualizar meses ANTERIORES à data_obrigacao
    // ----------------------------------------------------------------------------------
    log_message("Verificando meses anteriores à DATA DE OBRIGAÇÃO...");

    foreach ($meses_colunas as $index => $mes_coluna) {
        $mes_numero = $index + 1; // Converte o nome do mês para número (janeiro = 1, etc.)

        $sql = "
            UPDATE controle_fechamento cf
            JOIN controle_meses cm ON cf.id_mes = cm.id
            SET 
                cf.`{$mes_coluna}` = ?
            WHERE
                cf.data_obrigacao IS NOT NULL
                AND (cf.`{$mes_coluna}` IS NULL OR cf.`{$mes_coluna}` != ?)
                AND (
                    YEAR(cf.data_obrigacao) > cm.ano 
                    OR 
                    (YEAR(cf.data_obrigacao) = cm.ano AND MONTH(cf.data_obrigacao) > {$mes_numero})
                )
        ";

        $stmt = $conexao->prepare($sql);
        $stmt->bind_param('ss', $texto_status, $texto_status);
        $stmt->execute();
        
        if ($stmt->affected_rows > 0) {
            log_message(" -> {$stmt->affected_rows} registro(s) atualizado(s) para o mês '{$mes_coluna}' (baseado na data de obrigação).");
        }
        $stmt->close();
    }
    log_message("Verificação de data de obrigação concluída.");


    // ----------------------------------------------------------------------------------
    // TAREFA 2: Atualizar meses POSTERIORES à data_saida
    // ----------------------------------------------------------------------------------
    log_message("Verificando meses posteriores à DATA DE SAÍDA...");

    foreach ($meses_colunas as $index => $mes_coluna) {
        $mes_numero = $index + 1; // Converte o nome do mês para número (janeiro = 1, etc.)

        $sql = "
            UPDATE controle_fechamento cf
            JOIN controle_meses cm ON cf.id_mes = cm.id
            SET 
                cf.`{$mes_coluna}` = ?
            WHERE
                cf.data_saida IS NOT NULL
                AND (cf.`{$mes_coluna}` IS NULL OR cf.`{$mes_coluna}` != ?)
                AND (
                    YEAR(cf.data_saida) < cm.ano 
                    OR 
                    (YEAR(cf.data_saida) = cm.ano AND MONTH(cf.data_saida) < {$mes_numero})
                )
        ";

        $stmt = $conexao->prepare($sql);
        $stmt->bind_param('ss', $texto_status, $texto_status);
        $stmt->execute();

        if ($stmt->affected_rows > 0) {
            log_message(" -> {$stmt->affected_rows} registro(s) atualizado(s) para o mês '{$mes_coluna}' (baseado na data de saída).");
        }
        $stmt->close();
    }
    log_message("Verificação de data de saída concluída.");


} catch (Exception $e) {
    log_message("!!! ERRO DURANTE A EXECUÇÃO: " . $e->getMessage());
}

log_message("--- SCRIPT FINALIZADO ---" . PHP_EOL);

// Fecha a conexão com o banco de dados
$conexao->close();

?>