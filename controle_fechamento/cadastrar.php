<?php
require 'assets/backend/config.php';
require 'vendor/autoload.php';
session_start();

if ($_SESSION['tipo_conta'] !== 'cadastro' && $_SESSION['tipo_conta'] !== 'admin' && $_SESSION['tipo_conta'] !== 'cs' && $_SESSION['tipo_conta'] !== 'lider_fiscal') {
    $_SESSION['mensagem'] = 'Acesso restrito';
    header('Location: index.php');
    exit();
}

$gruposPermitidos = [
    'NENHUM',
    'CIBELE',
    'GRUPO BOX',
    'GRUPO ECCO',
    'GRUPO ELYON',
    'GRUPO GRAO',
    'GRUPO HIBOO',
    'GRUPO ORIGEM',
    'GRUPO PROTEGE',
    'GRUPO Q-MAX',
    'GRUPO TRANSPADRE',
    'GRUPO VERPAR',
    'ISIS',
    'PARCEIRO FACUNDO'
];

use PhpOffice\PhpSpreadsheet\IOFactory;

function safe_strtolower(?string $value): ?string
{
    return $value !== null ? strtolower($value) : null;
}

function safe_trim(?string $value): ?string
{
    return $value !== null ? trim($value) : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['importar_excel'])) {
    try {
        set_time_limit(120);

        if (!isset($_FILES['arquivo_excel']) || $_FILES['arquivo_excel']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("Por favor, selecione um arquivo Excel válido.");
        }

        $arquivo = $_FILES['arquivo_excel']['tmp_name'];
        $extensao = pathinfo($_FILES['arquivo_excel']['name'], PATHINFO_EXTENSION);

        if (!in_array(strtolower($extensao), ['xlsx', 'xls', 'csv'])) {
            throw new Exception("Formato de arquivo inválido. Por favor, envie um arquivo Excel (.xlsx, .xls) ou CSV.");
        }

        $spreadsheet = IOFactory::load($arquivo);
        $sheet = $spreadsheet->getActiveSheet();
        $highestRow = $sheet->getHighestRow();
        $highestColumn = $sheet->getHighestColumn();

        $id_mes = obterMesAtualAberto($conexao);
        if (!$id_mes) {
            throw new Exception("Não há um mês aberto no sistema. Por favor, abra um mês antes de importar empresas.");
        }

        // =======================================================================
        // == CORREÇÃO 1.1: Adicionados campos de certificado ao importador GERAL ==
        // =======================================================================
        $colunas = [
            'codigo' => null,
            'empresa' => null,
            'cnpj' => null,
            'tributacao' => null,
            'insc_estadual' => null,
            'insc_municipal' => null,
            'login_prefeitura' => null,
            'senha_prefeitura_ginfes' => null,
            'senha_giss_online' => null,
            'link_prefeitura' => null,
            'tipo' => null,
            'envio' => null,
            'municipio' => null,
            'grupo' => null,
            'dissidio' => null,
            'certificado_cliente' => null,
            'tipo_certificado' => null,
            'senha_certificado' => null,
            'data_emissao_certificado' => null,
            'data_vencimento_certificado' => null, // <-- ADICIONADO
            'data_procuracao_target' => null,
        ];

        $headerRow = $sheet->rangeToArray('A1:' . $highestColumn . '1', null, true, false)[0];

        // =======================================================================
        // == CORREÇÃO 1.2: Adicionados mapeamentos de certificado ==
        // =======================================================================
        $mapeamentoPersonalizado = [
            'insc_estadual' => ['insc. estadual', 'insc estadual', 'insc_estadual', 'ie'],
            'insc_municipal' => ['insc. municipal', 'insc municipal', 'insc_municipal', 'im'],
            'senha_prefeitura_ginfes' => ['senha prefeitura/ginfes', 'senha prefeitura ginfes', 'senha_ginfes'],
            'tributacao' => ['tributação', 'tributacao', 'regime tributario'],
            'tipo_certificado' => ['tipo cert.', 'tipo certificado'],
            'senha_certificado' => ['senha cert.', 'senha certificado'],
            'data_emissao_certificado' => ['emissao cert.', 'emissao certificado', 'data emissao'],
            'data_vencimento_certificado' => ['venc. cert.', 'vencimento certificado', 'data vencimento'],
            'data_procuracao_target' => ['procuracao target', 'procuração target', 'data procuracao']
        ];

        foreach ($headerRow as $key => $header) {
            $header = safe_trim(safe_strtolower($header ?? ''));
            foreach ($mapeamentoPersonalizado as $dbCol => $variacoes) {
                foreach ($variacoes as $variacao) {
                    if ($header === $variacao) {
                        $colunas[$dbCol] = $key;
                        continue 2;
                    }
                }
            }
            foreach ($colunas as $dbCol => $val) {
                if ($val !== null) continue;
                $dbColLower = safe_strtolower($dbCol);
                $dbColSpaces = safe_strtolower(str_replace('_', ' ', $dbCol));
                if ($header && ($header === $dbColLower || str_contains($header, $dbColLower) || str_contains($header, $dbColSpaces))) {
                    $colunas[$dbCol] = $key;
                }
            }
        }

        if ($colunas['empresa'] === null || $colunas['cnpj'] === null) {
            throw new Exception("O arquivo Excel deve conter pelo menos as colunas 'empresa' e 'cnpj'.");
        }

        $empresasImportadas = 0;
        $erros = [];

        for ($row = 2; $row <= $highestRow; $row++) {
            try {
                $data = $sheet->rangeToArray('A' . $row . ':' . $highestColumn . $row, null, true, false)[0];

                // =======================================================================
                // == CORREÇÃO 1.3: Adicionados campos de certificado ao $dados ==
                // =======================================================================
                $dados = [
                    'codigo' => isset($colunas['codigo']) ? safe_trim($data[$colunas['codigo']] ?? null) : null,
                    'empresa' => safe_trim($data[$colunas['empresa']] ?? ''),
                    'cnpj' => preg_replace('/[^0-9]/', '', $data[$colunas['cnpj']] ?? ''),
                    'tributacao' => isset($colunas['tributacao']) ? safe_trim($data[$colunas['tributacao']] ?? null) : null,
                    'insc_estadual' => isset($colunas['insc_estadual']) ? safe_trim($data[$colunas['insc_estadual']] ?? null) : null,
                    'insc_municipal' => isset($colunas['insc_municipal']) ? safe_trim($data[$colunas['insc_municipal']] ?? null) : null,
                    'login_prefeitura' => isset($colunas['login_prefeitura']) ? safe_trim($data[$colunas['login_prefeitura']] ?? null) : null,
                    'senha_prefeitura_ginfes' => isset($colunas['senha_prefeitura_ginfes']) ? safe_trim($data[$colunas['senha_prefeitura_ginfes']] ?? null) : null,
                    'senha_giss_online' => isset($colunas['senha_giss_online']) ? safe_trim($data[$colunas['senha_giss_online']] ?? null) : null,
                    'link_prefeitura' => isset($colunas['link_prefeitura']) ? safe_trim($data[$colunas['link_prefeitura']] ?? null) : null,
                    'tipo' => isset($colunas['tipo']) ? safe_trim($data[$colunas['tipo']] ?? null) : null,
                    'envio' => isset($colunas['envio']) ? safe_trim($data[$colunas['envio']] ?? null) : null,
                    'municipio' => isset($colunas['municipio']) ? safe_trim($data[$colunas['municipio']] ?? null) : null,
                    'grupo' => isset($colunas['grupo']) ? safe_trim($data[$colunas['grupo']] ?? null) : null,
                    'dissidio' => isset($colunas['dissidio']) ? safe_trim($data[$colunas['dissidio']] ?? null) : null,
                    'certificado_cliente' => isset($colunas['certificado_cliente']) ? safe_trim($data[$colunas['certificado_cliente']] ?? null) : null,
                    'tipo_certificado' => isset($colunas['tipo_certificado']) ? safe_trim($data[$colunas['tipo_certificado']] ?? null) : null,
                    'senha_certificado' => isset($colunas['senha_certificado']) ? safe_trim($data[$colunas['senha_certificado']] ?? null) : null,
                    'data_emissao_certificado' => isset($colunas['data_emissao_certificado']) ? safe_trim($data[$colunas['data_emissao_certificado']] ?? null) : null,
                    'data_vencimento_certificado' => isset($colunas['data_vencimento_certificado']) ? safe_trim($data[$colunas['data_vencimento_certificado']] ?? null) : null,
                    'data_procuracao_target' => isset($colunas['data_procuracao_target']) ? safe_trim($data[$colunas['data_procuracao_target']] ?? null) : null,
                    'carne_leao' => (strlen(preg_replace('/[^0-9]/', '', $data[$colunas['cnpj']] ?? '')) === 14) ? 'N/A' : null,
                    'id_mes' => $id_mes
                ];

                // =======================================================================
                // == CORREÇÃO 1.4: Adicionada conversão de data (copiada do Cushman) ==
                // =======================================================================
                foreach (['data_emissao_certificado', 'data_vencimento_certificado', 'data_procuracao_target', 'dissidio'] as $campo_data) {
                    if (!empty($dados[$campo_data]) && is_numeric($dados[$campo_data])) {
                        try {
                            $dados[$campo_data] = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($dados[$campo_data])->format('Y-m-d');
                        } catch (Exception $e) {
                            $dados[$campo_data] = null;
                        }
                    } elseif (!empty($dados[$campo_data])) {
                        try {
                            // Tenta converter de string (ex: dd/mm/YYYY ou YYYY-MM-DD ou YYYY-MM)
                            $date_obj = new DateTime($dados[$campo_data]);
                            // Se for YYYY-MM, o PHP assume o primeiro dia.
                            $dados[$campo_data] = $date_obj->format('Y-m-d');
                        } catch (Exception $e) {
                            $dados[$campo_data] = null;
                        }
                    } else {
                        $dados[$campo_data] = null;
                    }
                }

                if (strlen($dados['cnpj']) !== 14 && strlen($dados['cnpj']) !== 11) {
                    throw new Exception("CNPJ/CPF inválido na linha $row");
                }

                $check_sql = "SELECT id FROM controle_fechamento WHERE cnpj = ?";
                $check_stmt = $conexao->prepare($check_sql);
                $check_stmt->bind_param('s', $dados['cnpj']);
                $check_stmt->execute();
                $check_stmt->store_result();

                if ($check_stmt->num_rows > 0) {
                    throw new Exception("Empresa com CNPJ " . $dados['cnpj'] . " já cadastrada (linha $row)");
                }

                $colunas_db = [];
                $valores = [];
                $placeholders = [];
                $tipos = '';
                foreach ($dados as $coluna => $valor) {
                    if ($valor !== null) { // Permite '0' e strings vazias
                        $colunas_db[] = $coluna;
                        $valores[] = $valor;
                        $placeholders[] = '?';
                        $tipos .= is_int($valor) ? 'i' : 's';
                    }
                }

                $sql = "INSERT INTO controle_fechamento (" . implode(', ', $colunas_db) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $stmt = $conexao->prepare($sql);
                $stmt->bind_param($tipos, ...$valores);

                if ($stmt->execute()) {
                    $empresasImportadas++;
                } else {
                    throw new Exception("Erro ao importar empresa na linha $row: " . $stmt->error);
                }
            } catch (Exception $e) {
                $erros[] = $e->getMessage();
            }
        }

        $_SESSION['popup'] = [
            'tipo' => empty($erros) ? 'sucesso' : 'aviso',
            'mensagem' => "Importação concluída: $empresasImportadas empresas importadas." .
                (empty($erros) ? '' : ' Erros: ' . count($erros))
        ];
        if (!empty($erros)) {
            $_SESSION['erros_importacao'] = $erros;
        }
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    } catch (Exception $e) {
        $_SESSION['popup'] = ['tipo' => 'erro', 'mensagem' => $e->getMessage()];
        header("Location: " . $_SERVER['PHP_SELF']);
        exit();
    }
}
// --- Bloco Importar Cushman (Seu código original, inalterado) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['importar_cushman'])) {
    $empresasImportadas = 0;
    $erros = [];
    $avisos = [];
    try {
        set_time_limit(300);
        if (!isset($_FILES['arquivo_cushman']) || $_FILES['arquivo_cushman']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception("Por favor, selecione uma planilha Cushman válida.");
        }
        $arquivo = $_FILES['arquivo_cushman']['tmp_name'];
        $spreadsheet = IOFactory::load($arquivo);
        $sheet = $spreadsheet->getActiveSheet();
        $highestRow = $sheet->getHighestRow();
        $id_mes = obterMesAtualAberto($conexao);
        if (!$id_mes) {
            throw new Exception("Não há um mês aberto no sistema para importar empresas.");
        }
        $conexao->begin_transaction();
        $colunasCushman = [
            'codigo' => 0,
            'empresa' => 1,
            'cnpj' => 2,
            'municipio' => 3,
            'tipo_certificado' => 4,
            'senha_certificado' => 5,
            'data_emissao_certificado' => 6,
            'data_vencimento_certificado' => 7,
            'data_procuracao_target' => 8,
            'insc_municipal' => 9,
            'login_prefeitura' => 10,
            'senha_prefeitura_ginfes' => 11,
            'senha_giss_online' => 12,
            'insc_estadual' => 13,
            'observacoes' => 14,
            'iss_cushman' => 15,
            'devec_cushman' => 16,
            'sped_fiscal_cushman' => 17,
            'esocial_cushman' => 18,
            'reinf_cushman' => 19,
        ];
        $check_stmt = $conexao->prepare("SELECT id FROM controle_fechamento WHERE cnpj = ? AND (data_saida IS NULL OR data_saida >= CURDATE())");
        for ($row = 2; $row <= $highestRow; $row++) {
            try {
                $data = $sheet->rangeToArray('A' . $row . ':' . 'T' . $row, null, true, false)[0];
                $cnpj = preg_replace('/[^0-9]/', '', $data[$colunasCushman['cnpj']] ?? '');
                $empresa = safe_trim($data[$colunasCushman['empresa']] ?? '');
                if (empty($cnpj) || empty($empresa)) {
                    continue;
                }
                if (strlen($cnpj) !== 14 && strlen($cnpj) !== 11) {
                    throw new Exception("CNPJ/CPF inválido: '{$data[$colunasCushman['cnpj']]}'");
                }
                $check_stmt->bind_param('s', $cnpj);
                $check_stmt->execute();
                if ($check_stmt->get_result()->num_rows > 0) {
                    $avisos[] = "Linha $row: Empresa com CNPJ {$cnpj} já possui registro ativo e foi ignorada.";
                    continue;
                }
                $dados = [];
                foreach ($colunasCushman as $db_col => $excel_index) {
                    $dados[$db_col] = safe_trim($data[$excel_index] ?? null);
                }
                foreach (['data_emissao_certificado', 'data_vencimento_certificado', 'data_procuracao_target'] as $campo_data) {
                    if (!empty($dados[$campo_data]) && is_numeric($dados[$campo_data])) {
                        $dados[$campo_data] = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($dados[$campo_data])->format('Y-m-d');
                    } else {
                        $dados[$campo_data] = null;
                    }
                }
                $dados['codigo'] = !empty($dados['codigo']) ? $dados['codigo'] : 'cushman';
                $dados['tributacao'] = 'condominios';
                $dados['setores_permitidos'] = 'cushman';
                $dados['tipo_cadastro'] = 'cushman';
                $dados['id_mes'] = $id_mes;
                $dados['cnpj'] = $cnpj;
                $colunas_db = [];
                $valores = [];
                $placeholders = [];
                $tipos = '';
                foreach ($dados as $coluna => $valor) {
                    if ($valor !== null && $valor !== '') {
                        $colunas_db[] = "`$coluna`";
                        $valores[] = $valor;
                        $placeholders[] = '?';
                        if (is_int($valor)) $tipos .= 'i';
                        else $tipos .= 's';
                    }
                }
                if (empty($colunas_db)) continue;
                $sql = "INSERT INTO controle_fechamento (" . implode(', ', $colunas_db) . ") VALUES (" . implode(', ', $placeholders) . ")";
                $stmt_insert = $conexao->prepare($sql);
                $stmt_insert->bind_param($tipos, ...$valores);
                if ($stmt_insert->execute()) {
                    $empresasImportadas++;
                } else {
                    throw new Exception("Erro de SQL: " . $stmt_insert->error);
                }
                $stmt_insert->close();
            } catch (Exception $e) {
                $erros[] = "Linha $row: " . $e->getMessage();
            }
        }
        $check_stmt->close();
        if (!empty($erros)) {
            $conexao->rollback();
            $_SESSION['popup'] = ['tipo' => 'erro', 'mensagem' => "A importação falhou. Nenhum registro novo foi salvo."];
            $_SESSION['erros_importacao'] = $erros;
        } else {
            $conexao->commit();
            $mensagem_sucesso = "Importação concluída: {$empresasImportadas} nova(s) empresa(s) importada(s).";
            if (!empty($avisos)) {
                $_SESSION['erros_importacao'] = $avisos;
                $mensagem_sucesso .= " " . count($avisos) . " empresa(s) já existiam e foram ignoradas.";
            }
            $_SESSION['popup'] = ['tipo' => empty($avisos) ? 'sucesso' : 'aviso', 'mensagem' => $mensagem_sucesso];
        }
    } catch (Exception $e) {
        if ($conexao->thread_id) {
            $conexao->rollback();
        }
        $_SESSION['popup'] = ['tipo' => 'erro', 'mensagem' => "Erro crítico: " . $e->getMessage()];
    }
    if (!empty($erros) || !empty($avisos)) {
        ob_clean();
        echo "<!DOCTYPE html><html lang='pt-br'><head><title>Relatório de Importação</title>";
        echo "<link href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css' rel='stylesheet'>";
        echo "<style>body { padding: 2rem; font-family: sans-serif; } .alert { max-width: 800px; margin: 1rem auto; } pre { white-space: pre-wrap; word-wrap: break-word; }</style>";
        echo "</head><body><div class='container'>";
        echo "<h1 class='text-danger'><i class='fas fa-exclamation-triangle'></i> Relatório da Importação</h1>";
        if (!empty($erros)) {
            echo "<div class='alert alert-danger'><h4>Erros Encontrados (Importação Cancelada):</h4><pre>";
            print_r($erros);
            echo "</pre></div>";
        }
        if (!empty($avisos)) {
            echo "<div class='alert alert-warning'><h4>Avisos (Empresas Ignoradas):</h4><pre>";
            print_r($avisos);
            echo "</pre></div>";
        }
        echo "</div></body></html>";
        die();
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}
// --- Fim do Bloco Importar Cushman ---


