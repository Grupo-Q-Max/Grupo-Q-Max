// assets/js/password_modal.js

function setupPasswordModal() {
    const modalOverlay = document.getElementById('passwordModalOverlay');
    const openBtn = document.getElementById('changePasswordBtn');
    const closeBtn = document.getElementById('closePasswordModalBtn');
    const form = document.getElementById('changePasswordForm');
    const messageDiv = document.getElementById('modal-message');

    openBtn.onclick = function() {
        form.reset();
        messageDiv.style.display = 'none';
        messageDiv.className = 'modal-message';
        modalOverlay.classList.add('active');
    };

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    closeBtn.onclick = closeModal;

    modalOverlay.addEventListener('click', function(event) {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });

    form.addEventListener('submit', function(event) {
        event.preventDefault();

        const saveBtn = document.getElementById('savePasswordBtn');
        const originalBtnText = saveBtn.querySelector('.button-text');
        const loadingIcon = saveBtn.querySelector('.loading-spinner-icon');

        saveBtn.disabled = true;
        originalBtnText.style.display = 'none';
        loadingIcon.style.display = 'inline-block';

        messageDiv.style.display = 'none';
        messageDiv.textContent = '';

        const novaSenha = document.getElementById('nova_senha').value;
        const confirmarSenha = document.getElementById('confirmar_senha').value;

        if (novaSenha !== confirmarSenha) {
            messageDiv.textContent = 'As novas senhas não coincidem!';
            messageDiv.className = 'modal-message error';
            messageDiv.style.display = 'block';

            saveBtn.disabled = false;
            originalBtnText.style.display = 'inline-block';
            loadingIcon.style.display = 'none';
            return;
        }

        const formData = new FormData(form);
        fetch('alterar_senha.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            messageDiv.textContent = data.message;
            messageDiv.style.display = 'block';

            if (data.success) {
                messageDiv.className = 'modal-message success';
                form.reset();
                setTimeout(() => {
                    closeModal();
                }, 2500);
            } else {
                messageDiv.className = 'modal-message error';
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            messageDiv.textContent = 'Ocorreu um erro de comunicação com o servidor.';
            messageDiv.className = 'modal-message error';
            messageDiv.style.display = 'block';
        })
        .finally(() => {
            // Reativa o botão em caso de erro, mas mantém a animação no caso de sucesso (o setTimeout a desativa)
            if (!messageDiv.classList.contains('success')) {
                saveBtn.disabled = false;
                originalBtnText.style.display = 'inline-block';
                loadingIcon.style.display = 'none';
            }
        });
    });
}
$(document).ready(function() {
    setupPasswordModal();
});