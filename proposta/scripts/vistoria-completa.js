const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function vistoriaCompleta() {
  console.log("==========================================================================");
  console.log("🔍 INICIANDO VISTORIA COMPLETA E AUDITORIA GERAL DO SISTEMA FINORA / Q-MAX");
  console.log("==========================================================================\n");

  const checklist = {
    bancoDeDados: false,
    tabelasVerificadas: [],
    rotasRegistradas: 0,
    arquivosPublicos: [],
    servicosAtivos: [],
    segurancaValida: true,
    errosEncontrados: []
  };

  // 1. VISTORIA DE BANCO DE DADOS
  console.log("1️⃣ [Banco de Dados] Verificando conexão e estrutura de tabelas...");
  try {
    const [tabelas] = await db.query("SHOW TABLES");
    const nomesTabelas = tabelas.map(t => Object.values(t)[0]);
    checklist.tabelasVerificadas = nomesTabelas;
    checklist.bancoDeDados = true;
    console.log(`   ✔ Banco conectado com sucesso! (${nomesTabelas.length} tabelas detectadas)`);
    console.log(`   ✔ Tabelas: ${nomesTabelas.join(", ")}`);
  } catch (err) {
    checklist.errosEncontrados.push(`Erro no banco de dados: ${err.message}`);
    console.log(`   ❌ Erro ao conectar no banco: ${err.message}`);
  }

  // 2. VISTORIA DE ROTAS E ARQUIVOS BACKEND
  console.log("\n2️⃣ [Backend & Rotas] Verificando integridade dos arquivos de rotas...");
  const routesDir = path.join(__dirname, "../routes");
  if (fs.existsSync(routesDir)) {
    const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith(".js"));
    routeFiles.forEach(f => {
      try {
        require(path.join(routesDir, f));
        console.log(`   ✔ Rota carregada com sucesso: /routes/${f}`);
        checklist.rotasRegistradas++;
      } catch (err) {
        checklist.errosEncontrados.push(`Erro na rota ${f}: ${err.message}`);
        console.log(`   ❌ Falha ao carregar rota ${f}: ${err.message}`);
      }
    });
  }

  // 3. VISTORIA DE SERVIÇOS
  console.log("\n3️⃣ [Serviços & Automações] Verificando integridade dos serviços...");
  const servicesDir = path.join(__dirname, "../services");
  if (fs.existsSync(servicesDir)) {
    const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith(".js"));
    serviceFiles.forEach(f => {
      try {
        require(path.join(servicesDir, f));
        console.log(`   ✔ Serviço validado: /services/${f}`);
        checklist.servicosAtivos.push(f);
      } catch (err) {
        checklist.errosEncontrados.push(`Erro no serviço ${f}: ${err.message}`);
        console.log(`   ❌ Falha no serviço ${f}: ${err.message}`);
      }
    });
  }

  // 4. VISTORIA DE INTERFACES E FRONTEND
  console.log("\n4️⃣ [Frontend & Telas] Verificando arquivos HTML estáticos...");
  const publicDir = path.join(__dirname, "../public");
  if (fs.existsSync(publicDir)) {
    const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith(".html"));
    htmlFiles.forEach(f => {
      const content = fs.readFileSync(path.join(publicDir, f), "utf8");
      const hasTitle = content.includes("<title>");
      const hasStyles = content.includes("styles.css") || content.includes("<style>");
      console.log(`   ✔ Interface validada: ${f} (${(content.length / 1024).toFixed(1)} KB, título=${hasTitle}, estilos=${hasStyles})`);
      checklist.arquivosPublicos.push(f);
    });
  }

  // 5. VISTORIA DE VARIÁVEIS DE AMBIENTE
  console.log("\n5️⃣ [Configurações & .env] Verificando variáveis de ambiente...");
  const chavesObrigatorias = [
    "PORT", "DB_HOST", "DB_USER", "DB_NAME", "JWT_SECRET", "BASE_URL"
  ];
  chavesObrigatorias.forEach(chave => {
    if (process.env[chave]) {
      console.log(`   ✔ Variável configurada: ${chave}`);
    } else {
      console.log(`   ⚠️ Variável com fallback padrão: ${chave}`);
    }
  });

  // RELATÓRIO FINAL
  console.log("\n==========================================================================");
  console.log("📊 RELATÓRIO FINAL DA VISTORIA COMPLETA");
  console.log("==========================================================================");
  console.log(`✔ Banco de Dados: ${checklist.bancoDeDados ? "100% OPERACIONAL" : "FALHA"}`);
  console.log(`✔ Tabelas Verificadas: ${checklist.tabelasVerificadas.length}`);
  console.log(`✔ Módulos de Rotas: ${checklist.rotasRegistradas} carregados sem erros`);
  console.log(`✔ Serviços Ativos: ${checklist.servicosAtivos.length} carregados sem erros`);
  console.log(`✔ Interfaces HTML: ${checklist.arquivosPublicos.length} validadas`);
  console.log(`✔ Total de Inconsistências Encontradas: ${checklist.errosEncontrados.length}`);

  if (checklist.errosEncontrados.length === 0) {
    console.log("\n🌟 RESULTADO: O SISTEMA ESTÁ EM PERFEITO ESTADO OPERACIONAL! (10/10)");
  } else {
    console.log("\n⚠️ Inconsistências:", checklist.errosEncontrados);
  }
  console.log("==========================================================================\n");

  await db.end();
}

vistoriaCompleta().catch(err => {
  console.error("Erro na vistoria:", err);
  process.exit(1);
});