// --- Bloco Cadastrar (Aplicadas correções de data) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['cadastrar'])) {
    try {
        if (empty(trim($_POST['empresa'] ?? ''))) {
            throw new Exception("O nome da empresa é obrigatório!");
        }
        $cnpj = preg_replace('/[^0-9]/', '', $_POST['cnpj'] ?? '');
        if (strlen($cnpj) !== 14 && strlen($cnpj) !== 11) {
            throw new Exception("CNPJ/CPF inválido. Deve conter 14 dígitos (CNPJ) ou 11 dígitos (CPF).");
        }
        $check_sql = "SELECT id FROM controle_fechamento WHERE cnpj = ?";
        $check_stmt = $conexao->prepare($check_sql);
        $check_stmt->bind_param('s', $cnpj);
        $check_stmt->execute();
        $check_stmt->store_result();
        if ($check_stmt->num_rows > 0) {
            throw new Exception("Já existe uma empresa cadastrada com este CNPJ.");
        }

        $data_contrato = !empty($_POST['data_contrato']) ? $_POST['data_contrato'] : null;
        $data_obrigacao = !empty($_POST['data_obrigacao']) ? $_POST['data_obrigacao'] : null;
        $data_saida = !empty($_POST['data_saida']) ? $_POST['data_saida'] : null;

        $tipo_cadastro = !empty($_POST['tipo_cadastro']) ? safe_trim($_POST['tipo_cadastro']) : 'normal';
        $certificado_cliente = !empty($_POST['certificado_cliente']) ? safe_trim($_POST['certificado_cliente']) : null;
        $tipo_certificado = !empty($_POST['tipo_certificado']) ? safe_trim($_POST['tipo_certificado']) : null;
        $senha_certificado = !empty($_POST['senha_certificado']) ? safe_trim($_POST['senha_certificado']) : null;
        $data_procuracao_target = !empty($_POST['data_procuracao_target']) ? $_POST['data_procuracao_target'] : null;

        // =======================================================================
        // == CORREÇÃO 2.1: CONVERTER YYYY-MM para YYYY-MM-01 ==
        // =======================================================================
        $data_emissao_certificado = !empty($_POST['data_emissao_certificado']) ? $_POST['data_emissao_certificado'] . '-01' : null;
        $data_vencimento_certificado = !empty($_POST['data_vencimento_certificado']) ? $_POST['data_vencimento_certificado'] . '-01' : null;
        $dissidio_tratado = !empty($_POST['dissidio']) ? safe_trim($_POST['dissidio']) . '-01' : null;
        // =======================================================================

        if (($data_contrato && !strtotime($data_contrato)) || ($data_obrigacao && !strtotime($data_obrigacao)) || ($data_saida && !strtotime($data_saida)) || ($data_procuracao_target && !strtotime($data_procuracao_target))) {
            throw new Exception("Uma das datas (Contrato, Obrigação, Saída ou Procuração) está inválida!");
        }

        $grupo = !empty($_POST['grupo']) ? $_POST['grupo'] : null;
        $id_mes = obterMesAtualAberto($conexao);
        if (!$id_mes) {
            throw new Exception("Não há um mês aberto no sistema. Por favor, abra um mês antes de cadastrar empresas.");
        }

        if ($tipo_cadastro === 'cushman') {
            $setores_finais = ['cushman'];
            $setores_extras = !empty($_POST['setores_permitidos_cushman']) ? $_POST['setores_permitidos_cushman'] : [];
            $setores_permitidos = implode(',', array_unique(array_merge($setores_finais, $setores_extras)));
        } else {
            $setores_permitidos = !empty($_POST['setores_permitidos']) ? implode(',', $_POST['setores_permitidos']) : null;
        }

        $dados = [
            'codigo' => !empty($_POST['codigo']) ? safe_trim($_POST['codigo']) : null,
            'empresa' => safe_trim($_POST['empresa']),
            'cnpj' => $cnpj,
            'grupo' => $grupo,
            'insc_estadual' => !empty($_POST['insc_estadual']) ? $_POST['insc_estadual'] : null,
            'insc_municipal' => !empty($_POST['insc_municipal']) ? $_POST['insc_municipal'] : null,
            'tributacao' => !empty($_POST['tributacao']) ? $_POST['tributacao'] : null,
            'tipo' => !empty($_POST['tipo']) ? $_POST['tipo'] : null,
            'envio' => !empty($_POST['envio']) ? $_POST['envio'] : null,
            'login_prefeitura' => !empty($_POST['login_prefeitura']) ? $_POST['login_prefeitura'] : null,
            'senha_prefeitura_ginfes' => !empty($_POST['senha_prefeitura_ginfes']) ? $_POST['senha_prefeitura_ginfes'] : null,
            'senha_giss_online' => !empty($_POST['senha_giss_online']) ? $_POST['senha_giss_online'] : null,
            'link_prefeitura' => !empty($_POST['link_prefeitura']) ? $_POST['link_prefeitura'] : null,
            'municipio' => !empty($_POST['municipio']) ? $_POST['municipio'] : null,
            'observacoes' => !empty($_POST['observacoes']) ? safe_trim($_POST['observacoes']) : null,
            'data_contrato' => $data_contrato,
            'data_obrigacao' => $data_obrigacao,
            'data_saida' => $data_saida,
            'dissidio' => $dissidio_tratado, // <-- Usar a variável tratada
            'tipo_cadastro' => $tipo_cadastro,
            'certificado_cliente' => $certificado_cliente,
            'tipo_certificado' => $tipo_certificado,
            'senha_certificado' => $senha_certificado,
            'data_emissao_certificado' => $data_emissao_certificado, // <-- Usar a variável tratada
            'data_vencimento_certificado' => $data_vencimento_certificado, // <-- Usar a variável tratada
            'data_procuracao_target' => $data_procuracao_target,
            'setores_permitidos' => $setores_permitidos,
            'carne_leao' => (strlen($cnpj) === 14) ? 'N/A' : null,
            'id_mes' => $id_mes
        ];

        $colunas = [];
        $valores = [];
        $tipos = '';
        foreach ($dados as $coluna => $valor) {
            if ($valor !== null) {
                $colunas[] = $coluna;
                $valores[] = $valor;
                $tipos .= is_int($valor) ? 'i' : 's';
            }
        }
        $placeholders = implode(', ', array_fill(0, count($colunas), '?'));
        $sql = "INSERT INTO controle_fechamento (" . implode(', ', $colunas) . ") VALUES ($placeholders)";
        $stmt = $conexao->prepare($sql);
        $params = array_merge([$tipos], $valores);
        $stmt->bind_param(...$params);

        if ($stmt->execute()) {
            $_SESSION['popup'] = ['tipo' => 'sucesso', 'mensagem' => 'Empresa cadastrada com sucesso!'];
            unset($_SESSION['dados_form']);
        } else {
            throw new Exception("Erro ao cadastrar empresa: " . $stmt->error . " | Query: " . $sql); // Adicionado $sql para debug
        }
    } catch (Exception $e) {
        $_SESSION['popup'] = ['tipo' => 'erro', 'mensagem' => $e->getMessage()];
        $_SESSION['dados_form'] = $_POST;
    }
    header("Location: " . $_SERVER['PHP_SELF']);
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro de Empresas</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link rel="stylesheet" href="assets/css/cadastrar.css">
</head>

