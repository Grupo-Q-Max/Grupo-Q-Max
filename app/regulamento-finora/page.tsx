import type { Metadata } from "next";
import Link from "next/link";
import { Scale, FileText, Building } from "lucide-react";
import { legal } from "@/data/site";
import "@/app/legal.css";

export const metadata: Metadata = {
  title: "Regulamento das Ativações FINORA",
  description: "Regras de participação e uso de dados nas ativações FINORA em eventos (roleta, cofre e brindes).",
  alternates: { canonical: "/regulamento-finora" },
};

/*
 * Linked from the registration forms in eventos/ ("Aceito o regulamento"). The prize rules in section 3
 * must be completed by the business/legal team: a draw whose result depends on chance may need prior
 * authorisation from the Ministério da Fazenda (Lei 5.768/1971) unless it is a free gift distribution.
 */
export default function RegulamentoFinoraPage() {
  return (
    <main className="qmax-legal-page">
      <div className="qmax-legal-container">
        <header className="qmax-legal-header">
          <div className="qmax-legal-badge">
            <Scale size={14} /> Ativações em eventos
          </div>
          <h1 className="qmax-legal-title">Regulamento das Ativações FINORA</h1>
          <p className="qmax-legal-subtitle">
            Regras de participação nas dinâmicas da FINORA em feiras e eventos, e como usamos os dados do cadastro.
          </p>
          <div className="qmax-legal-meta">
            <span className="qmax-legal-meta-item">
              <FileText size={14} /> Versão {legal.privacyVersion}
            </span>
            <span className="qmax-legal-meta-item">
              <Building size={14} /> FINORA · {legal.groupName}
            </span>
          </div>
        </header>

        <article className="qmax-legal-body">
          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">1. Quem pode participar</h2>
            <p>
              Pessoas maiores de 18 anos presentes no estande, uma participação por pessoa (por CPF) em cada evento. A
              participação é gratuita e não depende de compra ou contratação.
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">2. Cadastro</h2>
            <p>
              Para participar você informa nome, CPF, WhatsApp e, conforme a dinâmica, e-mail, CRO, nome da clínica e
              número de cadeiras. O CPF serve para garantir uma participação por pessoa e é guardado cifrado. Você recebe
              um PIN por WhatsApp para validar a participação. Para evitar fraude registramos também o identificador do
              aparelho do estande, IP e navegador.
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">3. Dinâmica e brindes</h2>
            <p>
              [A COMPLETAR PELA EQUIPE: descrição de cada dinâmica (roleta, cofre), brindes disponíveis, quantidades,
              forma e prazo de retirada, e o que acontece com brindes não retirados.]
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">4. Uso dos dados</h2>
            <ul>
              <li>Os dados do cadastro são usados para validar a participação, entregar o brinde e, se você pedir, agendar uma reunião.</li>
              <li>
                Receber novidades e contato comercial da FINORA é opcional e depende da caixa “Quero receber novidades”.
                Sem ela, seus dados não vão para o nosso CRM de marketing.
              </li>
              <li>Os dados são guardados por 12 meses após o fim do evento e depois anonimizados, salvo autorização para novidades.</li>
              <li>
                Você pode pedir acesso, correção ou exclusão e revogar a autorização de novidades pelo e-mail{" "}
                <a href={`mailto:${legal.dpoEmail}`}>{legal.dpoEmail}</a>.
              </li>
            </ul>
            <p>
              Detalhes na <Link href="/politica-de-privacidade">Política de Privacidade</Link>.
            </p>
          </section>

          <section className="qmax-legal-section">
            <h2 className="qmax-legal-heading">5. Disposições gerais</h2>
            <p>
              Cadastros com dados falsos, de terceiros ou repetidos podem ser cancelados. Dúvidas sobre este regulamento
              são resolvidas pela equipe no estande ou pelo e-mail acima, sem prejuízo dos direitos do consumidor.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
