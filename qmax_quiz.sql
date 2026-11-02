-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Tempo de geração: 02-Nov-2026 às 17:17
-- Versão do servidor: 10.5.29-MariaDB-0+deb11u1
-- versão do PHP: 8.4.17

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `qmax_quiz`
--

-- --------------------------------------------------------

--
-- Estrutura da tabela `answers`
--

CREATE TABLE `answers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `attempt_id` bigint(20) UNSIGNED NOT NULL,
  `question_id` bigint(20) UNSIGNED NOT NULL,
  `selected_option_id` bigint(20) UNSIGNED DEFAULT NULL,
  `text_answer` text DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `points_awarded` decimal(10,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `answers`
--

INSERT INTO `answers` (`id`, `attempt_id`, `question_id`, `selected_option_id`, `text_answer`, `is_correct`, `points_awarded`) VALUES
(4, 5, 2, 5, NULL, 0, 0.00),
(5, 5, 3, 9, NULL, 1, 1.00),
(6, 5, 4, 12, NULL, 1, 1.00),
(7, 5, 5, 18, NULL, 1, 1.00),
(8, 5, 6, 21, NULL, 1, 1.00),
(9, 5, 7, 24, NULL, 1, 1.00),
(10, 5, 8, 28, NULL, 1, 1.00),
(11, 5, 9, 31, NULL, 1, 1.00),
(12, 5, 10, 35, NULL, 1, 1.00),
(13, 5, 11, 39, NULL, 1, 1.00),
(14, 5, 12, 43, NULL, 1, 1.00),
(15, 5, 13, 49, NULL, 1, 1.00),
(16, 5, 14, NULL, 'Evandro', NULL, 0.00),
(17, 6, 2, 4, NULL, 1, 1.00),
(18, 6, 3, 9, NULL, 1, 1.00),
(19, 6, 4, 12, NULL, 1, 1.00),
(20, 6, 5, 18, NULL, 1, 1.00),
(21, 6, 6, 21, NULL, 1, 1.00),
(22, 6, 7, 24, NULL, 1, 1.00),
(23, 6, 8, 28, NULL, 1, 1.00),
(24, 6, 9, 31, NULL, 1, 1.00),
(25, 6, 10, 35, NULL, 1, 1.00),
(26, 6, 11, 39, NULL, 1, 1.00),
(27, 6, 12, 43, NULL, 1, 1.00),
(28, 6, 13, 49, NULL, 1, 1.00),
(29, 6, 14, NULL, 'Evandro', NULL, 0.00),
(30, 7, 2, 4, NULL, 1, 1.00),
(31, 7, 3, 9, NULL, 1, 1.00),
(32, 7, 4, 12, NULL, 1, 1.00),
(33, 7, 5, 18, NULL, 1, 1.00),
(34, 7, 6, 21, NULL, 1, 1.00),
(35, 7, 7, 24, NULL, 1, 1.00),
(36, 7, 8, 28, NULL, 1, 1.00),
(37, 7, 9, 31, NULL, 1, 1.00),
(38, 7, 10, 35, NULL, 1, 1.00),
(39, 7, 11, 39, NULL, 1, 1.00),
(40, 7, 12, 43, NULL, 1, 1.00),
(41, 7, 13, 49, NULL, 1, 1.00),
(42, 7, 14, NULL, 'Vanessa', NULL, 0.00),
(43, 3, 2, 4, NULL, 1, 1.00),
(44, 3, 3, 9, NULL, 1, 1.00),
(45, 3, 4, 12, NULL, 1, 1.00),
(46, 3, 5, 18, NULL, 1, 1.00),
(47, 3, 6, 21, NULL, 1, 1.00),
(48, 3, 7, 24, NULL, 1, 1.00),
(49, 3, 8, 28, NULL, 1, 1.00),
(50, 3, 9, 31, NULL, 1, 1.00),
(51, 3, 10, 35, NULL, 1, 1.00),
(52, 3, 11, 39, NULL, 1, 1.00),
(53, 3, 12, 43, NULL, 1, 1.00),
(54, 3, 13, 49, NULL, 1, 1.00),
(55, 3, 14, NULL, 'Rodrigo :))', NULL, 0.00),
(56, 10, 2, 3, NULL, 0, 0.00),
(57, 10, 3, 9, NULL, 1, 1.00),
(58, 10, 4, 12, NULL, 1, 1.00),
(59, 10, 5, 18, NULL, 1, 1.00),
(60, 10, 6, 21, NULL, 1, 1.00),
(61, 10, 7, 26, NULL, 0, 0.00),
(62, 10, 8, 28, NULL, 1, 1.00),
(63, 10, 9, 31, NULL, 1, 1.00),
(64, 10, 10, 35, NULL, 1, 1.00),
(65, 10, 11, 39, NULL, 1, 1.00),
(66, 10, 12, 43, NULL, 1, 1.00),
(67, 10, 13, 48, NULL, 0, 0.00),
(68, 10, 14, NULL, 'Rafael', NULL, 0.00),
(69, 9, 2, 4, NULL, 1, 1.00),
(70, 9, 3, 9, NULL, 1, 1.00),
(71, 9, 4, 12, NULL, 1, 1.00),
(72, 9, 5, 18, NULL, 1, 1.00),
(73, 9, 6, 21, NULL, 1, 1.00),
(74, 9, 7, 23, NULL, 0, 0.00),
(75, 9, 8, 28, NULL, 1, 1.00),
(76, 9, 9, 31, NULL, 1, 1.00),
(77, 9, 10, 35, NULL, 1, 1.00),
(78, 9, 11, 39, NULL, 1, 1.00),
(79, 9, 12, 43, NULL, 1, 1.00),
(80, 9, 13, 49, NULL, 1, 1.00),
(81, 9, 14, NULL, 'Evandro', NULL, 0.00),
(82, 12, 2, 4, NULL, 1, 1.00),
(83, 12, 3, 9, NULL, 1, 1.00),
(84, 12, 4, 12, NULL, 1, 1.00),
(85, 12, 5, 17, NULL, 0, 0.00),
(86, 12, 6, 21, NULL, 1, 1.00),
(87, 12, 7, 24, NULL, 1, 1.00),
(88, 12, 8, 28, NULL, 1, 1.00),
(89, 12, 9, 31, NULL, 1, 1.00),
(90, 12, 10, 35, NULL, 1, 1.00),
(91, 12, 11, 39, NULL, 1, 1.00),
(92, 12, 12, 43, NULL, 1, 1.00),
(93, 12, 13, 48, NULL, 0, 0.00),
(94, 12, 14, NULL, 'Evandro', NULL, 0.00),
(95, 13, 2, 5, NULL, 0, 0.00),
(96, 13, 3, 9, NULL, 1, 1.00),
(97, 13, 4, 12, NULL, 1, 1.00),
(98, 13, 5, 18, NULL, 1, 1.00),
(99, 13, 6, 21, NULL, 1, 1.00),
(100, 13, 7, 26, NULL, 0, 0.00),
(101, 13, 8, 28, NULL, 1, 1.00),
(102, 13, 9, 31, NULL, 1, 1.00),
(103, 13, 10, 35, NULL, 1, 1.00),
(104, 13, 11, 39, NULL, 1, 1.00),
(105, 13, 12, 43, NULL, 1, 1.00),
(106, 13, 13, 49, NULL, 1, 1.00),
(107, 13, 14, NULL, 'Evandro', NULL, 0.00),
(108, 16, 2, 4, NULL, 1, 1.00),
(109, 16, 3, 9, NULL, 1, 1.00),
(110, 16, 4, 12, NULL, 1, 1.00),
(111, 16, 5, 18, NULL, 1, 1.00),
(112, 16, 6, 21, NULL, 1, 1.00),
(113, 16, 7, 24, NULL, 1, 1.00),
(114, 16, 8, 28, NULL, 1, 1.00),
(115, 16, 9, 31, NULL, 1, 1.00),
(116, 16, 10, 35, NULL, 1, 1.00),
(117, 16, 11, 39, NULL, 1, 1.00),
(118, 16, 12, 43, NULL, 1, 1.00),
(119, 16, 13, 48, NULL, 0, 0.00),
(120, 16, 14, NULL, 'Alessandra', NULL, 0.00),
(121, 17, 2, 4, NULL, 1, 1.00),
(122, 17, 3, 9, NULL, 1, 1.00),
(123, 17, 4, 12, NULL, 1, 1.00),
(124, 17, 5, 18, NULL, 1, 1.00),
(125, 17, 6, 21, NULL, 1, 1.00),
(126, 17, 7, 24, NULL, 1, 1.00),
(127, 17, 8, 28, NULL, 1, 1.00),
(128, 17, 9, 31, NULL, 1, 1.00),
(129, 17, 10, 35, NULL, 1, 1.00),
(130, 17, 11, 41, NULL, 0, 0.00),
(131, 17, 12, 43, NULL, 1, 1.00),
(132, 17, 13, 49, NULL, 1, 1.00),
(133, 17, 14, NULL, 'Vanessa', NULL, 0.00),
(134, 11, 2, 4, NULL, 1, 1.00),
(135, 11, 3, 9, NULL, 1, 1.00),
(136, 11, 4, 12, NULL, 1, 1.00),
(137, 11, 5, 18, NULL, 1, 1.00),
(138, 11, 6, 21, NULL, 1, 1.00),
(139, 11, 7, 24, NULL, 1, 1.00),
(140, 11, 8, 28, NULL, 1, 1.00),
(141, 11, 9, 31, NULL, 1, 1.00),
(142, 11, 10, 36, NULL, 0, 0.00),
(143, 11, 11, 39, NULL, 1, 1.00),
(144, 11, 12, 43, NULL, 1, 1.00),
(145, 11, 13, 49, NULL, 1, 1.00),
(146, 11, 14, NULL, 'Rodrigo', NULL, 0.00);

-- --------------------------------------------------------

--
-- Estrutura da tabela `attempts`
--

CREATE TABLE `attempts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `quiz_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `started_at` datetime NOT NULL DEFAULT current_timestamp(),
  `submitted_at` datetime DEFAULT NULL,
  `score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `max_score` decimal(10,2) NOT NULL DEFAULT 0.00,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `attempts`
