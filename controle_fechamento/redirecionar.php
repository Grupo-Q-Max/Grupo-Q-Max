<?php
session_start();

if (!isset($_SESSION['usuario_id'])) {
    header("Location: index.php");
    exit();
}

$paginas = [
    'contabil' => 'contabil.php',
    'fiscal' => 'fiscal.php',
    'dp' => 'dp.php',
    'admin' => 'dashboard.php',
    'cadastro' => 'cadastrar.php',
    'lider_dp' => 'painel_lider.php',
    'lider_fiscal' => 'painel_lider.php',
    'lider_contabil' => 'painel_lider.php'
];


$redirect = $paginas[$_SESSION['tipo_conta']] ?? 'dashboard.php';
header("Location: " . $redirect);
exit();
?>