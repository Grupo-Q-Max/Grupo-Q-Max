    <?php
    require_once 'assets/backend/config.php';
    session_start();


    function registrarLog($conexao, $id_usuario, $acao, $nome_empresa, $id_registro_afetado, $coluna_afetada, $valor_antigo, $valor_novo)
    {
        $nome_usuario = $_SESSION['usuario_nome'] ?? 'Não encontrado';
        $tipo_conta = $_SESSION['tipo_conta'] ?? 'Não encontrado';
        $ip_usuario = $_SERVER['REMOTE_ADDR'] ?? 'Não encontrado';

        $query = "INSERT INTO logs (id_usuario, nome_usuario, tipo_conta, acao, nome_empresa, id_registro_afetado, coluna_afetada, valor_antigo, valor_novo, ip_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $conexao->prepare($query);

        // CORREÇÃO: A string de tipos deve ser 'issssissss'
        // 'i' -> id_usuario
        // 's' -> nome_usuario
        // 's' -> tipo_conta
        // 's' -> acao
        // 's' -> nome_empresa
        // 'i' -> id_registro_afetado
        // 's' -> coluna_afetada
        // 's' -> valor_antigo
        // 's' -> valor_novo
        // 's' -> ip_usuario
        $stmt->bind_param('issssissss', $id_usuario, $nome_usuario, $tipo_conta, $acao, $nome_empresa, $id_registro_afetado, $coluna_afetada, $valor_antigo, $valor_novo, $ip_usuario);
        $stmt->execute();
        $stmt->close();
    }

    header('Content-Type: application/json');

    $usuario_id_logado = $_SESSION['usuario_id'] ?? 0;
    $tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';

    $permissoes_permitidas = ['fiscal', 'lider_fiscal', 'admin'];

    if (!$usuario_id_logado || !in_array($tipo_conta_logado, $permissoes_permitidas)) {
        echo json_encode(['success' => false, 'message' => 'Acesso não autorizado para salvar dados Fiscais.']);
        exit();
    }

    $id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
    $coluna = filter_input(INPUT_POST, 'coluna');
    $valor = filter_input(INPUT_POST, 'valor');

    if (!$id || !$coluna) {
        echo json_encode(['success' => false, 'message' => 'Dados inválidos']);
        exit();
    }