--

INSERT INTO `attempts` (`id`, `quiz_id`, `user_id`, `started_at`, `submitted_at`, `score`, `max_score`, `ip_address`, `user_agent`) VALUES
(3, 2, 1, '2026-09-29 14:28:40', '2026-10-01 14:51:11', 12.00, 12.00, '189.29.200.89', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'),
(5, 2, 8, '2026-09-29 14:34:10', '2026-09-29 14:41:18', 11.00, 12.00, '189.38.24.169', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'),
(6, 2, 10, '2026-10-01 13:20:24', '2026-10-01 13:25:32', 12.00, 12.00, '189.38.24.169', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(7, 2, 11, '2026-10-01 13:24:30', '2026-10-01 13:33:27', 12.00, 12.00, '172.225.223.50', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1'),
(8, 2, 14, '2026-10-02 08:05:57', NULL, 0.00, 0.00, '189.54.17.63', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Mobile/15E148 Safari/604.1'),
(9, 2, 26, '2026-10-07 11:50:44', '2026-10-07 12:03:00', 11.00, 12.00, '177.112.36.222', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(10, 2, 27, '2026-10-07 11:51:52', '2026-10-07 12:01:18', 9.00, 12.00, '177.112.36.222', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(11, 2, 28, '2026-10-07 11:53:57', '2026-10-20 14:36:59', 11.00, 12.00, '177.112.36.222', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(12, 2, 30, '2026-10-07 12:02:05', '2026-10-07 13:16:11', 10.00, 12.00, '189.38.24.169', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(13, 2, 32, '2026-10-07 13:41:04', '2026-10-07 13:44:35', 10.00, 12.00, '189.38.24.169', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0'),
(14, 2, 38, '2026-10-08 09:28:46', NULL, 0.00, 0.00, '187.90.203.185', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36'),
(15, 2, 37, '2026-10-08 09:29:03', NULL, 0.00, 0.00, '177.112.36.222', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'),
(16, 2, 40, '2026-10-09 17:25:52', '2026-10-09 17:43:20', 11.00, 12.00, '186.207.18.198', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15'),
(17, 2, 41, '2026-10-19 19:26:33', '2026-10-19 20:08:01', 11.00, 12.00, '187.43.136.135', 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36'),
(18, 3, 1, '2026-10-30 11:25:44', NULL, 0.00, 0.00, '189.29.200.89', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'),
(19, 3, 3, '2026-10-30 11:29:34', NULL, 0.00, 0.00, '191.19.76.18', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:159.0) Gecko/20100101 Firefox/159.0');

-- --------------------------------------------------------

--
-- Estrutura da tabela `questions`
--

CREATE TABLE `questions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `quiz_id` bigint(20) UNSIGNED NOT NULL,
  `question_text` text NOT NULL,
  `type` enum('single','text') NOT NULL DEFAULT 'single',
  `points` smallint(5) UNSIGNED NOT NULL DEFAULT 1,
  `position` smallint(5) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `questions`
--

INSERT INTO `questions` (`id`, `quiz_id`, `question_text`, `type`, `points`, `position`) VALUES
(2, 2, '1. O Grupo Q-Max apresenta quatro valores que orientam suas ações. Qual alternativa reúne apenas valores oficiais da empresa?', 'single', 1, 1),
(3, 2, '2. Uma empresa precisa de soluções de RH que vão desde recrutamento e seleção até o desenvolvimento de talentos. Qual empresa do ecossistema Q-Max atende diretamente essa necessidade?', 'single', 1, 2),
(4, 2, '3. Qual alternativa relaciona corretamente cada empresa a sua atuação?', 'single', 1, 3),
(5, 2, '4. O QXBACK faz parte dos produtos do Grupo Q-Max. Qual destas opções NÃO aparece entre as funcionalidades apresentadas para ele?', 'single', 1, 4),
(6, 2, '5. O QXSIGN possui uma proposta diferente do QXBACK. Qual conjunto de soluções está relacionado ao QXSIGN?', 'single', 1, 5),
(7, 2, '6. A missão do Grupo Q-Max está diretamente relacionada a dois pontos. Quais?', 'single', 1, 6),
(8, 2, '7. Qual das alternativas apresenta corretamente a relação entre a visão do Grupo Q-Max e seus objetivos?', 'single', 1, 7),
(9, 2, '8. O Grupo Q-Max se define como um ecossistema empresarial sustentável. Qual alternativa melhor representa essa proposta?', 'single', 1, 8),
(10, 2, '9. Qual combinação apresenta somente produtos do Grupo Q-Max, e não empresas do ecossistema?', 'single', 1, 9),
(11, 2, '10. DESAFIO: Se uma empresa precisasse de auditoria, gestão contábil/fiscal, soluções de RH e estratégias digitais, quais empresas do ecossistema Q-Max poderiam atender, respectivamente, essas quatro necessidades?', 'single', 1, 10),
(12, 2, '11. NOVAS CARAS, NOVAS HISTÓRIAS: Qual das combinações abaixo reúne corretamente nome, cargo e informação dos novos colaboradores desta edição?', 'single', 1, 11),
(13, 2, '12. MISTÉRIO DA EDIÇÃO 👻: Ao longo desta edição, o fantasma Anastácio escondido aparece várias vezes pelas páginas. Quantas aparições devem ser encontradas ao todo?', 'single', 1, 12),
(14, 2, '13. QUEM É ESSA PESSOA? Deixe aqui seu palpite de quem é a pessoa misteriosa da edição:', 'text', 0, 13),
(91, 3, 'Maria Eduarda chegou ao Grupo para atuar em qual área?', 'single', 5, 1),
(92, 3, 'Lucas já teve experiência profissional com quais plataformas de e-commerce?', 'single', 1, 2),
(93, 3, 'Antes de entrar para o Grupo, Tatiane trabalhava em qual empresa?', 'single', 1, 3),
(94, 3, 'Em sua apresentação, Catia Cristina Batista da Silva compartilhou um pouco sobre sua trajetória. De qual cidade ela é?', 'single', 1, 4),
(95, 3, 'Qual data foi lembrada por Hugo e Laura durante a reunião, com a distribuição de saquinhos de doces?', 'single', 1, 5),
(96, 3, 'Na apresentação de Ale, como foi representada a relação entre os processos e setores da empresa?', 'single', 1, 6),
(97, 3, 'Qual foi o direcionamento reforçado durante a reunião para os chamados que precisam de continuidade?', 'single', 1, 7),
(98, 3, 'Uma empresa está se preparando para atrair investidores e precisa avaliar a confiabilidade de suas demonstrações financeiras, verificar se os controles internos estão funcionando adequadamente e identificar possíveis riscos ou inconsistências nos processos. Para isso, busca uma análise independente que ajude a fortalecer a transparência e a conformidade do negócio. Qual empresa do ecossistema Q-Max atende melhor a essa necessidade?', 'single', 1, 8),
(99, 3, 'Deixe seu palpite sobre quem é a pessoa misteriosa desta edição!', 'text', 0, 9);

-- --------------------------------------------------------

--
-- Estrutura da tabela `question_options`
--

CREATE TABLE `question_options` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `question_id` bigint(20) UNSIGNED NOT NULL,
  `option_text` varchar(500) NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT 0,
  `position` smallint(5) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `question_options`
--

INSERT INTO `question_options` (`id`, `question_id`, `option_text`, `is_correct`, `position`) VALUES
(3, 2, 'Colaboração e Conexão, Crescimento Sustentável, Inovação e Resultado', 0, 1),
(4, 2, 'Colaboração e Conexão, Sustentabilidade e Responsabilidade, Inovação com Propósito, Ética e Transparência', 1, 2),
(5, 2, 'Ética e Transparência, Qualidade, Produtividade e Liderança', 0, 3),
(6, 2, 'Sustentabilidade, Tecnologia, Qualificação e Crescimento', 0, 4),
(7, 3, 'Q-Max Auditoria', 0, 1),
(8, 3, 'Q-Max Technology', 0, 2),
(9, 3, 'Q-Max Talents', 1, 3),
(10, 3, 'Lagerhaus', 0, 4),
(11, 4, 'Q-Max Auditoria → RH | Q-Max Talents → Auditoria | Lagerhaus → Marketing', 0, 1),
(12, 4, 'Q-Max Contábil → Gestão contábil e fiscal | Q-Max Technology → Estratégias digitais | Lagerhaus → Endereço fiscal e comercial', 1, 2),
(13, 4, 'Q-Max Technology → Auditoria | Q-Max Contábil → Coworking | Q-Max Talents → Certificados digitais', 0, 3),
(14, 4, 'Lagerhaus → Gestão contábil | Q-Max Auditoria → Marketing | Q-Max Talents → Coworking', 0, 4),
(15, 5, 'Cashback por serviços contratados', 0, 1),
(16, 5, 'Bônus por propostas enviadas', 0, 2),
(17, 5, 'Plataforma de gestão de indicações', 0, 3),
(18, 5, 'Emissão de certificados digitais', 1, 4),
(19, 6, 'Cashback, bonificação por indicação e ganhos em tempo real', 0, 1),
(20, 6, 'Recrutamento, seleção e desenvolvimento de talentos', 0, 2),
(21, 6, 'Certificados digitais, documentação digital e acesso a sistemas governamentais', 1, 3),
(22, 6, 'Auditoria independente, compliance e gestão de riscos', 0, 4),
(23, 7, 'Crescimento acelerado e aumento de vendas', 0, 1),
(24, 7, 'Soluções e serviços de alta qualidade e preservação da reputação por meio de atitudes éticas', 1, 2),
(25, 7, 'Expansão internacional e aquisição de novas empresas', 0, 3),
(26, 7, 'Tecnologia e redução de custos operacionais', 0, 4),
(27, 8, 'Tornar-se referência nacional em contabilidade, priorizando redução de custos', 0, 1),
(28, 8, 'Ser reconhecida como líder em soluções empresariais inovadoras, criando valor real para os clientes', 1, 2),
(29, 8, 'Tornar-se a maior empresa de tecnologia do Brasil', 0, 3),
(30, 8, 'Ser líder em auditoria independente e compliance', 0, 4),
(31, 9, 'Reunir empresas e profissionais para criar soluções inovadoras e impactantes, com compromisso com práticas ESG', 1, 1),
(32, 9, 'Concentrar todos os serviços em uma única empresa especializada', 0, 2),
(33, 9, 'Atuar exclusivamente nos segmentos contábil e financeiro', 0, 3),
(34, 9, 'Oferecer apenas soluções tecnológicas para outras empresas', 0, 4),
(35, 10, 'QXBACK, QXSIGN e FINORA', 1, 1),
(36, 10, 'Q-Max Auditoria, Q-Max Contábil e QXBACK', 0, 2),
(37, 10, 'Q-Max Talents, FINORA e Lagerhaus', 0, 3),
(38, 10, 'Q-Max Technology, QXSIGN e Q-Max Contábil', 0, 4),
(39, 11, 'Q-Max Auditoria → Q-Max Contábil → Q-Max Talents → Q-Max Technology', 1, 1),
(40, 11, 'Q-Max Contábil → Q-Max Auditoria → Lagerhaus → Q-Max Talents', 0, 2),
(41, 11, 'Q-Max Talents → Q-Max Technology → Q-Max Auditoria → Q-Max Contábil', 0, 3),
(42, 11, 'QXBACK → QXSIGN → FINORA → Lagerhaus', 0, 4),
(43, 12, 'Amanda Martins de Araújo — Customer Success Sr. — experiência anterior como SDR e em contas a pagar', 1, 1),
(44, 12, 'Amanda Martins de Araújo — Estagiária Fiscal — experiência anterior em cozinha e atendimento ao público', 0, 2),
(45, 12, 'Rafael Libano Rodrigues de Oliveira — Customer Success Sr. — experiência anterior como SDR', 0, 3),
(46, 12, 'Rafael Libano Rodrigues de Oliveira — Estagiário Fiscal — experiência anterior exclusivamente na área financeira', 0, 4),
(47, 13, '8', 0, 1),
(48, 13, '9', 0, 2),
(49, 13, '11', 1, 3),
(50, 13, '13', 0, 4),
(319, 91, 'Departamento Pessoal', 0, 1),
(320, 91, 'Fiscal', 0, 2),
(321, 91, 'Jurídica', 1, 3),
(322, 91, 'Marketing', 0, 4),
(323, 92, 'VTEX IO, Shopify e Wake Commerce', 1, 1),
(324, 92, 'Canva, Figma e Photoshop', 0, 2),
(325, 92, 'Excel, Power BI e SAP', 0, 3),
(326, 92, 'WordPress, Trello e RD Station', 0, 4),
(327, 93, 'Econverse', 0, 1),
(328, 93, 'Tarefy', 0, 2),
(329, 93, 'Wedo Contabilidade', 1, 3),
(330, 93, 'FINORA', 0, 4),
(331, 94, 'Santo André', 0, 1),
(332, 94, 'Mauá', 0, 2),
(333, 94, 'São Bernardo do Campo', 1, 3),
(334, 94, 'São Caetano do Sul', 0, 4),
(335, 95, 'Dia das Crianças', 1, 1),
(336, 95, 'Dia do Amigo', 0, 2),
(337, 95, 'Dia de São Cosme e Damião', 0, 3),
(338, 95, 'Dia da Família', 0, 4),
(339, 96, 'Como uma linha independente, em que cada setor trabalha sozinho', 1, 1),
(340, 96, 'Como uma rede, em que as entregas de cada área impactam as demais', 0, 2),
(341, 96, 'Como uma sequência exclusiva do setor administrativo', 0, 3),
(342, 96, 'Como um processo centralizado em uma única equipe', 0, 4),
(343, 97, 'Manter o mesmo chamado aberto indefinidamente', 1, 1),
(344, 97, 'Finalizar o chamado no mesmo dia e, se houver continuidade, abrir uma nova solicitação', 0, 2),
(345, 97, 'Encaminhar todos os chamados diretamente para o Customer Success', 0, 3),
(346, 97, 'Registrar apenas as solicitações que envolvem clientes externos', 0, 4),
(347, 98, 'Q-Max Contábil, com serviços de gestão contábil, fiscal e tributária.', 1, 1),
(348, 98, 'Q-Max Auditoria, com auditoria independente, análise de controles e avaliação de riscos.', 0, 2),
(349, 98, 'Q-Max Technology, com soluções digitais e desenvolvimento de sistemas.', 0, 3),
(350, 98, 'Q-Max Talents, com recrutamento, seleção e desenvolvimento de profissionais.', 0, 4);

-- --------------------------------------------------------

--
-- Estrutura da tabela `quizzes`
--

CREATE TABLE `quizzes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `title` varchar(180) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
  `time_limit_minutes` smallint(5) UNSIGNED DEFAULT NULL,
  `show_score` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `quizzes`
--

INSERT INTO `quizzes` (`id`, `title`, `description`, `status`, `time_limit_minutes`, `show_score`, `created_by`, `created_at`, `updated_at`) VALUES
(2, 'Quiz Q-Max', 'Participe do Quiz Q-Max e teste seus conhecimentos.', 'published', NULL, 1, 1, '2026-09-29 10:45:25', '2026-09-29 10:45:25'),
(3, 'Quiz de Novembro', '', 'published', NULL, 1, 3, '2026-10-23 14:45:40', '2026-10-30 11:25:15');

-- --------------------------------------------------------

--
-- Estrutura da tabela `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `microsoft_oid` varchar(80) NOT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(190) NOT NULL,
  `role` enum('admin','participant') NOT NULL DEFAULT 'participant',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Extraindo dados da tabela `users`
--

INSERT INTO `users` (`id`, `microsoft_oid`, `name`, `email`, `role`, `last_login_at`, `created_at`) VALUES
(1, 'ec16db76-2797-4f42-aff9-73738fc48695', 'Rodrigo Dante Penhalves', 'rodrigo@grupoqmax.com.br', 'admin', '2026-10-30 11:30:06', '2026-09-02 16:16:44'),
(3, 'f73b15fc-81de-4d8f-a58f-c468128f9fe7', 'Sofia Esteves Ramalho', 'sofia.esteves@grupoqmax.com.br', 'admin', '2026-10-30 11:15:42', '2026-09-02 16:18:52'),
(8, 'ef94189f-ae01-41d0-b685-ea3d98a88c84', 'Laura Werninghaus', 'laura@grupoqmax.com.br', 'admin', '2026-09-29 14:33:48', '2026-09-29 14:33:48'),
(10, '2bc30bd3-49ce-4572-bea0-53f24da5759d', 'Thiago Rodrigues de Freitas', 'thiago.freitas@grupoqmax.com.br', 'participant', '2026-10-01 13:20:21', '2026-10-01 13:20:21'),
(11, '64f5781d-7536-488e-a39f-35c0e22439a3', 'Hugo Ludwig Werninghaus', 'hugo@grupoqmax.com.br', 'admin', '2026-10-01 13:24:27', '2026-10-01 13:24:27'),
(14, '0a80a974-393b-4897-90ef-b845b86808ea', 'Isabela Bosi Bardy', 'isabela.bardy@grupoqmax.com.br', 'admin', '2026-10-08 09:25:04', '2026-10-02 08:05:54'),
(26, '89b94fef-0299-44fe-8a3a-6910ca123baf', 'Ana Vitória Rodrigues da Silva', 'vitoria.silva@grupoqmax.com.br', 'participant', '2026-10-07 11:50:42', '2026-10-07 11:50:42'),
(27, 'e8e09fa3-e9a0-4eaf-89c1-1d26f21268b4', 'Edvaldo de Oliveira Borges', 'edvaldo.borges@grupoqmax.com.br', 'participant', '2026-10-07 14:11:21', '2026-10-07 11:51:12'),
(28, '9896f2c5-bb53-4b29-99f9-57d6c564cb7d', 'Pedro Rodrigues Werninghaus', 'pedro@grupoqmax.com.br', 'participant', '2026-10-20 14:20:28', '2026-10-07 11:53:52'),
(30, '90313342-72d5-4b33-a3e6-32f3014c359f', 'Gisbert August Werninghaus', 'august@grupoqmax.com.br', 'participant', '2026-10-07 13:14:45', '2026-10-07 11:59:55'),
(32, '41266109-bda2-4fe3-821c-7f6ee01680a9', 'Alessandra Figueiredo dos Passos Santos', 'alessandra@grupoqmax.com.br', 'participant', '2026-10-07 13:41:02', '2026-10-07 13:41:02'),
(37, '5fae6c1c-9982-44c3-ae8c-261fdfe346ee', 'Lucas Samuel Borges', 'lucas.borges@grupoqmax.com.br', 'participant', '2026-10-08 09:26:31', '2026-10-08 09:26:31'),
(38, '38bd24cb27c1bc75', 'Lucas Samuel Borges', 'lucas.samuel23borges1@hotmail.com', 'participant', '2026-10-08 09:28:43', '2026-10-08 09:28:43'),
(40, 'd01fb791-7dd1-49d2-8acf-da3271b98a43', 'Feliciana da Silva Barbosa Barros', 'feliciana@grupoqmax.com.br', 'participant', '2026-10-09 17:24:20', '2026-10-09 17:24:20'),
(41, '0294d617-eff3-41f0-b61b-2ae8d7d1fc45', 'Vanessa Gonçalves da Silva', 'vanessa.silva@grupoqmax.com.br', 'participant', '2026-10-19 19:26:25', '2026-10-19 19:26:25');

--
-- Índices para tabelas despejadas
--

--
-- Índices para tabela `answers`
--
ALTER TABLE `answers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_attempt_question` (`attempt_id`,`question_id`),
  ADD KEY `fk_answer_question` (`question_id`),
  ADD KEY `fk_answer_option` (`selected_option_id`);

--
-- Índices para tabela `attempts`
--
ALTER TABLE `attempts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_one_attempt` (`quiz_id`,`user_id`),
  ADD KEY `fk_attempt_user` (`user_id`);

--
-- Índices para tabela `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_question_quiz` (`quiz_id`);

--
-- Índices para tabela `question_options`
--
ALTER TABLE `question_options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_option_question` (`question_id`);

--
-- Índices para tabela `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_quiz_creator` (`created_by`);

--
-- Índices para tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `microsoft_oid` (`microsoft_oid`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `answers`
--
ALTER TABLE `answers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=147;

--
-- AUTO_INCREMENT de tabela `attempts`
--
ALTER TABLE `attempts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT de tabela `questions`
--
ALTER TABLE `questions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100;

--
-- AUTO_INCREMENT de tabela `question_options`
--
ALTER TABLE `question_options`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=351;

--
-- AUTO_INCREMENT de tabela `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- Restrições para despejos de tabelas
--

--
-- Limitadores para a tabela `answers`
--
ALTER TABLE `answers`
  ADD CONSTRAINT `fk_answer_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_answer_option` FOREIGN KEY (`selected_option_id`) REFERENCES `question_options` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_answer_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `attempts`
--
ALTER TABLE `attempts`
  ADD CONSTRAINT `fk_attempt_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attempt_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `fk_question_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `question_options`
--
ALTER TABLE `question_options`
  ADD CONSTRAINT `fk_option_question` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE;

--
-- Limitadores para a tabela `quizzes`
--
ALTER TABLE `quizzes`
  ADD CONSTRAINT `fk_quiz_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
