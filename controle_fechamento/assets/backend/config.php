<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);
function logMessage($message)
{
    $logFile = __DIR__ . '/replication_log.txt';
    $formattedMessage = '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    file_put_contents($logFile, $formattedMessage, FILE_APPEND);
}
// Carregar variÃ¡veis de ambiente se disponÃ­veis (.env na raiz do projeto)
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $val) = explode('=', $line, 2);
            $name = trim($name);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            if (!getenv($name)) {
                putenv("$name=$val");
                $_ENV[$name] = $val;
            }
        }
    }
}

$dbHost = getenv('DB_HOST') ?: '74.249.25.198';
$dbUsername = getenv('DB_USER') ?: 'controle_fechamento';
$dbUser = $dbUsername;
$dbPassword = getenv('DB_PASS') ?: 'By!U-Hr/8lOPa(y*';
$dbPass = $dbPassword;
$dbName = getenv('DB_NAME') ?: 'controle_fechamento';
$dbPort = (int)(getenv('DB_PORT') ?: 33306);

$conexao = mysqli_init();
if ($dbHost && (strpos($dbHost, 'azure.com') !== false || getenv('DB_SSL') === 'true')) {
    $conexao->ssl_set(NULL, NULL, NULL, NULL, NULL);
    $flags = MYSQLI_CLIENT_SSL;
} else {
    $flags = 0;
}

if (!$conexao->real_connect($dbHost, $dbUsername, $dbPassword, $dbName, $dbPort, NULL, $flags)) {
    die("Erro de conexão: " . $conexao->connect_error);
}

if (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['log_id'])) {

    $log_id_atual = $_SESSION['log_id'];

    $stmt_check = $conexao->prepare("SELECT data_logout FROM logs_acesso WHERE id = ?");
    $stmt_check->bind_param('i', $log_id_atual);
    $stmt_check->execute();
    $result_check = $stmt_check->get_result();

    if ($result_check->num_rows > 0) {
        $log_info = $result_check->fetch_assoc();

        if ($log_info['data_logout'] !== null) {

            session_unset();
            session_destroy();

            session_start();
            $_SESSION['mensagem_login'] = 'Sua sessÃ£o anterior foi encerrada. Por favor, faÃ§a login novamente.';

            header("Location: index.php");
            exit();
        }
    }
    $stmt_check->close();
}