$colunasPermitidas = [
    'status',
    'observacoes_fiscal',
    'reinf',
    'impostos',
    'iss',
    'mit',
    'dec_estadual',
    'sped_fiscal',
    'api_jettax',
    'sped_contribuicao',
    'destda',
    'alteracoes_pasta',
    'gia',
    'dctf',
    'dasnmei',
    'taxa_fiscal',
    'distribuicao_dirf',
    'carne_leao'
];

    if (!in_array($coluna, $colunasPermitidas)) {
        echo json_encode(['success' => false, 'message' => 'Coluna não permitida para edição']);
        exit();
    }

    // REMOVIDO: O bloco abaixo foi removido pois usava variáveis indefinidas ($dados, $empresa_id) e não tinha função prática.
    /*
    if (!empty($dados['reinf'])) {
        $stmt = $conexao->prepare("UPDATE notificacoes SET status = 'concluido' WHERE id_empresa = ? AND tipo = 'reinf' AND status = 'pendente'");
        $stmt->bind_param('i', $empresa_id);
        $stmt->execute();
        $stmt->close();
    }
    */

    if (!in_array($tipo_conta_logado, ['lider_fiscal', 'admin'])) {
        try {
            $stmt = $conexao->prepare("SELECT COUNT(*) as count FROM responsaveis_empresa WHERE id_empresa = ? AND id_usuario = ? AND responsavel_atual = 1");
            $stmt->bind_param('ii', $id, $_SESSION['usuario_id']);
            $stmt->execute();
            $result = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if ($result['count'] == 0) {
                echo json_encode(['success' => false, 'message' => 'Você não tem permissão para editar esta empresa']);
                exit();
            }
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => 'Erro ao verificar permissões']);
            exit();
        }
    }

    try {
        // --- INÍCIO DA ALTERAÇÃO ---

        // 1. Busca os dados da empresa e o status de edição do mês em uma única consulta
        $query_select = "
        SELECT 
            cf.id_mes, 
            cf.empresa, 
            cf.`$coluna` as valor_antigo_coluna, 
            cm.edicao_status
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        WHERE cf.id = ?
    ";
        $stmt = $conexao->prepare($query_select);
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $res = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        $id_mes = $res['id_mes'] ?? null;
        $nome_empresa = $res['empresa'] ?? '';
        $valor_antigo_log = $res['valor_antigo_coluna'] ?? null;
        $edicao_status_db = $res['edicao_status'] ?? 'bloqueada'; // Pega o status de edição

        if (!$id_mes) {
            echo json_encode(['success' => false, 'message' => 'Mês não encontrado para a empresa.']);
            exit();
        }

        // 2. APLICA A NOVA REGRA DE PERMISSÃO
        // A verificação antiga foi removida
        if ($edicao_status_db !== 'liberada') {
            echo json_encode(['success' => false, 'message' => 'Este mês está bloqueado para edições pelo administrador.']);
            exit();
        }

        $stmt = $conexao->prepare("SELECT id FROM controle_meses ORDER BY ano DESC, mes DESC LIMIT 12");
        $stmt->execute();
        $mesesValidos = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        $idsMesesEditaveis = array_column($mesesValidos, 'id');

        if (!in_array($id_mes, $idsMesesEditaveis)) {
            echo json_encode(['success' => false, 'message' => 'Este mês não é mais editável']);
            exit();
        }

        $query = "UPDATE controle_fechamento SET `$coluna` = ? WHERE id = ?";
        $stmt = $conexao->prepare($query);

        if ($stmt === false) {
            throw new Exception("Erro na preparação da query: " . $conexao->error);
        }

        $valorFinal = ($valor === '') ? NULL : $valor;
        $stmt->bind_param('si', $valorFinal, $id);
        $stmt->execute();
        $success = $stmt->affected_rows > 0;
        $stmt->close();

        if ($success) {
            // ADICIONADO: Chamada para a função de log após a atualização bem-sucedida.
            registrarLog($conexao, $usuario_id_logado, 'EDIÇÃO', $nome_empresa, $id, $coluna, $valor_antigo_log, $valorFinal);

            if ($coluna === 'iss' || $coluna === 'mit') {
                $stmt = $conexao->prepare("SELECT iss, mit FROM controle_fechamento WHERE id = ?");
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $result = $stmt->get_result()->fetch_assoc();
                $stmt->close();
                if (!empty($result['iss']) && !empty($result['mit'])) {
                    $stmt = $conexao->prepare("UPDATE notificacoes SET status = 'concluido' WHERE id_empresa = ? AND tipo = 'dp_completo' AND status = 'pendente'");
                    $stmt->bind_param('i', $id);
                    $stmt->execute();
                    $stmt->close();
                }
            }

            // CORRIGIDO: A verificação de mudança no 'reinf' agora usa a variável correta do valor antigo.
            if ($coluna === 'reinf' && $valorFinal !== $valor_antigo_log && !empty($valorFinal)) {
                $stmt = $conexao->prepare("SELECT DISTINCT u.id, u.nome FROM responsaveis_empresa re JOIN usuarios u ON re.id_usuario = u.id WHERE re.id_empresa = ? AND u.tipo_conta = 'dp' AND re.responsavel_atual = 1");
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $responsaveis_dp = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
                $stmt->close();
                foreach ($responsaveis_dp as $responsavel) {
                    $mensagem = "REINF preenchido para a empresa {$nome_empresa} pelo fiscal {$_SESSION['usuario_nome']}";
                    $stmt = $conexao->prepare("INSERT INTO notificacoes (id_usuario, mensagem, tipo, id_empresa, id_mes, status) VALUES (?, ?, 'reinf_preenchido', ?, ?, 'pendente')");
                    $stmt->bind_param('issi', $responsavel['id'], $mensagem, $id, $id_mes);
                    $stmt->execute();
                    $stmt->close();
                }
            }

            $camposFiscaisParaVerificar = ['reinf', 'impostos', 'iss', 'mit', 'dec_estadual', 'sped_fiscal', 'sped_contribuicao', 'destda', 'gia', 'dctf'];
            if (in_array($coluna, $camposFiscaisParaVerificar)) {
                $queryVerificacao = "SELECT " . implode(', ', $camposFiscaisParaVerificar) . " FROM controle_fechamento WHERE id = ?";
                $stmtVerificacao = $conexao->prepare($queryVerificacao);
                $stmtVerificacao->bind_param('i', $id);
                $stmtVerificacao->execute();
                $dadosFiscais = $stmtVerificacao->get_result()->fetch_assoc();
                $stmtVerificacao->close();
                $todosPreenchidos = true;
                foreach ($camposFiscaisParaVerificar as $campo) {
                    if (!isset($dadosFiscais[$campo]) || $dadosFiscais[$campo] === '') {
                        $todosPreenchidos = false;
                        break;
                    }
                }
                $novoStatusFiscal = $todosPreenchidos ? 'completo' : 'pendente';
                $stmtUpdateStatus = $conexao->prepare("UPDATE controle_fechamento SET status_fiscal = ? WHERE id = ?");
                $stmtUpdateStatus->bind_param('si', $novoStatusFiscal, $id);
                $stmtUpdateStatus->execute();
                $stmtUpdateStatus->close();
            }

            echo json_encode(['success' => true, 'message' => 'Atualizado com sucesso']);
        } else {
            echo json_encode(['success' => true, 'message' => 'Valor idêntico ao atual']);
        }
    } catch (Exception $e) {
        error_log('Erro ao atualizar empresa: ' . $e->getMessage());
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar: ' . $e->getMessage()]);
    }
