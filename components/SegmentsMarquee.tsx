import {
  Building2,
  Cpu,
  Factory,
  GraduationCap,
  HeartPulse,
  Scale,
  ShoppingBag,
  Stethoscope,
  Truck,
  Zap,
} from "lucide-react";

const segments = [
  { name: "Clínicas Odontológicas & Saúde", icon: Stethoscope, color: "#a45cff" },
  { name: "Startups & Empresas de Tecnologia", icon: Cpu, color: "#3156ff" },
  { name: "Indústria & Manufatura", icon: Factory, color: "#14d0c1" },
  { name: "Comércio, Varejo & E-commerce", icon: ShoppingBag, color: "#ff8b2a" },
  { name: "Serviços Corporativos & Advocacia", icon: Scale, color: "#d90f81" },
  { name: "Logística & Armazenagem", icon: Truck, color: "#fbbf24" },
  { name: "Holdings & Gestão Patrimonial", icon: Building2, color: "#14d0c1" },
  { name: "Educação & Treinamento", icon: GraduationCap, color: "#8f3aa8" },
];

export function SegmentsMarquee() {
  return (
    <div className="qmax-marquee-wrap" aria-label="Segmentos de atuação do Grupo Q-Max">
      <div className="qmax-marquee-track">
        {[...segments, ...segments, ...segments].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={`${item.name}-${idx}`} className="qmax-marquee-item">
              <span
                className="qmax-marquee-icon"
                style={{ color: item.color, borderColor: `${item.color}40`, background: `${item.color}15` }}
              >
                <Icon size={16} />
              </span>
              <span className="qmax-marquee-text">{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