<body>
    <div class="page-actions-container">

        <?php
        // Certifique-se que $user_type foi definido no início do PHP
        if (!isset($user_type)) {
            $user_type = $_SESSION['tipo_conta'] ?? '';
        }
        ?>

        <?php if ($user_type !== 'cs'): // Mostra estes botões apenas se NÃO for 'cs' 
        ?>
            <a href="cushman.php" class="btn-page-action" title="Área Cushman">
                <i class="fas fa-building"></i>
            </a>
            <?php if ($user_type === 'admin'): ?>
                <a href="dashboard.php" class="btn-page-action" title="Voltar ao Dashboard">
                    <i class="fas fa-arrow-left"></i>
                </a>
            <?php endif; ?>
            <div class="theme-toggle" id="themeToggle">
                <i class="fas fa-moon"></i>
            </div>
        <?php endif; // Fim da condição para não ser 'cs' 
        ?>

        <?php // NOVO BOTÃO: Visível para 'cs' e 'cadastro'
        ?>
        <?php if ($user_type === 'cs' || $user_type === 'cadastro' || $user_type === 'admin'): ?>
            <a href="visao_geral.php" class="btn-page-action" title="Visão Geral">
                <i class="fas fa-tachometer-alt"></i> <span>Visão Geral</span> </a>
        <?php endif; ?>

        <div class="logout-btn" id="logoutBtn" title="Sair do sistema">
            <i class="fas fa-sign-out-alt"></i>
        </div>

    </div>

    <div class="particles-container" id="particlesContainer"></div>
    <div class="login-container">
        <div class="card">
            <div class="card-header">
                <img src="assets/imagens/logo.png" alt="Logo" class="logo">
                <h3>Cadastrar Nova Empresa</h3>
            </div>
            <div class="card-body">
                <div class="import-section mb-4">
                    <h5 class="form-section-title"><i class="fas fa-file-excel me-2"></i>Importação Geral</h5>
                    <form method="POST" enctype="multipart/form-data">
                        <div class="input-group">
                            <input type="file" name="arquivo_excel" class="form-control" accept=".xlsx,.xls,.csv" required>
                            <button type="submit" name="importar_excel" class="btn btn-success">
                                <i class="fas fa-upload me-1"></i> Importar Geral
                            </button>
                        </div>
                        <small class="text-muted">Importação padrão. O sistema tentará mapear as colunas automaticamente.</small>
                    </form>
                </div>

                <div class="import-section mb-4">
                    <h5 class="form-section-title text-primary"><i class="fas fa-shield-alt me-2"></i>Importação Específica CUSHMAN</h5>
                    <form method="POST" enctype="multipart/form-data">
                        <div class="input-group">
                            <input type="file" name="arquivo_cushman" class="form-control" accept=".xlsx,.xls,.csv" required>
                            <button type="submit" name="importar_cushman" class="btn btn-primary">
                                <i class="fas fa-upload me-1"></i> Importar Cushman
                            </button>
                        </div>
                        <small class="text-muted">Use este para a planilha padrão da Cushman. A tributação será definida como "Condomínios".</small>
                    </form>
                </div>

                <form method="POST" id="form-empresa">
                    <div class="form-section">
                        <h5 class="form-section-title"><i class="fas fa-list-alt me-2"></i>Tipo de Cadastro</h5>
                        <div class="floating-label">
                            <select name="tipo_cadastro" id="tipo_cadastro" class="form-select" required>
                                <option value="normal" selected>Cadastro Normal</option>
                                <option value="cushman">Cadastro CUSHMAN</option>
                            </select>
                            <label for="tipo_cadastro">Selecione o Tipo de Cadastro</label>
                        </div>
                    </div>
                    <div class="form-section">
                        <h5 class="form-section-title"><i class="fas fa-building me-2"></i>Dados da Empresa</h5>
                        <div class="form-grid">
                            <div class="floating-label">
                                <input type="text" name="codigo" id="codigo" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['codigo'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="codigo">Código</label>
                            </div>
                            <div class="floating-label">
                                <div class="input-group">
                                    <input type="text" name="cnpj" id="cnpj" class="form-control"
                                        value="<?= htmlspecialchars($_SESSION['dados_form']['cnpj'] ?? '') ?>"
                                        placeholder="CNPJ" required>
                                    <button type="button" id="buscar-cnpj" class="btn btn-primary btn-login">
                                        <i class="fas fa-search me-1"></i> Buscar
                                    </button>
                                </div>
                                <div id="cnpj-loading" class="mt-2 text-primary" style="display:none;">
                                    <i class="fas fa-spinner fa-spin me-1"></i> Consultando CNPJ...
                                </div>
                                <div id="cnpj-error" class="mt-2 text-danger" style="display:none;"></div>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="empresa" id="empresa" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['empresa'] ?? '') ?>"
                                    placeholder=" " required>
                                <label for="empresa" class="required">Nome da Empresa</label>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="grupo" id="grupo" class="form-control"
                                    list="grupos-lista"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['grupo'] ?? 'NENHUM') ?>"
                                    placeholder=" ">
                                <label for="grupo">Grupo</label>
                                <datalist id="grupos-lista">
                                    <?php foreach ($gruposPermitidos as $grupo): ?>
                                        <option value="<?= htmlspecialchars($grupo) ?>">
                                        <?php endforeach; ?>
                                </datalist>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="insc_estadual" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['insc_estadual'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="insc_estadual">Inscrição Estadual</label>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="insc_municipal" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['insc_municipal'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="insc_municipal">Inscrição Municipal</label>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="municipio" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['municipio'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="municipio">Município</label>
                            </div>
                        </div>
                    </div>

                    <div class="form-section" id="section-importantes">
                        <h5 class="form-section-title"><i class="fas fa-calendar-alt me-2"></i>Datas Importantes</h5>
                        <div class="form-grid">
                            <div class="floating-label date-wrapper">
                                <input type="date" name="data_contrato" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_contrato'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_contrato">Data de Contrato</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>
                            <div class="floating-label date-wrapper">
                                <input type="date" name="data_obrigacao" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_obrigacao'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_obrigacao">Data de Obrigação</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>
                            <div class="floating-label date-wrapper">
                                <input type="date" name="data_saida" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_saida'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_saida">Data de Saída</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>
                        </div>
                    </div>

                    <div class="form-section" id="section-permissoes-cushman" style="display: none;">
                        <h5 class="form-section-title"><i class="fas fa-eye me-2"></i>Setores Adicionais (CUSHMAN)</h5>
                        <div class="form-grid">
                            <div class="form-group-full">
                                <label class="static-label text-muted">A permissão 'CUSHMAN' é obrigatória. Adicione permissões extras se necessário:</label>
                                <div class="checkbox-group">
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_fiscal_cushman" name="setores_permitidos_cushman[]" value="fiscal">
                                        <label for="perm_fiscal_cushman">Fiscal</label>
                                    </div>
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_dp_cushman" name="setores_permitidos_cushman[]" value="dp">
                                        <label for="perm_dp_cushman">DP</label>
                                    </div>
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_contabil_cushman" name="setores_permitidos_cushman[]" value="contabil">
                                        <label for="perm_contabil_cushman">Contábil</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="form-section" id="section-certificacao-geral">
                        <h5 class="form-section-title text-danger"><i class="fas fa-id-card me-2"></i>Certificação e Procurações</h5>
                        <div class="form-grid">

                            <div class="floating-label date-wrapper">
                                <input type="date" name="data_procuracao_target" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_procuracao_target'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_procuracao_target">Procuração Target (Data)</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>

                            <div class="floating-label">
                                <select name="certificado_cliente" id="certificado_cliente" class="form-select">
                                    <option value="" selected disabled>Tem Certificado?</option>
                                    <option value="Sim" <?= isset($_SESSION['dados_form']['certificado_cliente']) && $_SESSION['dados_form']['certificado_cliente'] == 'Sim' ? 'selected' : '' ?>>Sim</option>
                                    <option value="Não" <?= isset($_SESSION['dados_form']['certificado_cliente']) && $_SESSION['dados_form']['certificado_cliente'] == 'Não' ? 'selected' : '' ?>>Não</option>
                                </select>
                                <label for="certificado_cliente">Certificado Cliente</label>
                            </div>
                        </div>
                    </div>
                    <div class="form-section" id="section-certificado" style="display: none;">
                        <h5 class="form-section-title text-danger"><i class="fas fa-key me-2"></i>Certificado Digital (Detalhes)</h5>
                        <div class="form-grid">
                            <div class="floating-label">
                                <select name="tipo_certificado" id="tipo_certificado" class="form-select">
                                    <option value="" selected disabled>Selecione o Tipo</option>
                                    <option value="A1" <?= isset($_SESSION['dados_form']['tipo_certificado']) && $_SESSION['dados_form']['tipo_certificado'] == 'A1' ? 'selected' : '' ?>>A1</option>
                                    <option value="A3 Cartão" <?= isset($_SESSION['dados_form']['tipo_certificado']) && $_SESSION['dados_form']['tipo_certificado'] == 'A3 Cartão' ? 'selected' : '' ?>>A3 Cartão</option>
                                    <option value="A3 Token" <?= isset($_SESSION['dados_form']['tipo_certificado']) && $_SESSION['dados_form']['tipo_certificado'] == 'A3 Token' ? 'selected' : '' ?>>A3 Token</option>
                                </select>
                                <label for="tipo_certificado">Tipo Certificado</label>
                            </div>
                            <div class="floating-label">
                                <div class="input-group">
                                    <input type="password" name="senha_certificado" id="senha_certificado" class="form-control"
                                        value="<?= htmlspecialchars($_SESSION['dados_form']['senha_certificado'] ?? '') ?>"
                                        placeholder="Senha Certificado">
                                    <button class="btn btn-outline-secondary toggle-password" type="button">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="floating-label date-wrapper">
                                <input type="month" name="data_emissao_certificado" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_emissao_certificado'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_emissao_certificado">Emissão</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>
                            <div class="floating-label date-wrapper">
                                <input type="month" name="data_vencimento_certificado" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['data_vencimento_certificado'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="data_vencimento_certificado">Vencimento</label>
                                <i class="fas fa-calendar-alt date-icon"></i>
                            </div>
                        </div>
                    </div>

                    <div class="form-section" id="section-configuracoes">
                        <h5 class="form-section-title"><i class="fas fa-cog me-2"></i>Configurações</h5>
                        <div class="form-grid">
                            <div class="floating-label">
                                <select name="tributacao" class="form-select" required>
                                    <option value="" selected disabled></option>
                                    <option value="Associações" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'associacoes' ? 'selected' : '' ?>>Associações</option>
                                    <option value="condominios" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'condominios' ? 'selected' : '' ?>>Condominios</option>
                                    <option value="doméstica" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'domestica' ? 'selected' : '' ?>>Doméstica</option>
                                    <option value="imune_irpj" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'imune_irpj' ? 'selected' : '' ?>>Imune IRPJ</option>
                                    <option value="lucro_presumido" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'lucro_presumido' ? 'selected' : '' ?>>Lucro Presumido</option>
                                    <option value="lucro_real/trimestral" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'lucro_real/trimestral' ? 'selected' : '' ?>>Lucro Real/Trimestral</option>
                                    <option value="lucro_real/estimativa" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'lucro_real/estimativa' ? 'selected' : '' ?>>Lucro Real/Estimativa</option>
                                    <option value="lucro_real/anual" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'lucro_real/anual' ? 'selected' : '' ?>>Lucro Real/Anual</option>
                                    <option value="mei" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'mei' ? 'selected' : '' ?>>MEI</option>
                                    <option value="simples_nacional" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'simples_nacional' ? 'selected' : '' ?>>Simples Nacional</option>
                                    <option value="pessoa_fisica" <?= isset($_SESSION['dados_form']['tributacao']) && $_SESSION['dados_form']['tributacao'] == 'pessoa_fisica' ? 'selected' : '' ?>>Pessoa Física</option>
                                </select>
                                <label for="tributacao">Tributação</label>
                            </div>
                            <div class="floating-label">
                                <select name="tipo" class="form-select">
                                    <option value="" selected disabled></option>
                                    <option value="comercio" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'comercio' ? 'selected' : '' ?>>Comércio</option>
                                    <option value="holding" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'holding' ? 'selected' : '' ?>>Holding</option>
                                    <option value="igreja" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'igreja' ? 'selected' : '' ?>>Igreja</option>
                                    <option value="industria" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'industria' ? 'selected' : '' ?>>Indústria</option>
                                    <option value="serv/com" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'serv/com' ? 'selected' : '' ?>>Serv/Com</option>
                                    <option value="serviço" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'serviço' ? 'selected' : '' ?>>Serviço</option>
                                    <option value="transporte" <?= isset($_SESSION['dados_form']['tipo']) && $_SESSION['dados_form']['tipo'] == 'transporte' ? 'selected' : '' ?>>Transporte</option>
                                </select>
                                <label for="tipo">Tipo de Empresa</label>
                            </div>
                            <div class="floating-label">
                                <select name="envio" class="form-select">
                                    <option value="" selected disabled></option>
                                    <option value="e-mail" <?= isset($_SESSION['dados_form']['envio']) && $_SESSION['dados_form']['envio'] == 'e-mail' ? 'selected' : '' ?>>E-mail</option>
                                    <option value="nibo" <?= isset($_SESSION['dados_form']['envio']) && $_SESSION['dados_form']['envio'] == 'nibo' ? 'selected' : '' ?>>Nibo</option>
                                    <option value="nibo/whatsapp" <?= isset($_SESSION['dados_form']['envio']) && $_SESSION['dados_form']['envio'] == 'nibo/whatsapp' ? 'selected' : '' ?>>Nibo/WhatsApp</option>
                                    <option value="nibo/email" <?= isset($_SESSION['dados_form']['envio']) && $_SESSION['dados_form']['envio'] == 'nibo/email' ? 'selected' : '' ?>>Nibo/E-mail</option>
                                    <option value="nibo/onvio" <?= isset($_SESSION['dados_form']['envio']) && $_SESSION['dados_form']['envio'] == 'nibo/onvio' ? 'selected' : '' ?>>Nibo/Onvio</option>
                                </select>
                                <label for="envio">Método de Envio</label>
                            </div>
                            <div class="form-group-full">
                                <label class="static-label"><i class="fas fa-eye me-2"></i>Permissão de Visualização</label>
                                <div class="checkbox-group">
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_fiscal" name="setores_permitidos[]" value="fiscal">
                                        <label for="perm_fiscal">Fiscal</label>
                                    </div>
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_dp" name="setores_permitidos[]" value="dp">
                                        <label for="perm_dp">DP</label>
                                    </div>
                                    <div class="checkbox-wrapper">
                                        <input type="checkbox" id="perm_contabil" name="setores_permitidos[]" value="contabil">
                                        <label for="perm_contabil">Contábil</label>
                                    </div>
                                </div>
                                <small class="text-muted">Se nenhum setor for selecionado, a empresa será visível para TODOS.</small>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h5 class="form-section-title"><i class="fas fa-university me-2"></i>Acesso à Prefeitura</h5>
                        <div class="form-grid">
                            <div class="floating-label">
                                <input type="text" name="login_prefeitura" class="form-control"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['login_prefeitura'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="login_prefeitura">Login Prefeitura</label>
                            </div>
                            <div class="floating-label">
                                <div class="input-group">
                                    <input type="password" name="senha_prefeitura_ginfes" class="form-control"
                                        value="<?= htmlspecialchars($_SESSION['dados_form']['senha_prefeitura_ginfes'] ?? '') ?>"
                                        placeholder="Senha GINFES">
                                    <button class="btn btn-outline-secondary toggle-password" type="button">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="floating-label">
                                <div class="input-group">
                                    <input type="password" name="senha_giss_online" class="form-control"
                                        value="<?= htmlspecialchars($_SESSION['dados_form']['senha_giss_online'] ?? '') ?>"
                                        placeholder="Senha GISS Online">
                                    <button class="btn btn-outline-secondary toggle-password" type="button">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="floating-label">
                                <input type="text" name="link_prefeitura" class="form-control" placeholder="https://"
                                    value="<?= htmlspecialchars($_SESSION['dados_form']['link_prefeitura'] ?? '') ?>"
                                    placeholder=" ">
                                <label for="link_prefeitura">Link Prefeitura</label>
                            </div>
                        </div>
                        <div class="form-section" id="section-dissidio">
                            <h5 class="form-section-title"><i class="fas fa-gavel me-2"></i>Dissídio</h5>
                            <div class="form-grid">
                                <div class="floating-label date-wrapper">
                                    <input type="month" name="dissidio" class="form-control"
                                        value="<?= htmlspecialchars($_SESSION['dados_form']['dissidio'] ?? '') ?>"
                                        placeholder=" ">
                                    <label for="dissidio">Mês/Ano do Dissídio</label>
                                    <i class="fas fa-calendar-alt date-icon"></i>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div class="form-section">
                        <h5 class="form-section-title"><i class="fas fa-comment me-2"></i>Observações</h5>
                        <div class="floating-label">
                            <textarea name="observacoes" class="form-control" rows="3" placeholder="Observações"><?= htmlspecialchars($_SESSION['dados_form']['observacoes'] ?? '') ?></textarea>
                        </div>
                    </div>

                    <div class="d-grid gap-2 mt-4">
                        <button type="submit" name="cadastrar" class="btn btn-primary btn-login">
                            <i class="fas fa-save me-2"></i> Cadastrar Empresa
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="modal fade" id="errosImportacaoModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-warning">
                    <h5 class="modal-title">Erros na Importação</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Mensagem de Erro</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (isset($_SESSION['erros_importacao'])): ?>
                                    <?php foreach ($_SESSION['erros_importacao'] as $index => $erro): ?>
                                        <tr>
                                            <td><?= $index + 1 ?></td>
                                            <td><?= htmlspecialchars($erro) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                    <?php unset($_SESSION['erros_importacao']); ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                </div>
            </div>
        </div>
    </div>

    <div class="loading-overlay" id="loadingOverlay">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <h4>Cadastrando...</h4>
            <p>Por favor, aguarde um momento.</p>
        </div>
    </div>

    <div class="popup-overlay" id="messagePopup">
        <div class="popup-container">
            <div class="popup-header" id="popupHeader">
                <i class="fas fa-check-circle"></i>
                <h5 class="mb-0" id="popupTitle">Sucesso</h5>
            </div>
            <div class="popup-body">
                <p id="popupMessage">Mensagem de exemplo</p>
            </div>
            <div class="popup-footer">
                <button class="popup-btn" id="popupButton">OK</button>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js"></script>
    <script>
        $(document).ready(function() {
            // =======================================================
            // == CORREÇÃO 3: JAVASCRIPT ATUALIZADO ==
            // =======================================================
            function toggleCadastroType() {
                const tipo = $('#tipo_cadastro').val();

                // Seções do modo Normal
                const $sectionDatas = $('#section-importantes');
                const $sectionConfig = $('#section-configuracoes');
                const $sectionAcesso = $('div.form-section:has(h5:contains("Acesso à Prefeitura"))');
                const $sectionDissidio = $('#section-dissidio');

                // Seção específica do Cushman
                const $sectionPermCushman = $('#section-permissoes-cushman');

                // Campos do modo Normal que precisam ser desabilitados
                const $camposNormalHidden = $sectionConfig.find('select, input').add($sectionDissidio.find('input'));

                if (tipo === 'cushman') {
                    // --- MODO CUSHMAN ---
                    $sectionDatas.slideUp(200);
                    $sectionConfig.slideUp(200);
                    $sectionDissidio.slideUp(200);
                    $sectionAcesso.slideUp(200); // Acesso prefeitura também some no modo Cushman

                    // Desabilita campos do modo Normal
                    $camposNormalHidden.prop('required', false).prop('disabled', true);
                    $sectionConfig.find('select[name="tributacao"]').prop('required', false);

                    // Mostra seções Cushman
                    $sectionPermCushman.slideDown(200);

                    // Dispara o 'change' para mostrar/esconder a sub-seção de detalhes do certificado
                    $('#certificado_cliente').trigger('change');

                } else {
                    // --- MODO NORMAL ---
                    $sectionDatas.slideDown(200);
                    $sectionConfig.slideDown(200);
                    $sectionAcesso.slideDown(200);
                    $sectionDissidio.slideDown(200);

                    // Reabilita campos do modo Normal
                    $camposNormalHidden.prop('disabled', false);
                    $sectionConfig.find('select[name="tributacao"]').prop('required', true);

                    // Oculta seções Cushman
                    $sectionPermCushman.slideUp(200);

                    // Dispara o 'change' para mostrar/esconder a sub-seção de detalhes do certificado
                    $('#certificado_cliente').trigger('change');
                }
            }

            // Função para controlar a visibilidade dos campos de Certificado (Original - está correta)
            function toggleCertificadoFields() {
                const temCertificado = $('#certificado_cliente').val();
                if (temCertificado === 'Sim') {
                    $('#section-certificado').slideDown(200);
                } else {
                    $('#section-certificado').slideUp(200);
                }
            }

            // Eventos de mudança
            $('#tipo_cadastro').on('change', toggleCadastroType);
            $('#certificado_cliente').on('change', toggleCertificadoFields);

            // Chamada inicial ao carregar a página (Garante o estado correto ao carregar)
            toggleCadastroType();
            toggleCertificadoFields();

            // --- O RESTANTE DO SEU CÓDIGO (VALIDAÇÕES E POPUP) PERMANECE INALTERADO ABAIXO ---

            // Mostrar popup se houver mensagem na sessão
            <?php if (isset($_SESSION['popup'])): ?>
                showPopup(
                    '<?= $_SESSION['popup']['tipo'] ?>',
                    '<?= addslashes(str_replace("\n", "\\n", $_SESSION['popup']['mensagem'])) ?>' // Permite quebra de linha
                );
                <?php unset($_SESSION['popup']); ?>
            <?php endif; ?>

            // Mostrar modal de erros se houver
            <?php if (isset($_SESSION['erros_importacao'])): ?>
                var errosModal = new bootstrap.Modal(document.getElementById('errosImportacaoModal'));
                errosModal.show();
            <?php endif; ?>

            // Formatação automática do CNPJ e CPF
            var cpfCnpjMaskBehavior = function (val) {
                return val.replace(/\D/g, '').length <= 11 ? '000.000.000-009' : '00.000.000/0000-00';
            },
            cpfCnpjoOptions = {
                onKeyPress: function(val, e, field, options) {
                    field.mask(cpfCnpjMaskBehavior.apply({}, arguments), options);
                    const digits = val.replace(/\D/g, '');
                    if (digits.length === 11 || digits.length === 14) {
                        $(field).removeClass('is-invalid').addClass('is-valid');
                    } else {
                        $(field).removeClass('is-valid');
                    }
                }
            };
            $('#cnpj').mask(cpfCnpjMaskBehavior, cpfCnpjoOptions);

            // Alternar visibilidade da senha
            $('.toggle-password').click(function() {
                const input = $(this).siblings('input');
                const icon = $(this).find('i');
                if (input.attr('type') === 'password') {
                    input.attr('type', 'text');
                    icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    input.attr('type', 'password');
                    icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            });

            // Botão de logout
            $('#logoutBtn').click(function() {
                $(this).css({
                    'transform': 'scale(1.2)',
                    'background': 'var(--error-color)',
                    'color': 'white'
                });
                setTimeout(() => {
                    window.location.href = 'logout.php';
                }, 300);
            });
$('#buscar-cnpj').click(function() {
    const cnpjInput = $('#cnpj');
    const cnpj = cnpjInput.val().replace(/\D/g, '');
    
    if (cnpj.length !== 14 && cnpj.length !== 11) {
        $('#cnpj-error').text('CNPJ/CPF inválido. Digite os 14 ou 11 números completos.').show();
        cnpjInput.addClass('is-invalid');
        return;
    }

    if (cnpj.length === 11) {
        $('#cnpj-error').text('A busca automática via API é exclusiva para CNPJ. Para CPF (Pessoa Física), preencha o nome manualmente.').show();
        return;
    }
    
    $('#cnpj-error').hide();
    $('#cnpj-loading').show();

    // Usando a BrasilAPI diretamente (sem proxy)
    $.ajax({
        url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        type: 'GET',
        dataType: 'json',
        timeout: 15000, 
        success: function(data) {
            $('#cnpj-loading').hide();
            
            if (data && data.razao_social) {
                // Preenche o nome da empresa
                $('#empresa').val(data.razao_social).focus();
                
                // Preenche o município (A BrasilAPI retorna direto no objeto principal)
                if (data.municipio && data.uf) {
                    $('[name="municipio"]').val(`${data.municipio}/${data.uf}`);
                }
            } else {
                $('#cnpj-error').text('CNPJ não encontrado.').show();
            }
        },
        error: function(xhr, status, error) {
            $('#cnpj-loading').hide();
            $('#cnpj-error').text('Erro ao consultar CNPJ. Verifique se o CNPJ é válido.').show();
            console.error('Erro na consulta CNPJ:', status, error);
        }
    });
});
            // LÓGICA DE SUBMISSÃO DO FORMULÁRIO (VALIDAÇÃO CORRIGIDA)
            $('#form-empresa').submit(function(e) {
                const cnpj = $('#cnpj').val().replace(/\D/g, '');
                if (cnpj.length !== 14 && cnpj.length !== 11) {
                    e.preventDefault();
                    showPopup('erro', 'CNPJ/CPF inválido. Digite os 14 ou 11 números completos.');
                    $('#cnpj').addClass('is-invalid').focus();
                    return false;
                }
                if ($('#empresa').val().trim() === '') {
                    e.preventDefault();
                    showPopup('erro', 'O nome da empresa é obrigatório.');
                    $('#empresa').focus();
                    return false;
                }

                // =======================================================================
                // == CORREÇÃO 3.2: Validação de Datas (JS) ==
                // =======================================================================
                const dataContrato = $('[name="data_contrato"]').val();
                const dataObrigacao = $('[name="data_obrigacao"]').val();
                const dataSaida = $('[name="data_saida"]').val();
                const dataProcuracao = $('[name="data_procuracao_target"]').val();
                const dataEmissao = $('[name="data_emissao_certificado"]').val();
                const dataVencimento = $('[name="data_vencimento_certificado"]').val();
                const dataDissidio = $('[name="dissidio"]').val();

                // Validação para type="date" (YYYY-MM-DD)
                if (dataContrato && !isValidDate(dataContrato)) {
                    e.preventDefault();
                    showPopup('erro', 'Data de contrato inválida.');
                    $('[name="data_contrato"]').focus();
                    return false;
                }
                if (dataObrigacao && !isValidDate(dataObrigacao)) {
                    e.preventDefault();
                    showPopup('erro', 'Data de obrigação inválida.');
                    $('[name="data_obrigacao"]').focus();
                    return false;
                }
                if (dataSaida && !isValidDate(dataSaida)) {
                    e.preventDefault();
                    showPopup('erro', 'Data de saída inválida.');
                    $('[name="data_saida"]').focus();
                    return false;
                }
                if (dataProcuracao && !isValidDate(dataProcuracao)) {
                    e.preventDefault();
                    showPopup('erro', 'Data da Procuração Target inválida.');
                    $('[name="data_procuracao_target"]').focus();
                    return false;
                }

                // Validação para type="month" (YYYY-MM)
                if (dataEmissao && !isValidMonth(dataEmissao)) {
                    e.preventDefault();
                    showPopup('erro', 'Data de Emissão do Certificado inválida (formato AAAA-MM).');
                    $('[name="data_emissao_certificado"]').focus();
                    return false;
                }
                if (dataVencimento && !isValidMonth(dataVencimento)) {
                    e.preventDefault();
                    showPopup('erro', 'Data de Vencimento do Certificado inválida (formato AAAA-MM).');
                    $('[name="data_vencimento_certificado"]').focus();
                    return false;
                }
                if (dataDissidio && !isValidMonth(dataDissidio)) {
                    e.preventDefault();
                    showPopup('erro', 'Data do Dissídio inválida (formato AAAA-MM).');
                    $('[name="dissidio"]').focus();
                    return false;
                }
                // =======================================================================

                $('#loadingOverlay').fadeIn();
                return true;
            });

            function isValidDate(dateString) {
                const regEx = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
                if (!dateString || !dateString.match(regEx)) return false;
                const d = new Date(dateString);
                if (Number.isNaN(d.getTime())) return false;
                return d.toISOString().slice(0, 10) === dateString;
            }

            // =======================================================================
            // == CORREÇÃO 3.3: Adicionada função de validação de Mês ==
            // =======================================================================
            function isValidMonth(dateString) {
                const regEx = /^\d{4}-\d{2}$/; // YYYY-MM
                if (!dateString || !dateString.match(regEx)) return false;
                const [year, month] = dateString.split('-');
                if (parseInt(month, 10) < 1 || parseInt(month, 10) > 12) return false;
                return true;
            }
            // =======================================================================


            function showPopup(tipo, mensagem) {
                const popup = $('#messagePopup');
                const header = $('#popupHeader');
                const icon = $('#popupHeader i'); // CORRIGIDO
                const title = $('#popupTitle');
                const message = $('#popupMessage');
                const button = $('#popupButton');

                if (tipo === 'sucesso') {
                    header.removeClass('erro aviso').addClass('sucesso');
                    icon.removeClass().addClass('fas fa-check-circle');
                    title.text('Sucesso!');
                    button.removeClass('erro aviso').addClass('sucesso');
                } else {
                    const isAviso = (tipo === 'aviso');
                    header.removeClass('sucesso').addClass(isAviso ? 'aviso' : 'erro');
                    icon.removeClass().addClass(isAviso ? 'fas fa-exclamation-triangle' : 'fas fa-exclamation-circle');
                    title.text(isAviso ? 'Aviso!' : 'Erro!');
                    button.removeClass('sucesso').addClass(isAviso ? 'aviso' : 'erro');
                }

                message.html(mensagem.replace(/\n/g, '<br>')); // Permite quebras de linha
                popup.addClass('active');

                $('#popupButton').off('click').on('click', function() {
                    popup.removeClass('active');
                });
                popup.off('click').on('click', function(e) {
                    if ($(e.target).is('#messagePopup')) {
                        popup.removeClass('active');
                    }
                });
            }

            function createParticles() {
                const container = $('#particlesContainer');
                const particleCount = window.innerWidth < 768 ? 20 : 40;
                container.empty();
                for (let i = 0; i < particleCount; i++) {
                    const particle = $('<div class="particle"></div>');
                    const size = Math.random() * 25 + 5;
                    const posX = Math.random() * 100;
                    const posY = Math.random() * 100;
                    const duration = Math.random() * 25 + 15;
                    const delay = Math.random() * 10;
                    const opacity = Math.random() * 0.2 + 0.05;
                    const blur = Math.random() * 5 + 2;
                    particle.css({
                        'width': size + 'px',
                        'height': size + 'px',
                        'left': posX + '%',
                        'top': posY + '%',
                        'animation': `float ${duration}s ease-in-out ${delay}s infinite`,
                        'opacity': opacity,
                        'filter': `blur(${blur}px)`,
                        'background': `radial-gradient(circle, var(--primary-color) 0%, transparent 70%)`
                    });
                    container.append(particle);
                }
            }

            const style = document.createElement('style');
            style.textContent = `
            @keyframes float {
                0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                25% { transform: translate(10px, 10px) rotate(5deg); }
                50% { transform: translate(0, 20px) rotate(0deg); opacity: 0.8; }
                75% { transform: translate(-10px, 10px) rotate(-5deg); }
            }
            `;
            document.head.appendChild(style);

            createParticles();
        });
    </script>
    <script src="scripts_globais.js"></script>
</body>

</html>