function verificarEAtualizarStatusDP($conexao, $id_empresa)
{
    $campos_obrigatorios_dp = [
        'adto',
        'folha_pagamento',
        'data_pagamento',
        'qtde_funcionarios',
        'guias_sindicato',
        'dissidio',
        'fgts_digital',
        'e_social',
        'dctf_web_mes',
        'reinf',
        'sd_login',
        'sd_senha'
    ];

    $colunas_sql = implode(', ', $campos_obrigatorios_dp);

    $stmt_verificar = $conexao->prepare("SELECT {$colunas_sql} FROM controle_fechamento WHERE id = ?");
    if (!$stmt_verificar) {
        return;
    }

    $stmt_verificar->bind_param('i', $id_empresa);
    $stmt_verificar->execute();
    $dados_empresa = $stmt_verificar->get_result()->fetch_assoc();
    $stmt_verificar->close();

    if (!$dados_empresa) {
        return;
    }

    $esta_completo = true;
    foreach ($campos_obrigatorios_dp as $campo) {
        if (empty(trim($dados_empresa[$campo] ?? ''))) {
            $esta_completo = false;
            break;
        }
    }

    $novo_status = $esta_completo ? 'completo' : 'Pendente';

    $stmt_atualizar = $conexao->prepare("UPDATE controle_fechamento SET status_dp = ? WHERE id = ?");
    if ($stmt_atualizar) {
        $stmt_atualizar->bind_param('si', $novo_status, $id_empresa);
        $stmt_atualizar->execute();
        $stmt_atualizar->close();
    }
}
function verificarDadosCompletosENotificar($conexao, $id_empresa, $id_mes)
{
    $campos_fiscal = ['impostos', 'iss', 'mit', 'reinf'];
    $campos_dp = [
        'adto',
        'folha_pagamento',
        'data_pagamento',
        'qtde_funcionarios',
        'guias_sindicato',
        'dissidio',
        'fgts_digital',
        'e_social',
        'dctf_web_mes',
        'reinf'
    ];

    $stmt = $conexao->prepare("SELECT " . implode(', ', $campos_fiscal) . " FROM controle_fechamento WHERE id = ?");
    $stmt->bind_param('i', $id_empresa);
    $stmt->execute();
    $result = $stmt->get_result();
    $dados_fiscais = $result->fetch_assoc();

    $fiscal_completo = true;
    foreach ($campos_fiscal as $campo) {
        if (empty($dados_fiscais[$campo])) {
            $fiscal_completo = false;
            break;
        }
    }

    $stmt = $conexao->prepare("SELECT " . implode(', ', $campos_dp) . " FROM controle_fechamento WHERE id = ?");
    $stmt->bind_param('i', $id_empresa);
    $stmt->execute();
    $result = $stmt->get_result();
    $dados_dp = $result->fetch_assoc();

    $dp_completo = true;
    foreach ($campos_dp as $campo) {
        if (empty($dados_dp[$campo])) {
            $dp_completo = false;
            break;
        }
    }

    if ($fiscal_completo && $dp_completo) {
        $stmt = $conexao->prepare("SELECT empresa FROM controle_fechamento WHERE id = ?");
        $stmt->bind_param('i', $id_empresa);
        $stmt->execute();
        $result = $stmt->get_result();
        $empresa = $result->fetch_assoc()['empresa'];

        $stmt = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
        $stmt->bind_param('i', $id_mes);
        $stmt->execute();
        $result = $stmt->get_result();
        $mes_info = $result->fetch_assoc();
        $nome_mes = [
            1 => 'Janeiro',
            2 => 'Fevereiro',
            3 => 'MarÃ§o',
            4 => 'Abril',
            5 => 'Maio',
            6 => 'Junho',
            7 => 'Julho',
            8 => 'Agosto',
            9 => 'Setembro',
            10 => 'Outubro',
            11 => 'Novembro',
            12 => 'Dezembro'
        ][$mes_info['mes']];

        $stmt = $conexao->prepare("
                SELECT u.id, u.nome 
                FROM responsaveis_empresa re
                JOIN usuarios u ON re.id_usuario = u.id
                WHERE re.id_empresa = ? AND re.id_mes = ? AND re.responsavel_atual = 1 AND u.tipo_conta = 'contabil'
            ");
        $stmt->bind_param('ii', $id_empresa, $id_mes);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $contador = $result->fetch_assoc();
            $mensagem = "Todos os dados fiscais e de DP foram preenchidos para a empresa {$empresa} no mÃªs de {$nome_mes}/{$mes_info['ano']}";

            $stmt = $conexao->prepare("
                    INSERT INTO notificacoes 
                    (id_usuario, mensagem, tipo, id_empresa, id_mes, status) 
                    VALUES (?, ?, 'dados_completos', ?, ?, 'pendente')
                ");
            $stmt->bind_param('isii', $contador['id'], $mensagem, $id_empresa, $id_mes);
            $stmt->execute();
        }
    }
}

function obterDadosMes($conexao, $mes_id)
{
    $stmt = $conexao->prepare("SELECT * FROM controle_meses WHERE id = ?");
    $stmt->bind_param('i', $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_assoc();
}

function obterResponsavelAtual($conexao, $id_empresa, $id_mes)
{
    $stmt = $conexao->prepare("
            SELECT id_usuario 
            FROM responsaveis_empresa 
            WHERE id_empresa = ? AND id_mes = ? AND responsavel_atual = 1
        ");
    $stmt->bind_param('ii', $id_empresa, $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    return $result->num_rows > 0 ? $result->fetch_assoc()['id_usuario'] : null;
}

function atribuirResponsavel($conexao, $id_empresa, $id_usuario, $id_mes)
{
    $stmt = $conexao->prepare("
            UPDATE responsaveis_empresa 
            SET responsavel_atual = 0 
            WHERE id_empresa = ? AND id_mes = ?
        ");
    $stmt->bind_param('ii', $id_empresa, $id_mes);
    $stmt->execute();

    $stmt = $conexao->prepare("
            SELECT id FROM responsaveis_empresa 
            WHERE id_empresa = ? AND id_usuario = ? AND id_mes = ?
        ");
    $stmt->bind_param('iii', $id_empresa, $id_usuario, $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $stmt = $conexao->prepare("
                UPDATE responsaveis_empresa 
                SET responsavel_atual = 1, data_atribuicao = CURRENT_TIMESTAMP 
                WHERE id_empresa = ? AND id_usuario = ? AND id_mes = ?
            ");
    } else {
        $stmt = $conexao->prepare("
                INSERT INTO responsaveis_empresa 
                (id_empresa, id_usuario, id_mes, responsavel_atual) 
                VALUES (?, ?, ?, 1)
            ");
    }

    $stmt->bind_param('iii', $id_empresa, $id_usuario, $id_mes);
    return $stmt->execute();
}
function replicarResponsaveisParaNovoMes($conexao, $id_mes_anterior, $id_mes_novo)
{
    logMessage("--- Iniciando replicaÃ§Ã£o de responsÃ¡veis ---");
    logMessage("MÃªs Anterior ID: $id_mes_anterior | Novo MÃªs ID: $id_mes_novo");

    // A transaÃ§Ã£o agora Ã© controlada pela funÃ§Ã£o principal (criarNovoMesSeNecessario)

    try {
        $stmt_delete = $conexao->prepare("DELETE FROM responsaveis_empresa WHERE id_mes = ?");
        $stmt_delete->bind_param('i', $id_mes_novo);
        $stmt_delete->execute();
        logMessage("Registros de responsÃ¡veis existentes para o novo mÃªs foram limpos.");

        $count_query = "
            SELECT COUNT(re.id) as total
            FROM responsaveis_empresa re
            JOIN controle_fechamento empresa_antiga ON re.id_empresa = empresa_antiga.id
            WHERE re.id_mes = ? AND empresa_antiga.cnpj IS NOT NULL AND empresa_antiga.cnpj != ''
        ";
        $stmt_count = $conexao->prepare($count_query);
        $stmt_count->bind_param('i', $id_mes_anterior);
        $stmt_count->execute();
        $total_encontrado = $stmt_count->get_result()->fetch_assoc()['total'];
        logMessage("Total de responsÃ¡veis encontrados no mÃªs anterior: $total_encontrado");

        if ($total_encontrado == 0) {
            logMessage("Nenhum responsÃ¡vel encontrado para replicar. Processo concluÃ­do sem inserÃ§Ãµes.");
            return true;
        }

        // Query principal com a correÃ§Ã£o GROUP BY
        $query = "
            INSERT INTO responsaveis_empresa 
                (id_empresa, id_usuario, id_mes, responsavel_atual, tipo_tarefa, data_atribuicao)
            SELECT 
                nova_empresa.id,
                re.id_usuario,
                ?, 
                re.responsavel_atual,
                re.tipo_tarefa,
                NOW()
            FROM 
                responsaveis_empresa re
            JOIN 
                controle_fechamento empresa_antiga ON re.id_empresa = empresa_antiga.id
            JOIN 
                controle_fechamento nova_empresa ON TRIM(empresa_antiga.cnpj) = TRIM(nova_empresa.cnpj) AND nova_empresa.id_mes = ?
            WHERE 
                re.id_mes = ? 
                AND empresa_antiga.cnpj IS NOT NULL 
                AND empresa_antiga.cnpj != ''
            -- ADIÃ‡ÃƒO DA LINHA ABAIXO PARA EVITAR DUPLICATAS --
            GROUP BY nova_empresa.id, re.id_usuario, re.responsavel_atual, re.tipo_tarefa
        ";

        $stmt_insert = $conexao->prepare($query);
        $stmt_insert->bind_param('iii', $id_mes_novo, $id_mes_novo, $id_mes_anterior);

        if (!$stmt_insert->execute()) {
            throw new Exception("Falha ao executar a query de inserÃ§Ã£o de responsÃ¡veis: " . $stmt_insert->error);
        }

        $linhas_afetadas = $stmt_insert->affected_rows;
        logMessage("ReplicaÃ§Ã£o de responsÃ¡veis executada. Linhas inseridas: $linhas_afetadas");

        if ($linhas_afetadas < $total_encontrado) {
            logMessage("AVISO: O nÃºmero de responsÃ¡veis inseridos ($linhas_afetadas) Ã© menor que o total encontrado ($total_encontrado). Isso pode ser devido a CNPJs duplicados no mÃªs anterior, o que Ã© esperado com a nova clÃ¡usula GROUP BY.");
        }

        logMessage("--- ReplicaÃ§Ã£o de responsÃ¡veis concluÃ­da com sucesso (dentro da transaÃ§Ã£o). ---");
        return true;
    } catch (Exception $e) {
        logMessage("ERRO CRÃTICO ao replicar responsÃ¡veis: " . $e->getMessage());
        error_log('Erro ao replicar responsÃ¡veis: ' . $e->getMessage());
        // NÃ£o faz rollback/commit aqui, deixa a funÃ§Ã£o principal fazer isso.
        throw $e; // Re-lanÃ§a a exceÃ§Ã£o para que a funÃ§Ã£o principal possa capturÃ¡-la e fazer o rollback.
    }
}
function obterNomeUsuario($conexao, $id_usuario)
{
    $stmt = $conexao->prepare("SELECT nome FROM usuarios WHERE id = ?");
    $stmt->bind_param('i', $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->num_rows > 0 ? $result->fetch_assoc()['nome'] : 'Desconhecido';
}
function replicarParcelamentosParaNovoMes($conexao, $id_mes_anterior, $id_novo_mes)
{
    logMessage("--- Iniciando replicaÃ§Ã£o de parcelamentos ---");
    logMessage("MÃªs Anterior ID: $id_mes_anterior | Novo MÃªs ID: $id_novo_mes");

    try {
        // Query para encontrar e replicar os parcelamentos elegÃ­veis, incluindo todas as colunas
        $query = "
              INSERT INTO parcelamentos (
                  codigo_empresa, nome_empresa, cnpj_empresa, parcelamento,
                  qtde_parcelas, data_efetivacao, data_final, valor,
                  envio, observacoes, id_usuario, status, id_mes,
                  ano, janeiro, fevereiro, marco, abril, maio, junho,
                  julho, agosto, setembro, outubro, novembro, dezembro
              )
              SELECT
                  p.codigo_empresa, p.nome_empresa, p.cnpj_empresa, p.parcelamento,
                  p.qtde_parcelas, p.data_efetivacao, p.data_final, p.valor,
                  p.envio, p.observacoes, p.id_usuario, p.status, ?, -- ParÃ¢metro 1: id_novo_mes
                  p.ano, p.janeiro, p.fevereiro, p.marco, p.abril, p.maio, p.junho,
                  p.julho, p.agosto, p.setembro, p.outubro, p.novembro, p.dezembro
              FROM
                  parcelamentos p
              WHERE
                  p.id_mes = ?               -- ParÃ¢metro 2: id_mes_anterior
                  AND p.status = 'ativo'       -- Apenas os que ainda estÃ£o ativos
                  AND p.data_final >= CURDATE()  -- Apenas se a data final ainda nÃ£o passou
          ";

        $stmt = $conexao->prepare($query);
        if ($stmt === false) {
            throw new Exception("Falha na preparaÃ§Ã£o da query de replicar parcelamentos: " . $conexao->error);
        }

        $stmt->bind_param('ii', $id_novo_mes, $id_mes_anterior);

        if (!$stmt->execute()) {
            throw new Exception("Falha ao executar a replicaÃ§Ã£o de parcelamentos: " . $stmt->error);
        }

        $linhas_afetadas = $stmt->affected_rows;
        logMessage("ReplicaÃ§Ã£o de parcelamentos executada. Novas tarefas de parcelamento criadas: $linhas_afetadas");
        logMessage("--- ReplicaÃ§Ã£o de parcelamentos concluÃ­da com sucesso. ---");

        return true;
    } catch (Exception $e) {
        logMessage("ERRO CRÃTICO ao replicar parcelamentos: " . $e->getMessage());
        error_log("Erro ao replicar parcelamentos: " . $e->getMessage());
        // Re-lanÃ§a a exceÃ§Ã£o para que a transaÃ§Ã£o principal faÃ§a o rollback
        throw $e;
    }
}

function obterHistoricoResponsaveis($conexao, $id_empresa)
{
    $stmt = $conexao->prepare("
            SELECT re.*, u.nome as nome_usuario, cm.mes, cm.ano 
            FROM responsaveis_empresa re
            JOIN usuarios u ON re.id_usuario = u.id
            JOIN controle_meses cm ON re.id_mes = cm.id
            WHERE re.id_empresa = ?
            ORDER BY cm.ano DESC, cm.mes DESC, re.data_atribuicao DESC
        ");
    $stmt->bind_param('i', $id_empresa);
    $stmt->execute();
    return $stmt->get_result();
}

function obterMesAtualAberto($conexao)
{

    $sql = "SELECT id FROM controle_meses WHERE status = 'aberto' LIMIT 1";
    $result = $conexao->query($sql);


    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        return (int)$row['id'];
    }

    return false;
}
function criarNovoMesSeNecessario($conexao)
{
    logMessage("Iniciando verificaÃ§Ã£o de necessidade de criar novo mÃªs...");
    date_default_timezone_set('America/Sao_Paulo');
    logMessage("Fuso horÃ¡rio definido para America/Sao_Paulo.");
    $mes_sistema = (int)date('n');
    $ano_sistema = (int)date('Y');

    // Busca o Ãºltimo mÃªs que estÃ¡ com status 'aberto' no banco de dados
    $stmt_aberto = $conexao->prepare("SELECT id, mes, ano FROM controle_meses WHERE status = 'aberto' ORDER BY ano DESC, mes DESC LIMIT 1");
    $stmt_aberto->execute();
    $result_aberto = $stmt_aberto->get_result();
    $id_mes_anterior = null;

    if ($result_aberto->num_rows > 0) {
        $mes_aberto_db = $result_aberto->fetch_assoc();
        $id_mes_anterior = (int)$mes_aberto_db['id'];
        $mes_db = (int)$mes_aberto_db['mes'];
        $ano_db = (int)$mes_aberto_db['ano'];

        if ($mes_db === $mes_sistema && $ano_db === $ano_sistema) {
            logMessage("O mÃªs aberto no banco ($mes_db/$ano_db) jÃ¡ Ã© o mÃªs atual do sistema. Nenhuma aÃ§Ã£o necessÃ¡ria.");
            return false;
        }
        logMessage("Detectada mudanÃ§a de mÃªs. MÃªs no DB: $mes_db/$ano_db. MÃªs do Sistema: $mes_sistema/$ano_sistema.");
    } else {
        logMessage("Nenhum mÃªs 'aberto' encontrado. Procurando Ãºltimo mÃªs fechado como base.");
        $stmt_fechado = $conexao->prepare("SELECT id FROM controle_meses ORDER BY ano DESC, mes DESC LIMIT 1");
        $stmt_fechado->execute();
        $result_fechado = $stmt_fechado->get_result();
        if ($result_fechado->num_rows === 0) {
            logMessage("ERRO: Nenhum mÃªs encontrado no banco de dados para iniciar a replicaÃ§Ã£o.");
            return false;
        }
        $id_mes_anterior = (int)$result_fechado->fetch_assoc()['id'];
        logMessage("Usando o Ãºltimo mÃªs fechado (ID: $id_mes_anterior) como base para a replicaÃ§Ã£o.");
    }

    $stmt_check_existe = $conexao->prepare("SELECT id FROM controle_meses WHERE mes = ? AND ano = ?");
    $stmt_check_existe->bind_param('ii', $mes_sistema, $ano_sistema);
    $stmt_check_existe->execute();
    if ($stmt_check_existe->get_result()->num_rows > 0) {
        $conexao->query("UPDATE controle_meses SET status = 'fechado' WHERE status = 'aberto'");
        $conexao->query("UPDATE controle_meses SET status = 'aberto' WHERE mes = $mes_sistema AND ano = $ano_sistema");
        error_log("Aviso: A entrada para o mÃªs $mes_sistema/$ano_sistema jÃ¡ existia. Nenhuma replicaÃ§Ã£o foi feita, apenas o status foi ajustado.");
        return false;
    }
    logMessage("Iniciando transaÃ§Ã£o para criar o novo mÃªs $mes_sistema/$ano_sistema.");
    $conexao->begin_transaction();

    try {
        $conexao->query("UPDATE controle_meses SET status = 'fechado', data_fechamento = NOW() WHERE status = 'aberto'");
        logMessage("MÃªs anterior (ID: $id_mes_anterior) foi fechado.");

        $stmt = $conexao->prepare("INSERT INTO controle_meses (mes, ano, status) VALUES (?, ?, 'aberto')");
        $stmt->bind_param('ii', $mes_sistema, $ano_sistema);
        $stmt->execute();
        $id_novo_mes = $conexao->insert_id;
        logMessage("Novo mÃªs (ID: $id_novo_mes) criado com sucesso.");


        // ==========================================================
        // QUERY DE REPLICAÃ‡ÃƒO ATUALIZADA (COPIA DADOS DE CONFIGURAÃ‡ÃƒO)
        // ==========================================================
        $query_empresas = "INSERT INTO controle_fechamento (
            -- Bloco 1: Dados Fixos
            codigo, empresa, cnpj, grupo, insc_estadual, insc_municipal, 
            login_prefeitura, senha_prefeitura_ginfes, senha_giss_online, 
            link_prefeitura, tributacao, tipo, envio, municipio, 
            data_contrato, data_obrigacao, data_saida, observacoes,
            observacoes_dp, observacoes_fiscal, observacoes_contabil, observacoes_cushman,
            
            -- Bloco 2: ContÃ¡bil
            janeiro, fevereiro, marco, abril, maio, junho, 
            julho, agosto, setembro, outubro, novembro, dezembro,
            balancete, distribuicao_dirf, defs, dasn, ecd, ecf,
            
            -- Bloco 3: Fiscais
            impostos, iss, mit, sped_fiscal, sped_contribuicao, destda, gia,

            -- Bloco 4: Certificados e IDs
            setores_permitidos, certificado_cliente, tipo_certificado, 
            senha_certificado, data_emissao_certificado, data_vencimento_certificado,
            data_procuracao_target, qtde_funcionarios, id_mes,
            
            -- Bloco 5: Status
            status, 
            
            -- Bloco 6: DP (COM NOVOS CAMPOS ADICIONADOS)
            adto, folha_pagamento, tipo_folha, data_pagamento, 
            guias_sindicato, dissidio, fgts_digital, e_social, 
            dctf_web_mes, reinf, 
            sd_login, sd_senha,               -- [!] ADICIONADO
            ADTO13, FOLHA13,                  -- [!] ADICIONADO
            data_calculo_adto13, data_envio_adto13,   -- [!] ADICIONADO
            data_calculo_folha13, data_envio_folha13, -- [!] ADICIONADO
            
            -- Bloco 7: Cushman
            iss_cushman, devec_cushman, sped_fiscal_cushman, reinf_cushman, esocial_cushman
        )
        SELECT 
            -- Bloco 1
            codigo, empresa, cnpj, grupo, insc_estadual, insc_municipal, 
            login_prefeitura, senha_prefeitura_ginfes, senha_giss_online, 
            link_prefeitura, tributacao, tipo, envio, municipio, 
            data_contrato, data_obrigacao, data_saida, observacoes,
            observacoes_dp, observacoes_fiscal, observacoes_contabil, observacoes_cushman,
            
            -- Bloco 2
            janeiro, fevereiro, marco, abril, maio, junho, 
            julho, agosto, setembro, outubro, novembro, dezembro,
            balancete, distribuicao_dirf, defs, dasn, ecd, ecf,

            -- Bloco 3 (Limpa se nÃ£o for N/A)
            CASE WHEN TRIM(UPPER(impostos)) IN ('N/A', 'N/TEM') THEN impostos ELSE NULL END,
            CASE WHEN TRIM(UPPER(iss)) IN ('N/A', 'N/TEM') THEN iss ELSE NULL END,
            CASE WHEN TRIM(UPPER(mit)) IN ('N/A', 'N/TEM') THEN mit ELSE NULL END,
            CASE WHEN TRIM(UPPER(sped_fiscal)) IN ('N/A', 'N/TEM') THEN sped_fiscal ELSE NULL END,
            CASE WHEN TRIM(UPPER(sped_contribuicao)) IN ('N/A', 'N/TEM') THEN sped_contribuicao ELSE NULL END,
            CASE WHEN TRIM(UPPER(destda)) IN ('N/A', 'N/TEM') THEN destda ELSE NULL END,
            CASE WHEN TRIM(UPPER(gia)) IN ('N/A', 'N/TEM') THEN gia ELSE NULL END,
            
            -- Bloco 4
            setores_permitidos, 
            CASE WHEN TRIM(UPPER(certificado_cliente)) = 'SIM' THEN 'Sim' ELSE 'NÃ£o' END, 
            CASE WHEN TRIM(tipo_certificado) = '' THEN NULL ELSE tipo_certificado END, 
            senha_certificado, data_emissao_certificado, data_vencimento_certificado,
            data_procuracao_target,
            qtde_funcionarios,
            ?, -- ParÃ¢metro 1: id_novo_mes
            
            -- Bloco 5
            'Pendente', 
            
            -- Bloco 6: DP 
            -- [!] AQUI ESTÃ A MÃGICA: REPLICAÃ‡ÃƒO DIRETA (SEM CASE WHEN)
            adto,             -- Replica o valor exato
            folha_pagamento,  -- Replica o valor exato
            tipo_folha,       -- Replica o valor exato
            data_pagamento,   -- Replica o valor exato
            
            -- Estes continuam zerando mensalmente
            CASE WHEN TRIM(UPPER(guias_sindicato)) IN ('N/A', 'N/TEM') THEN guias_sindicato ELSE NULL END, 
            CASE WHEN TRIM(UPPER(dissidio)) IN ('N/A', 'N/TEM') THEN dissidio ELSE NULL END,
            CASE WHEN TRIM(UPPER(fgts_digital)) IN ('N/A', 'N/TEM') THEN fgts_digital ELSE NULL END,
            CASE WHEN TRIM(UPPER(e_social)) IN ('N/A', 'N/TEM') THEN e_social ELSE NULL END,
            CASE WHEN TRIM(UPPER(dctf_web_mes)) IN ('N/A', 'N/TEM') THEN dctf_web_mes ELSE NULL END,
            CASE WHEN TRIM(UPPER(reinf)) IN ('N/A', 'N/TEM') THEN reinf ELSE NULL END,
            
            -- [!] NOVOS CAMPOS REPLICADOS DIRETAMENTE
            sd_login, 
            sd_senha,
            ADTO13, 
            FOLHA13,
            data_calculo_adto13, 
            data_envio_adto13,
            data_calculo_folha13, 
            data_envio_folha13,
            
            -- Bloco 7: Cushman (Limpa se nÃ£o for N/A)
            CASE WHEN TRIM(UPPER(iss_cushman)) IN ('N/A', 'N/TEM') THEN iss_cushman ELSE NULL END,
            CASE WHEN TRIM(UPPER(devec_cushman)) IN ('N/A', 'N/TEM') THEN devec_cushman ELSE NULL END,
            CASE WHEN TRIM(UPPER(sped_fiscal_cushman)) IN ('N/A', 'N/TEM') THEN sped_fiscal_cushman ELSE NULL END,
            CASE WHEN TRIM(UPPER(reinf_cushman)) IN ('N/A', 'N/TEM') THEN reinf_cushman ELSE NULL END,
            CASE WHEN TRIM(UPPER(esocial_cushman)) IN ('N/A', 'N/TEM') THEN esocial_cushman ELSE NULL END
            
        FROM controle_fechamento
        WHERE id_mes = ? -- ParÃ¢metro 2: id_mes_anterior
          AND (data_saida IS NULL OR data_saida > CURDATE())
        ";
        $stmt_empresas = $conexao->prepare($query_empresas);
        $stmt_empresas->bind_param('ii', $id_novo_mes, $id_mes_anterior);
        $stmt_empresas->execute();
        logMessage("Empresas replicadas para o novo mÃªs. Linhas afetadas: " . $stmt_empresas->affected_rows);

        if (!replicarResponsaveisParaNovoMes($conexao, $id_mes_anterior, $id_novo_mes)) {
            throw new Exception("A sub-rotina de replicar responsÃ¡veis falhou.");
        }

        if (!replicarParcelamentosParaNovoMes($conexao, $id_mes_anterior, $id_novo_mes)) {
            throw new Exception("A sub-rotina de replicar parcelamentos falhou.");
        }

        $conexao->commit();
        logMessage("SUCESSO: TransaÃ§Ã£o de criaÃ§Ã£o de novo mÃªs foi commitada.");
        return $id_novo_mes;
    } catch (Exception $e) {
        $conexao->rollback();
        logMessage("ERRO CRÃTICO na transaÃ§Ã£o de criar novo mÃªs. Rollback executado. Erro: " . $e->getMessage());
        error_log('Erro ao criar novo mÃªs: ' . $e->getMessage());
        return false;
    }
}
criarNovoMesSeNecessario($conexao);


if (php_sapi_name() !== 'cli') {

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['trocar_responsavel'])) {
        session_start();
        if ($_SESSION['tipo_conta'] !== 'admin') {
            die("Acesso nÃ£o autorizado");
        }

        $id_empresa = $_POST['id_empresa'];
        $id_usuario = $_POST['id_usuario'];
        $id_mes = obterMesAtualAberto($conexao);
        if (!$id_mes) {
            throw new Exception("NÃ£o hÃ¡ um mÃªs aberto no sistema. Por favor, abra um mÃªs antes de cadastrar empresas.");
        }
        if (atribuirResponsavel($conexao, $id_empresa, $id_usuario, $id_mes)) {
            $_SESSION['mensagem'] = 'ResponsÃ¡vel atualizado com sucesso!';
        } else {
            $_SESSION['mensagem'] = 'Erro ao atualizar responsÃ¡vel';
        }

        header("Location: editar_empresa.php?id=$id_empresa");
        exit;
    }
}

function usuarioTemPermissaoEmpresa($conexao, $id_usuario, $id_empresa)
{
    $stmt = $conexao->prepare("SELECT tipo_conta FROM usuarios WHERE id = ?");
    $stmt->bind_param('i', $id_usuario);
    $stmt->execute();
    $result = $stmt->get_result();
    $tipo_conta = $result->fetch_assoc()['tipo_conta'];

    if ($tipo_conta === 'admin') {
        return true;
    }

    $stmt = $conexao->prepare("
            SELECT 1 FROM responsaveis_empresa 
            WHERE id_usuario = ? AND id_empresa = ?
            LIMIT 1
        ");
    $stmt->bind_param('ii', $id_usuario, $id_empresa);
    $stmt->execute();
    $result = $stmt->get_result();

    return $result->num_rows > 0;
}

function usuarioPodeEditarEmpresa($conexao, $usuario_id, $empresa_id, $mes_id)
{
    $stmt = $conexao->prepare("
            SELECT 1 FROM responsaveis_empresa 
            WHERE id_usuario = ? AND id_empresa = ? AND id_mes = ? AND responsavel_atual = 1
            LIMIT 1
        ");
    $stmt->bind_param('iii', $usuario_id, $empresa_id, $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->num_rows > 0;
}

function calcularProgressoFiscal($conexao, $id_mes, $batch_size = 1000)
{
    $campos_fiscal = ['impostos', 'iss', 'mit', 'reinf'];
    $total_empresas = 0;
    $empresas_completas = 0;

    $stmt = $conexao->prepare("
            SELECT COUNT(*) as total 
            FROM controle_fechamento 
            WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())
        ");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();
    $total_empresas = $result->fetch_assoc()['total'];

    $offset = 0;
    while ($offset < $total_empresas) {
        $stmt = $conexao->prepare("
                SELECT * FROM controle_fechamento 
                WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())
                LIMIT ? OFFSET ?
            ");
        $stmt->bind_param('iii', $id_mes, $batch_size, $offset);
        $stmt->execute();
        $result = $stmt->get_result();

        while ($empresa = $result->fetch_assoc()) {
            $todos_preenchidos = true;
            foreach ($campos_fiscal as $campo) {
                if (empty($empresa[$campo])) {
                    $todos_preenchidos = false;
                    break;
                }
            }
            if ($todos_preenchidos) {
                $empresas_completas++;
            }
        }
        $offset += $batch_size;
    }

    $media_geral = $total_empresas > 0 ? ($empresas_completas / $total_empresas) * 100 : 0;

    return [
        'empresas_completas' => $empresas_completas,
        'total_empresas' => $total_empresas,
        'media_geral' => $media_geral
    ];
}

function calcularProgressoDP($conexao, $id_mes)
{
    $campos_dp = [
        'adto',
        'folha_pagamento',
        'data_pagamento',
        'qtde_funcionarios',
        'guias_sindicato',
        'dissidio',
        'fgts_digital',
        'e_social',
        'dctf_web_mes',
        'reinf',
        'sd_login',
        'sd_senha'
    ];

    $total_empresas = 0;
    $empresas_completas = 0;

    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($empresa = $result->fetch_assoc()) {
        $total_empresas++;
        $todos_preenchidos = true;

        foreach ($campos_dp as $campo) {
            if (empty($empresa[$campo])) {
                $todos_preenchidos = false;
                break;
            }
        }

        if ($todos_preenchidos) {
            $empresas_completas++;
            verificarDadosCompletosENotificar($conexao, $empresa['id'], $id_mes);
        }
    }

    $media_geral = $total_empresas > 0 ? ($empresas_completas / $total_empresas) * 100 : 0;

    return [
        'empresas_completas' => $empresas_completas,
        'total_empresas' => $total_empresas,
        'media_geral' => $media_geral
    ];
}
function calcularProgressoContabil($conexao, $id_mes)
{
    $campos_contabil = [
        'janeiro',
        'fevereiro',
        'marco',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
        'balancete',
        'distribuicao_dirf',
        'defs',
        'dasn',
        'ecd',
        'ecf'
    ];

    $total_empresas = 0;
    $campos_preenchidos = 0;
    $total_campos_possiveis = 0;

    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        while ($empresa = $result->fetch_assoc()) {
            $data_obrigacao = $empresa['data_obrigacao'] ?? null;
            $ano_obrigacao = $data_obrigacao ? (int)date('Y', strtotime($data_obrigacao)) : null;
            $mes_obrigacao = $data_obrigacao ? (int)date('m', strtotime($data_obrigacao)) : null;

            $data_saida = $empresa['data_saida'] ?? null;
            $ano_saida = $data_saida ? (int)date('Y', strtotime($data_saida)) : null;
            $mes_saida = $data_saida ? (int)date('m', strtotime($data_saida)) : null;

            for ($mes_numero = 1; $mes_numero <= 12; $mes_numero++) {
                $mes_coluna = $campos_contabil[$mes_numero - 1];
                $ano_tabela = date('Y'); // Assumindo que a tabela Ã© do ano atual

                if (
                    !($data_obrigacao && ($ano_tabela < $ano_obrigacao || ($ano_tabela == $ano_obrigacao && $mes_numero < $mes_obrigacao))) &&
                    !($data_saida && ($ano_tabela > $ano_saida || ($ano_tabela == $ano_saida && $mes_numero > $mes_saida)))
                ) {
                    $total_campos_possiveis++;
                    if (!empty(trim($empresa[$mes_coluna] ?? ''))) {
                        $campos_preenchidos++;
                    }
                }
            }

            $outros_campos = ['balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];
            foreach ($outros_campos as $campo) {
                $total_campos_possiveis++;
                if (!empty(trim($empresa[$campo] ?? ''))) {
                    $campos_preenchidos++;
                }
            }
        }
    }

    $media_geral = $total_campos_possiveis > 0 ? ($campos_preenchidos / $total_campos_possiveis) * 100 : 0;

    return [
        'campos_preenchidos' => $campos_preenchidos,
        'total_campos' => $total_campos_possiveis,
        'media_geral' => $media_geral
    ];
}
if (false) {
    require_once 'assets/backend/config.php';

    header('Content-Type: application/json');

    session_start();
    if (!isset($_SESSION['usuario_id']) || $_SESSION['tipo_conta'] !== 'fiscal') {
        echo json_encode(['success' => false, 'message' => 'Acesso nÃ£o autorizado']);
        exit();
    }

    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
    $coluna = filter_input(INPUT_POST, 'coluna');
    $valor = filter_input(INPUT_POST, 'valor');

    if (!$id || !$coluna) {
        echo json_encode(['success' => false, 'message' => 'Dados invÃ¡lidos']);
        exit();
    }

    $colunasPermitidas = [
        'status',
        'observacoes',
        'reinf',
        'impostos',
        'iss',
        'mit',
    ];

    if (!in_array($coluna, $colunasPermitidas)) {
        echo json_encode(['success' => false, 'message' => 'Coluna nÃ£o permitida para ediÃ§Ã£o']);
        exit();
    }

    if (!empty($dados['reinf'])) {

        $stmt = $conexao->prepare("
                UPDATE notificacoes 
                SET status = 'concluido' 
                WHERE id_empresa = ? AND tipo = 'reinf' AND status = 'pendente'
            ");
        $stmt->bind_param('i', $empresa_id);
        $stmt->execute();
        $stmt->close();
    }

    try {
        $stmt = $conexao->prepare("
                SELECT COUNT(*) as count 
                FROM responsaveis_empresa 
                WHERE id_empresa = ? AND id_usuario = ? AND responsavel_atual = 1
            ");
        $stmt->bind_param('ii', $id, $_SESSION['usuario_id']);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($result['count'] == 0) {
            echo json_encode(['success' => false, 'message' => 'VocÃª nÃ£o tem permissÃ£o para editar esta empresa']);
            exit();
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Erro ao verificar permissÃµes']);
        exit();
    }

    try {
        $stmt = $conexao->prepare("
                SELECT cf.id_mes, cf.empresa, cf.reinf as valor_antigo
                FROM controle_fechamento cf
                JOIN controle_meses cm ON cf.id_mes = cm.id
                WHERE cf.id = ?
            ");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $id_mes = $res['id_mes'] ?? null;
        $nome_empresa = $res['empresa'] ?? '';
        $valor_antigo_reinf = $res['valor_antigo'] ?? null;
        $stmt->close();

        if (!$id_mes) {
            echo json_encode(['success' => false, 'message' => 'MÃªs nÃ£o encontrado para a empresa']);
            exit();
        }

        $stmt = $conexao->prepare("
                SELECT id 
                FROM controle_meses 
                ORDER BY ano DESC, mes DESC 
                LIMIT 2
            ");
        $stmt->execute();
        $mesesValidos = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        $idsMesesEditaveis = array_column($mesesValidos, 'id');

        if (!in_array($id_mes, $idsMesesEditaveis)) {
            echo json_encode(['success' => false, 'message' => 'Este mÃªs nÃ£o Ã© mais editÃ¡vel']);
            exit();
        }

        $query = "UPDATE controle_fechamento SET `$coluna` = ? WHERE id = ?";
        $stmt = $conexao->prepare($query);

        if ($stmt === false) {
            throw new Exception("Erro na preparaÃ§Ã£o da query: " . $conexao->error);
        }

        $valorFinal = ($valor === '') ? NULL : $valor;

        $stmt->bind_param('si', $valorFinal, $id);
        $stmt->execute();

        $success = $stmt->affected_rows > 0;
        $stmt->close();

        if ($success) {
            if ($coluna === 'iss' || $coluna === 'mit') {
                $stmt = $conexao->prepare("SELECT iss, mit FROM controle_fechamento WHERE id = ?");
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $result = $stmt->get_result()->fetch_assoc();
                $stmt->close();

                if (!empty($result['iss']) && !empty($result['mit'])) {
                    $stmt = $conexao->prepare("
                            UPDATE notificacoes 
                            SET status = 'concluido' 
                            WHERE id_empresa = ? AND tipo = 'dp_completo' AND status = 'pendente'
                        ");
                    $stmt->bind_param('i', $id);
                    $stmt->execute();
                    $stmt->close();
                }
            }

            if ($coluna === 'reinf' && $valorFinal !== $valor_antigo_reinf && !empty($valorFinal)) {
                $stmt = $conexao->prepare("
                        SELECT DISTINCT u.id, u.nome
                        FROM responsaveis_empresa re
                        JOIN usuarios u ON re.id_usuario = u.id
                        WHERE re.id_empresa = ? AND u.tipo_conta = 'dp' AND re.responsavel_atual = 1
                    ");
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $responsaveis_dp = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                $stmt->close();

                foreach ($responsaveis_dp as $responsavel) {
                    $mensagem = "REINF preenchido para a empresa {$nome_empresa} pelo fiscal {$_SESSION['usuario_nome']}";

                    $stmt = $conexao->prepare("
                            INSERT INTO notificacoes 
                            (id_usuario, mensagem, tipo, id_empresa, id_mes, status) 
                            VALUES (?, ?, 'reinf_preenchido', ?, ?, 'pendente')
                        ");
                    $stmt->bind_param(
                        'issi',
                        $responsavel['id'],
                        $mensagem,
                        $id,
                        $id_mes
                    );
                    $stmt->execute();
                    $stmt->close();
                }
            }

            echo json_encode([
                'success' => true,
                'message' => 'Atualizado com sucesso'
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'message' => 'Valor idÃªntico ao atual'
            ]);
        }
    } catch (Exception $e) {
        error_log('Erro ao atualizar empresa: ' . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Erro ao atualizar: ' . $e->getMessage()
        ]);
    }
}
