<?php
require_once __DIR__ . '/includes/bootstrap.php';

try {
    $pdo = db();
    
    // create user if not exists
    $stmt = $pdo->prepare("SELECT id FROM users LIMIT 1");
    $stmt->execute();
    $userId = $stmt->fetchColumn();

    if (!$userId) {
        $pdo->prepare("INSERT INTO users (microsoft_oid, name, email, role) VALUES ('dummy_oid_admin', 'Admin', 'admin@example.com', 'admin')")->execute();
        $userId = $pdo->lastInsertId();
    }

    $pdo->beginTransaction();

    // create quiz
    $pdo->prepare("INSERT INTO quizzes (title, description, status, show_score, created_by) VALUES (?, ?, 'published', 1, ?)")
        ->execute(['Quiz Q-Max', 'Participe do Quiz Q-Max e teste seus conhecimentos.', $userId]);
    $quizId = $pdo->lastInsertId();

    $questions = [
        [
            'text' => '1. O Grupo Q-Max apresenta quatro valores que orientam suas ações. Qual alternativa reúne apenas valores oficiais da empresa?',
            'type' => 'single',
            'options' => [
                ['text' => 'Colaboração e Conexão, Crescimento Sustentável, Inovação e Resultado', 'correct' => false],
                ['text' => 'Colaboração e Conexão, Sustentabilidade e Responsabilidade, Inovação com Propósito, Ética e Transparência', 'correct' => true],
                ['text' => 'Ética e Transparência, Qualidade, Produtividade e Liderança', 'correct' => false],
                ['text' => 'Sustentabilidade, Tecnologia, Qualificação e Crescimento', 'correct' => false],
            ]
        ],
        [
            'text' => '2. Uma empresa precisa de soluções de RH que vão desde recrutamento e seleção até o desenvolvimento de talentos. Qual empresa do ecossistema Q-Max atende diretamente essa necessidade?',
            'type' => 'single',
            'options' => [
                ['text' => 'Q-Max Auditoria', 'correct' => false],
                ['text' => 'Q-Max Technology', 'correct' => false],
                ['text' => 'Q-Max Talents', 'correct' => true],
                ['text' => 'Lagerhaus', 'correct' => false],
            ]
        ],
        [
            'text' => '3. Qual alternativa relaciona corretamente cada empresa a sua atuação?',
            'type' => 'single',
            'options' => [
                ['text' => 'Q-Max Auditoria → RH | Q-Max Talents → Auditoria | Lagerhaus → Marketing', 'correct' => false],
                ['text' => 'Q-Max Contábil → Gestão contábil e fiscal | Q-Max Technology → Estratégias digitais | Lagerhaus → Endereço fiscal e comercial', 'correct' => true],
                ['text' => 'Q-Max Technology → Auditoria | Q-Max Contábil → Coworking | Q-Max Talents → Certificados digitais', 'correct' => false],
                ['text' => 'Lagerhaus → Gestão contábil | Q-Max Auditoria → Marketing | Q-Max Talents → Coworking', 'correct' => false],
            ]
        ],
        [
            'text' => '4. O QXBACK faz parte dos produtos do Grupo Q-Max. Qual destas opções NÃO aparece entre as funcionalidades apresentadas para ele?',
            'type' => 'single',
            'options' => [
                ['text' => 'Cashback por serviços contratados', 'correct' => false],
                ['text' => 'Bônus por propostas enviadas', 'correct' => false],
                ['text' => 'Plataforma de gestão de indicações', 'correct' => false],
                ['text' => 'Emissão de certificados digitais', 'correct' => true],
            ]
        ],
        [
            'text' => '5. O QXSIGN possui uma proposta diferente do QXBACK. Qual conjunto de soluções está relacionado ao QXSIGN?',
            'type' => 'single',
            'options' => [
                ['text' => 'Cashback, bonificação por indicação e ganhos em tempo real', 'correct' => false],
                ['text' => 'Recrutamento, seleção e desenvolvimento de talentos', 'correct' => false],
                ['text' => 'Certificados digitais, documentação digital e acesso a sistemas governamentais', 'correct' => true],
                ['text' => 'Auditoria independente, compliance e gestão de riscos', 'correct' => false],
            ]
        ],
        [
            'text' => '6. A missão do Grupo Q-Max está diretamente relacionada a dois pontos. Quais?',
            'type' => 'single',
            'options' => [
                ['text' => 'Crescimento acelerado e aumento de vendas', 'correct' => false],
                ['text' => 'Soluções e serviços de alta qualidade e preservação da reputação por meio de atitudes éticas', 'correct' => true],
                ['text' => 'Expansão internacional e aquisição de novas empresas', 'correct' => false],
                ['text' => 'Tecnologia e redução de custos operacionais', 'correct' => false],
            ]
        ],
        [
            'text' => '7. Qual das alternativas apresenta corretamente a relação entre a visão do Grupo Q-Max e seus objetivos?',
            'type' => 'single',
            'options' => [
                ['text' => 'Tornar-se referência nacional em contabilidade, priorizando redução de custos', 'correct' => false],
                ['text' => 'Ser reconhecida como líder em soluções empresariais inovadoras, criando valor real para os clientes', 'correct' => true],
                ['text' => 'Tornar-se a maior empresa de tecnologia do Brasil', 'correct' => false],
                ['text' => 'Ser líder em auditoria independente e compliance', 'correct' => false],
            ]
        ],
        [
            'text' => '8. O Grupo Q-Max se define como um ecossistema empresarial sustentável. Qual alternativa melhor representa essa proposta?',
            'type' => 'single',
            'options' => [
                ['text' => 'Reunir empresas e profissionais para criar soluções inovadoras e impactantes, com compromisso com práticas ESG', 'correct' => true],
                ['text' => 'Concentrar todos os serviços em uma única empresa especializada', 'correct' => false],
                ['text' => 'Atuar exclusivamente nos segmentos contábil e financeiro', 'correct' => false],
                ['text' => 'Oferecer apenas soluções tecnológicas para outras empresas', 'correct' => false],
            ]
        ],
        [
            'text' => '9. Qual combinação apresenta somente produtos do Grupo Q-Max, e não empresas do ecossistema?',
            'type' => 'single',
            'options' => [
                ['text' => 'QXBACK, QXSIGN e FINORA', 'correct' => true],
                ['text' => 'Q-Max Auditoria, Q-Max Contábil e QXBACK', 'correct' => false],
                ['text' => 'Q-Max Talents, FINORA e Lagerhaus', 'correct' => false],
                ['text' => 'Q-Max Technology, QXSIGN e Q-Max Contábil', 'correct' => false],
            ]
        ],
        [
            'text' => '10. DESAFIO: Se uma empresa precisasse de auditoria, gestão contábil/fiscal, soluções de RH e estratégias digitais, quais empresas do ecossistema Q-Max poderiam atender, respectivamente, essas quatro necessidades?',
            'type' => 'single',
            'options' => [
                ['text' => 'Q-Max Auditoria → Q-Max Contábil → Q-Max Talents → Q-Max Technology', 'correct' => true],
                ['text' => 'Q-Max Contábil → Q-Max Auditoria → Lagerhaus → Q-Max Talents', 'correct' => false],
                ['text' => 'Q-Max Talents → Q-Max Technology → Q-Max Auditoria → Q-Max Contábil', 'correct' => false],
                ['text' => 'QXBACK → QXSIGN → FINORA → Lagerhaus', 'correct' => false],
            ]
        ],
        [
            'text' => '11. NOVAS CARAS, NOVAS HISTÓRIAS: Qual das combinações abaixo reúne corretamente nome, cargo e informação dos novos colaboradores desta edição?',
            'type' => 'single',
            'options' => [
                ['text' => 'Amanda Martins de Araújo — Customer Success Sr. — experiência anterior como SDR e em contas a pagar', 'correct' => true],
                ['text' => 'Amanda Martins de Araújo — Estagiária Fiscal — experiência anterior em cozinha e atendimento ao público', 'correct' => false],
                ['text' => 'Rafael Libano Rodrigues de Oliveira — Customer Success Sr. — experiência anterior como SDR', 'correct' => false],
                ['text' => 'Rafael Libano Rodrigues de Oliveira — Estagiário Fiscal — experiência anterior exclusivamente na área financeira', 'correct' => false],
            ]
        ],
        [
            'text' => '12. MISTÉRIO DA EDIÇÃO 👻: Ao longo desta edição, o fantasma Anastácio escondido aparece várias vezes pelas páginas. Quantas aparições devem ser encontradas ao todo?',
            'type' => 'single',
            'options' => [
                ['text' => '8', 'correct' => false],
                ['text' => '9', 'correct' => false],
                ['text' => '11', 'correct' => true],
                ['text' => '13', 'correct' => false],
            ]
        ],
        [
            'text' => '13. QUEM É ESSA PESSOA? Deixe aqui seu palpite de quem é a pessoa misteriosa da edição:',
            'type' => 'text',
        ]
    ];

    $pos = 1;
    foreach ($questions as $q) {
        $stmtQ = $pdo->prepare("INSERT INTO questions (quiz_id, question_text, type, position) VALUES (?, ?, ?, ?)");
        $stmtQ->execute([$quizId, $q['text'], $q['type'], $pos]);
        $questionId = $pdo->lastInsertId();

        if ($q['type'] === 'single' && isset($q['options'])) {
            $optPos = 1;
            foreach ($q['options'] as $opt) {
                $stmtO = $pdo->prepare("INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)");
                $stmtO->execute([$questionId, $opt['text'], $opt['correct'] ? 1 : 0, $optPos]);
                $optPos++;
            }
        }
        $pos++;
    }

    $pdo->commit();
    echo "Quiz inserido com sucesso! ID do Quiz: $quizId\n";

} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}
