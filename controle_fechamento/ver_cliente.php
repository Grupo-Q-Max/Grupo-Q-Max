<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/assets/backend/config.php';

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

$query = "SELECT * FROM controle_fechamento WHERE id = ?";
$stmt = $conexao->prepare($query);
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$cliente = $result->fetch_assoc();

$stmt->close();
$conexao->close();
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detalhes do Cliente</title>
    <style>
        * {
            box-sizing: border-box;
            font-family: Arial, sans-serif;
        }

        .container {
            max-width: 800px;
            margin: 30px auto;
            padding: 20px;
        }

        h1 {
            color: #D90F81;
            text-align: center;
            margin-bottom: 30px;
        }

        .detalhes-cliente {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
        }

        .campo {
            margin-bottom: 15px;
            padding: 10px;
            border-bottom: 1px solid #eee;
        }

        .campo label {
            display: block;
            color: #666;
            font-weight: bold;
            margin-bottom: 5px;
        }

        .campo .valor {
            font-size: 1.1em;
            word-break: break-all;
        }

        .status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
        }

        .status.ativo {
            background-color: #28a745;
            color: white;
        }

        .status.inativo {
            background-color: #dc3545;
            color: white;
        }

        .voltar {
            background-color: #D90F81;
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s;
            border: none;
            margin-left: 10px;
            font-size: 0.85em;
            text-decoration: none;
        }

        .voltar:hover {
            background-color:rgb(135, 8, 80);
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .detalhes-cliente {
                padding: 15px;
            }

            .campo {
                padding: 8px;
            }
        }
    </style>
</head>

<body>
    <div class="container">
        <h1>Detalhes do Cliente</h1>

        <?php if ($cliente): ?>
            <div class="detalhes-cliente">
                <div class="campo">
                    <label>Código:</label>
                    <div class="valor"><?= $cliente['codigo'] ?></div>
                </div>

                <div class="campo">
                    <label>Status:</label>
                    <div class="valor">
                        <span <?= strtolower($cliente['status']) ?>"><?= $cliente['status'] ?></span>
                    </div>
                </div>

                <div class="campo">
                    <label>Empresa:</label>
                    <div class="valor"><?= htmlspecialchars($cliente['empresa']) ?></div>
                </div>

                <div class="campo">
                    <label>CNPJ:</label>
                    <div class="valor"><?= $cliente['cnpj'] ?></div>
                </div>

                <div class="campo">
                    <label>Tributação:</label>
                    <div class="valor"><?= $cliente['tributacao'] ?></div>
                </div>

                <div class="campo">
                    <label>Tipo:</label>
                    <div class="valor"><?= $cliente['tipo'] ?></div>
                </div>

                <div class="campo">
                    <label>Município:</label>
                    <div class="valor"><?= $cliente['municipio'] ?></div>
                </div>



                <div class="campo">
                    <label>Inscrição Estadual:</label>
                    <div class="valor"><?= $cliente['insc_estadual'] ?></div>
                </div>

                <div class="campo">
                    <label>Inscrição Municipal:</label>
                    <div class="valor"><?= $cliente['insc_municipal'] ?></div>
                </div>

                <div class="campo">
                    <label>Login Prefeitura:</label>
                    <div class="valor"><?= $cliente['login_prefeitura'] ?></div>
                </div>

                <div class="campo">
                    <label>Senha Prefeitura:</label>
                    <div class="valor"><?= $cliente['senha_prefeitura_ginfes'] ?></div>
                </div>

                <div class="campo">
                    <label>Senha GISS Online:</label>
                    <div class="valor"><?= $cliente['senha_giss_online'] ?></div>
                </div>

                <div class="campo">
                    <label>Link Prefeitura:</label>
                    <div class="valor">
                        <a href="<?= $cliente['link_prefeitura'] ?>" target="_blank" style="text-decoration: none;">Acessar</a>
                    </div>
                </div>

                <div class="campo">
                    <label>Envio:</label>
                    <div class="valor"><?= $cliente['envio'] ?></div>
                </div>

                <div class="campo">
                    <label>Observações:</label>
                    <div class="valor"><?= htmlspecialchars($cliente['observacoes'] ?? 'não possuí') ?></div>
                </div>
                <a href="index.php" class="voltar">Voltar</a>
            </div>
        <?php else: ?>
            <div class="erro">
                Cliente não encontrado!
            </div>
        <?php endif; ?>
    </div>
<script src="scripts_globais.js"></script>
</body>

</html>