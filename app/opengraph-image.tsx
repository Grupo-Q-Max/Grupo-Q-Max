import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

export const alt =
  "Grupo Q-Max — Tecnologia, Inovação e Atitude";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  const logoPath = path.join(
    process.cwd(),
    "public",
    "brands",
    "grupo-qmax-white.png"
  );

  const logo = fs.readFileSync(logoPath);

  const logoSrc =
    `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#050506",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            right: -180,
            top: -170,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(239,25,125,.28) 0%, rgba(239,25,125,.06) 38%, transparent 70%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 530,
            height: 530,
            right: -15,
            top: 50,
            border: "1px solid rgba(239,25,125,.18)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 390,
            height: 390,
            right: 55,
            top: 120,
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 270,
            height: 270,
            right: 115,
            top: 180,
            border: "1px solid rgba(239,25,125,.09)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 5,
            background:
              "linear-gradient(90deg, #ef197d 0%, #ef197d 35%, transparent 70%)",
          }}
        />

        <div
          style={{
            width: "100%",
            padding: "68px 74px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: "#ef197d",
              }}
            />

            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: 5,
                color: "#f2a4c9",
              }}
            >
              GRUPO Q-MAX
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 760,
            }}
          >
            <div
              style={{
                fontSize: 78,
                lineHeight: 0.92,
                fontWeight: 800,
                letterSpacing: -5,
              }}
            >
              Tecnologia,
            </div>

            <div
              style={{
                fontSize: 78,
                lineHeight: 0.92,
                fontWeight: 800,
                letterSpacing: -5,
                color: "#ef197d",
              }}
            >
              Inovação,
            </div>

            <div
              style={{
                fontSize: 78,
                lineHeight: 0.92,
                fontWeight: 800,
                letterSpacing: -5,
              }}
            >
              Atitude.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              fontSize: 18,
              color: "#aaa6ad",
            }}
          >
            <span>Empresas</span>
            <span style={{ color: "#ef197d" }}>•</span>
            <span>Pessoas</span>
            <span style={{ color: "#ef197d" }}>•</span>
            <span>Tecnologia</span>
            <span style={{ color: "#ef197d" }}>•</span>
            <span>Soluções</span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: 70,
            top: 195,
            width: 380,
            height: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={logoSrc}
            width={360}
            height={210}
            alt=""
            style={{
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    ),
    size
  );
}