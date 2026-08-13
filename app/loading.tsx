import Image from "next/image";

export default function Loading() {
  return (
    <div className="qmaxLoading" role="status" aria-label="Carregando">
      <div className="qmaxLoading__inner">
        <div className="qmaxLoading__logo">
          <Image
            src="/brands/grupo-qmax-white.png"
            alt="Grupo Q-Max"
            width={190}
            height={104}
            priority
          />
        </div>

        <div className="qmaxLoading__line">
          <span />
        </div>

        <small>TECNOLOGIA · INOVAÇÃO · ATITUDE</small>
      </div>
    </div>
  );
}