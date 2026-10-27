<?php
session_start();
if (isset($_SESSION['usuario'])) {
    header("Location: redirecionar.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Sistema Fiscal/Contábil</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/index.css">
</head>

<body>
    <div class="loading-overlay" id="loadingOverlay" style="display: none;">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <h4 class="mt-3">Carregando sistema...</h4>
            <p class="text-muted">Por favor, aguarde enquanto a página é carregada.</p>
        </div>
    </div>

    <div class="particles-container" id="particlesContainer"></div>

    <div class="theme-toggle" id="themeToggle">
        <i class="fas fa-moon"></i>
    </div>

    <div class="login-container">
        <div class="card">
            <div class="card-header">
                <img src="assets/imagens/logo.png" alt="Logo" class="logo">
                <h3>Controle de Fechamento</h3>
            </div>
            <div class="card-body">
                <form id="loginForm" method="POST" action="autenticar.php">
                    <div class="form-group floating-label">
                        <input type="text" class="form-control" id="usuario" name="usuario" placeholder=" " required>
                        <label for="usuario">Usuário</label>
                        <i class="fas fa-user input-icon"></i>
                    </div>
                    <div class="form-group floating-label">
                        <input type="password" class="form-control" id="senha" name="senha" placeholder=" " required>
                        <label for="senha">Senha</label>
                        <i class="fas fa-lock input-icon"></i>
                    </div>
                    <div class="d-grid gap-2 mt-4">
                        <button type="submit" class="btn btn-primary btn-login">
                            <i class="fas fa-sign-in-alt me-2"></i> Acessar Sistema
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <div class="popup-overlay" id="messagePopup">
        <div class="popup-container">
            <div class="popup-header" id="popupHeader">
                <i class="fas fa-info-circle"></i>
                <h5 id="popupTitle">Aviso</h5>
            </div>
            <div class="popup-body">
                <p id="popupMessage">Mensagem padrão.</p>
            </div>
            <div class="popup-footer">
                <button class="popup-btn" id="popupButton">OK</button>
            </div>
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            $(window).on('load', function() {
                $('#loadingOverlay').fadeOut(300);
            });

            const currentTheme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', currentTheme);
            updateThemeIcon(currentTheme);

            function createParticles() {
                const container = $('#particlesContainer');
                container.empty(); 
                const particleCount = window.innerWidth < 768 ? 20 : 40;

                for (let i = 0; i < particleCount; i++) {
                    const particle = $('<div class="particle"></div>');
                    const size = Math.random() * 15 + 5;
                    const posX = Math.random() * 100;
                    const posY = Math.random() * 100;
                    const duration = Math.random() * 20 + 10;
                    const delay = Math.random() * 5;

                    particle.css({
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${posX}%`,
                        top: `${posY}%`,
                        animation: `float ${duration}s ease-in-out ${delay}s infinite, fadePulse 3s ease-in-out ${delay}s infinite alternate`
                    });
                    container.append(particle);
                }
            }

            createParticles();

            $('#themeToggle').click(function() {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                updateThemeIcon(newTheme);
                createParticles();
            });

            function updateThemeIcon(theme) {
                const icon = $('#themeToggle i');
                if (theme === 'dark') {
                    icon.removeClass('fa-moon').addClass('fa-sun');
                } else {
                    icon.removeClass('fa-sun').addClass('fa-moon');
                }       
            }

            $('#loginForm').on('submit', function(e) {
                e.preventDefault(); 

                $('#loadingOverlay').fadeIn(300);

                $.ajax({
                    url: $(this).attr('action'),
                    type: $(this).attr('method'),
                    data: $(this).serialize(),
                    dataType: 'json',
                    success: function(response) {
                        $('#loadingOverlay').fadeOut(300);

                        if (response.success) {
                            showPopup('Sucesso!', response.message, 'sucesso');

                            setTimeout(function() {
                                window.location.href = response.redirect;
                            }, 1500);
                        } else {
                            showPopup('Erro de Acesso', response.message, 'erro');
                        }
                    },
                    error: function(xhr, status, error) {
                        $('#loadingOverlay').fadeOut(300);

                        let errorMsg = 'Ocorreu um erro ao tentar conectar ao servidor. Verifique sua conexão.';
                        showPopup('Erro de Conexão', errorMsg, 'erro');
                    }
                });
            });

            $('#popupButton').on('click', function() {
                $('#messagePopup').removeClass('active');
            });

            function showPopup(title, message, type) {
                $('#popupTitle').text(title);
                $('#popupMessage').text(message);

                const header = $('#popupHeader');
                const icon = header.find('i');
                const button = $('#popupButton');

                header.removeClass('sucesso erro');
                button.removeClass('sucesso erro');
                icon.removeClass('fa-check-circle fa-times-circle');

                if (type === 'sucesso') {
                    header.addClass('sucesso');
                    button.addClass('sucesso');
                    icon.addClass('fa-check-circle');
                } else {
                    header.addClass('erro');
                    button.addClass('erro');
                    icon.addClass('fa-times-circle');
                }

                $('#messagePopup').addClass('active');
            }

            $('.form-control').on('focus', function() {
                $(this).parent().addClass('is-focused');
            }).on('blur', function() {
                $(this).parent().removeClass('is-focused');
            });
        });
    </script>
</body>

</html>