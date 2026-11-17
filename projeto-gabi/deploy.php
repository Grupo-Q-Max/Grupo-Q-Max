<?php
/**
 * Script de Deploy Automático para Webmin / Virtualmin / Apache
 * Chamado pelo Webhook do Azure DevOps ou acessado via navegador
 */

// Define o diretório atual
$dir = __DIR__;
chdir($dir);

// Executa o git pull
$output = [];
$return_code = 0;
exec('GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git pull origin main 2>&1', $output, $return_code);
if ($return_code !== 0) {
    exec('GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" git pull origin master 2>&1', $output, $return_code);
}

// Se o pull foi um sucesso, copia a pasta "quiz" para o diretório pai (que deve ser a raiz grqm/grupoqmax.com.br)
if ($return_code === 0) {
    exec('cp -r ' . __DIR__ . '/quiz ' . dirname(__DIR__) . '/quiz 2>&1', $output_cp, $return_code_cp);
    $output = array_merge($output, $output_cp);
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'status' => $return_code === 0 ? 'success' : 'error',
    'message' => $return_code === 0 ? 'Deploy realizado com sucesso!' : 'Erro ao executar git pull',
    'timestamp' => date('Y-m-d H:i:s'),
    'output' => $output
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
