"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Award, CheckCircle2, ChevronRight, HelpCircle, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";

type Question = {
  id: number;
  text: string;
  type: "single" | "text";
  options?: { text: string; correct: boolean }[];
};

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "O Grupo Q-Max apresenta quatro valores que orientam suas ações. Qual alternativa reúne apenas valores oficiais da empresa?",
    type: "single",
    options: [
      { text: "Colaboração e Conexão, Crescimento Sustentável, Inovação e Resultado", correct: false },
      { text: "Colaboração e Conexão, Sustentabilidade e Responsabilidade, Inovação com Propósito, Ética e Transparência", correct: true },
      { text: "Ética e Transparência, Qualidade, Produtividade e Liderança", correct: false },
      { text: "Sustentabilidade, Tecnologia, Qualificação e Crescimento", correct: false },
    ],
  },
  {
    id: 2,
    text: "Uma empresa precisa de soluções de RH que vão desde recrutamento e seleção até o desenvolvimento de talentos. Qual empresa do ecossistema Q-Max atende diretamente essa necessidade?",
    type: "single",
    options: [
      { text: "Q-Max Auditoria", correct: false },
      { text: "Q-Max Technology", correct: false },
      { text: "Q-Max Talents", correct: true },
      { text: "Lagerhaus", correct: false },
    ],
  },
  {
    id: 3,
    text: "Qual alternativa relaciona corretamente cada empresa a sua atuação?",
    type: "single",
    options: [
      { text: "Q-Max Auditoria → RH | Q-Max Talents → Auditoria | Lagerhaus → Marketing", correct: false },
      { text: "Q-Max Contábil → Gestão contábil e fiscal | Q-Max Technology → Estratégias digitais | Lagerhaus → Endereço fiscal e comercial", correct: true },
      { text: "Q-Max Technology → Auditoria | Q-Max Contábil → Coworking | Q-Max Talents → Certificados digitais", correct: false },
      { text: "Lagerhaus → Gestão contábil | Q-Max Auditoria → Marketing | Q-Max Talents → Coworking", correct: false },
    ],
  },
  {
    id: 4,
    text: "O QXBACK faz parte dos produtos do Grupo Q-Max. Qual destas opções NÃO aparece entre as funcionalidades apresentadas para ele?",
    type: "single",
    options: [
      { text: "Cashback por serviços contratados", correct: false },
      { text: "Bônus por propostas enviadas", correct: false },
      { text: "Plataforma de gestão de indicações", correct: false },
      { text: "Emissão de certificados digitais", correct: true },
    ],
  },
  {
    id: 5,
    text: "O QXSIGN possui uma proposta diferente do QXBACK. Qual conjunto de soluções está relacionado ao QXSIGN?",
    type: "single",
    options: [
      { text: "Cashback, bonificação por indicação e ganhos em tempo real", correct: false },
      { text: "Recrutamento, seleção e desenvolvimento de talentos", correct: false },
      { text: "Certificados digitais, documentação digital e acesso a sistemas governamentais", correct: true },
      { text: "Auditoria independente, compliance e gestão de riscos", correct: false },
    ],
  },
  {
    id: 6,
    text: "A missão do Grupo Q-Max está diretamente relacionada a dois pontos. Quais?",
    type: "single",
    options: [
      { text: "Crescimento acelerado e aumento de vendas", correct: false },
      { text: "Soluções e serviços de alta qualidade e preservação da reputação por meio de atitudes éticas", correct: true },
      { text: "Expansão internacional e aquisição de novas empresas", correct: false },
      { text: "Tecnologia e redução de custos operacionais", correct: false },
    ],
  },
  {
    id: 7,
    text: "Qual das alternativas apresenta corretamente a relação entre a visão do Grupo Q-Max e seus objetivos?",
    type: "single",
    options: [
      { text: "Tornar-se referência nacional em contabilidade, priorizando redução de custos", correct: false },
      { text: "Ser reconhecida como líder em soluções empresariais inovadoras, criando valor real para os clientes", correct: true },
      { text: "Tornar-se a maior empresa de tecnologia do Brasil", correct: false },
      { text: "Ser líder em auditoria independente e compliance", correct: false },
    ],
  },
  {
    id: 8,
    text: "O Grupo Q-Max se define como um ecossistema empresarial sustentável. Qual alternativa melhor representa essa proposta?",
    type: "single",
    options: [
      { text: "Reunir empresas e profissionais para criar soluções inovadoras e impactantes, com compromisso com práticas ESG", correct: true },
      { text: "Concentrar todos os serviços em uma única empresa especializada", correct: false },
      { text: "Atuar exclusivamente nos segmentos contábil e financeiro", correct: false },
      { text: "Oferecer apenas soluções tecnológicas para outras empresas", correct: false },
    ],
  },
  {
    id: 9,
    text: "Qual combinação apresenta somente produtos do Grupo Q-Max, e não empresas do ecossistema?",
    type: "single",
    options: [
      { text: "QXBACK, QXSIGN e FINORA", correct: true },
      { text: "Q-Max Auditoria, Q-Max Contábil e QXBACK", correct: false },
      { text: "Q-Max Talents, FINORA e Lagerhaus", correct: false },
      { text: "Q-Max Technology, QXSIGN e Q-Max Contábil", correct: false },
    ],
  },
  {
    id: 10,
    text: "DESAFIO: Se uma empresa precisasse de auditoria, gestão contábil/fiscal, soluções de RH e estratégias digitais, quais empresas do ecossistema Q-Max poderiam atender, respectivamente, essas quatro necessidades?",
    type: "single",
    options: [
      { text: "Q-Max Auditoria → Q-Max Contábil → Q-Max Talents → Q-Max Technology", correct: true },
      { text: "Q-Max Contábil → Q-Max Auditoria → Lagerhaus → Q-Max Talents", correct: false },
      { text: "Q-Max Talents → Q-Max Technology → Q-Max Auditoria → Q-Max Contábil", correct: false },
      { text: "QXBACK → QXSIGN → FINORA → Lagerhaus", correct: false },
    ],
  },
  {
    id: 11,
    text: "NOVAS CARAS, NOVAS HISTÓRIAS: Qual das combinações abaixo reúne corretamente nome, cargo e informação dos novos colaboradores desta edição?",
    type: "single",
    options: [
      { text: "Amanda Martins de Araújo — Customer Success Sr. — experiência anterior como SDR e em contas a pagar", correct: true },
      { text: "Amanda Martins de Araújo — Estagiária Fiscal — experiência anterior em cozinha e atendimento ao público", correct: false },
      { text: "Rafael Libano Rodrigues de Oliveira — Customer Success Sr. — experiência anterior como SDR", correct: false },
      { text: "Rafael Libano Rodrigues de Oliveira — Estagiário Fiscal — experiência anterior exclusivamente na área financeira", correct: false },
    ],
  },
  {
    id: 12,
    text: "MISTÉRIO DA EDIÇÃO 👻: Ao longo desta edição, o fantasma Anastácio escondido aparece várias vezes pelas páginas. Quantas aparições devem ser encontradas ao todo?",
    type: "single",
    options: [
      { text: "8", correct: false },
      { text: "9", correct: false },
      { text: "11", correct: true },
      { text: "13", correct: false },
    ],
  },
  {
    id: 13,
    text: "QUEM É ESSA PESSOA? Deixe aqui seu palpite de quem é a pessoa misteriosa da edição:",
    type: "text",
  },
];

