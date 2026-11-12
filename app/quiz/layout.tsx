import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Interno | Grupo Q-Max",
  description: "Ferramenta interna de alinhamento e conhecimento do Ecossistema Grupo Q-Max.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
