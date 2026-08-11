import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Grupo Q-Max",
    short_name: "Q-Max",
    description:
      "Tecnologia, inovação e atitude conectando empresas, pessoas e soluções.",
    start_url: "/",
    display: "standalone",
    background_color: "#050506",
    theme_color: "#ef197d",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}