export default function QuizPage() {
  const [currentStep, setCurrentStep] = useState<"INTRO" | "QUIZ" | "LEAD_FORM" | "RESULT">("INTRO");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [mysteryGuess, setMysteryGuess] = useState("");

  // Lead fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const totalMultipleChoice = QUIZ_QUESTIONS.filter((q) => q.type === "single").length;

  function calculateScore(): number {
    let score = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (q.type === "single" && q.options) {
        const selectedIndex = answers[q.id];
        if (typeof selectedIndex === "number" && q.options[selectedIndex]?.correct) {
          score++;
        }
      }
    });
    return score;
  }

  function handleSelectOption(optionIndex: number) {
    const q = QUIZ_QUESTIONS[currentIndex];
    setAnswers((prev) => ({ ...prev, [q.id]: optionIndex }));
  }

  function handleNext() {
    if (currentIndex < QUIZ_QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentStep("LEAD_FORM");
    }
  }

  function handlePrev() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }

  async function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    const score = calculateScore();

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          score,
          totalQuestions: totalMultipleChoice,
          answers,
          mysteryGuess,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar resultado. Tente novamente.");
      }

      setCurrentStep("RESULT");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao enviar dados.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentQ = QUIZ_QUESTIONS[currentIndex];
  const progressPercent = Math.round(((currentIndex + 1) / QUIZ_QUESTIONS.length) * 100);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(0,229,255,0.15),transparent)]" />

      {/* Top Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition">
          <ArrowLeft size={16} /> Voltar ao Portal
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold">
          Quiz Ecossistema Q-Max
        </span>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-3xl mx-auto w-full">
        {currentStep === "INTRO" && (
          <div className="flex flex-col items-center text-center gap-6 animate-pop-burst">
            <div className="size-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 grid place-items-center text-cyan-400 shadow-[0_0_30px_rgba(0,229,255,0.25)]">
              <Sparkles size={36} />
            </div>
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-700/50 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
                Desafio de Conhecimento
              </span>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Quanto você conhece sobre o <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Grupo Q-Max</span>?
              </h1>
              <p className="text-slate-400 max-w-lg mx-auto text-base sm:text-lg">
                Teste seus conhecimentos sobre as empresas, soluções, valores e bastidores do nosso ecossistema.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left my-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <strong className="block text-white text-lg font-bold">13 Perguntas</strong>
                <span className="text-xs text-slate-400">Rápidas e objetivas</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <strong className="block text-white text-lg font-bold">Placar ao Vivo</strong>
                <span className="text-xs text-slate-400">Feedback instantâneo</span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <strong className="block text-white text-lg font-bold">Pessoa Misteriosa</strong>
                <span className="text-xs text-slate-400">Desafio bônus</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep("QUIZ")}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-lg transition-all shadow-[0_0_25px_rgba(0,229,255,0.4)] active:scale-95 cursor-pointer"
            >
              Começar o Quiz Agora <ArrowRight size={20} />
            </button>
          </div>
        )}

        {currentStep === "QUIZ" && currentQ && (
          <div className="w-full flex flex-col gap-6">
            {/* Barra de Progresso */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Pergunta {currentIndex + 1} de {QUIZ_QUESTIONS.length}</span>
                <span>{progressPercent}% concluído</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Enunciado da Pergunta */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                {currentQ.text}
              </h2>

              {/* Opções de Múltipla Escolha */}
              {currentQ.type === "single" && currentQ.options && (
                <div className="mt-6 flex flex-col gap-3">
                  {currentQ.options.map((opt, idx) => {
                    const isSelected = answers[currentQ.id] === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(0,229,255,0.2)]"
                            : "bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-slate-900/60"
                        }`}
                      >
                        <span
                          className={`size-6 rounded-full flex-none flex items-center justify-center text-xs font-mono font-bold mt-0.5 border ${
                            isSelected
                              ? "bg-cyan-400 border-cyan-400 text-slate-950"
                              : "border-slate-700 text-slate-400"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm sm:text-base font-medium leading-relaxed">
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Pergunta de Texto Aberto (Desafio Misterioso) */}
              {currentQ.type === "text" && (
                <div className="mt-6 flex flex-col gap-3">
                  <label htmlFor="mystery" className="text-sm text-slate-400">
                    Digite seu palpite abaixo:
                  </label>
                  <input
                    id="mystery"
                    type="text"
                    autoFocus
                    placeholder="Ex: Nome da pessoa que você acha..."
                    value={mysteryGuess}
                    onChange={(e) => setMysteryGuess(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white text-lg font-medium outline-none focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(0,229,255,0.2)] transition"
                  />
                </div>
              )}
            </div>

            {/* Controles de Navegação */}
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="px-5 py-2.5 rounded-full border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={currentQ.type === "single" && answers[currentQ.id] === undefined}
                className="px-7 py-3 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-sm transition shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
              >
                {currentIndex === QUIZ_QUESTIONS.length - 1 ? "Finalizar e Ver Pontuação" : "Próxima Pergunta"}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {currentStep === "LEAD_FORM" && (
          <form onSubmit={handleLeadSubmit} className="w-full max-w-md flex flex-col gap-6 animate-pop-burst">
            <div className="text-center space-y-2">
              <div className="size-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 grid place-items-center text-cyan-400 mx-auto shadow-[0_0_25px_rgba(0,229,255,0.2)]">
                <Award size={30} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Quiz Concluído!
              </h2>
              <p className="text-sm text-slate-400">
                Informe seus dados para salvar sua pontuação no ranking oficial do ecossistema.
              </p>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl border border-red-500/50 bg-red-950/40 text-red-300 text-xs font-semibold">
                {submitError}
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 backdrop-blur">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lead-name" className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  Nome Completo *
                </label>
                <input
                  id="lead-name"
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white text-base outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lead-email" className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  E-mail *
                </label>
                <input
                  id="lead-email"
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white text-base outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="lead-phone" className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                  WhatsApp / Celular
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white text-base outline-none focus:border-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full py-3.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-base transition shadow-[0_0_20px_rgba(0,229,255,0.3)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" /> Salvando...
                  </>
                ) : (
                  "Ver Meu Resultado Final"
                )}
              </button>
            </div>
          </form>
        )}

        {currentStep === "RESULT" && (
          <div className="w-full max-w-lg flex flex-col items-center text-center gap-6 animate-pop-burst">
            <div className="size-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-400 grid place-items-center text-cyan-300 shadow-[0_0_40px_rgba(0,229,255,0.4)]">
              <Award size={44} />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                Parabéns, {name.split(" ")[0]}!
              </h2>
              <p className="text-slate-400 text-base">
                Seu resultado foi registrado com sucesso em nosso sistema.
              </p>
            </div>

            {/* Placar */}
            <div className="w-full rounded-3xl border border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl flex flex-col items-center gap-4">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-cyan-400">
                Sua Pontuação Oficial
              </span>
              <div className="text-6xl sm:text-7xl font-black text-white font-mono drop-shadow-[0_0_25px_rgba(0,229,255,0.5)]">
                {calculateScore()} <span className="text-2xl text-slate-500 font-sans font-normal">/ {totalMultipleChoice}</span>
              </div>
              <p className="text-sm text-slate-300 max-w-xs">
                {calculateScore() >= 10
                  ? "Incrível! Você é um verdadeiro especialista no Ecossistema Q-Max."
                  : calculateScore() >= 7
                  ? "Muito bom! Você conhece bem a estrutura e soluções do Grupo Q-Max."
                  : "Bom começo! Continue acompanhando nossos canais para conhecer mais."}
              </p>
            </div>

            {mysteryGuess && (
              <div className="w-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-left">
                <span className="text-xs font-mono text-cyan-400 font-bold block mb-1">
                  SEU PALPITE DA PESSOA MISTERIOSA:
                </span>
                <span className="text-white font-semibold">"{mysteryGuess}"</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Link
                href="/"
                className="flex-1 py-3.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm text-center transition"
              >
                Conhecer o Grupo Q-Max
              </Link>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setMysteryGuess("");
                  setCurrentIndex(0);
                  setCurrentStep("QUIZ");
                }}
                className="px-6 py-3.5 rounded-full border border-slate-800 hover:bg-slate-900 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2 transition"
              >
                <RotateCcw size={16} /> Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500 font-mono">
        © {new Date().getFullYear()} Grupo Q-Max · Todos os direitos reservados.
      </footer>
    </main>
  );
}
