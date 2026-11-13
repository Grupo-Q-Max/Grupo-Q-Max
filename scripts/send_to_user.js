const ZAPI_CONFIG = {
  instanceId: '3F89F6D486DE607670FCC6875DDA7AD5',
  token: 'B6484C6CC1E7F0C99EAAD46C',
  clientToken: 'F3c0fad77fa1b4aa485ee6d6ff93b4bbbS',
  baseUrl: 'https://api.z-api.io/instances',
};

const targetPhone = '5511942927082';

const message = `Olá, Dr(a). Rodrigo! 🎁 DONO DE CLÍNICA, SEU PRÓXIMO PASSO PARA CRESCER COM MAIS LUCRO É POR NOSSA CONTA!
 
A FINORA tem um presente para você: um ingresso GOLD de cortesia para a Imersão O Código das Clínicas Lucrativas, com o Dr. Igor Steinmeyer!
 
📅 20 e 21 de novembro de 2026
📍 Grupo Acelerador — Alphaville/SP
 
Serão dois dias de conteúdo prático sobre gestão, marketing e vendas, voltados a donos de consultórios e clínicas odontológicas de pequeno e médio porte que querem melhorar seus resultados e se preparar para os desafios do próximo ano.
 
💜 E a FINORA estará lá com você!
 
Nossa equipe estará presente para esclarecer dúvidas sobre contabilidade, impostos e gestão financeira, ajudando você a identificar oportunidades para transformar faturamento em lucro.
 
Você não precisa enfrentar os desafios da sua clínica sozinho. Vamos juntos!
 
FINORA — Inteligência financeira que transforma sorrisos em crescimento real.
 
Quer ter este presente??? 💝
Entre em contato e fale com nossa equipe!!`;

const mediaUrl = 'https://grupoqmax.com.br/disparos/midia.jpg';

async function sendTest() {
  console.log(`🚀 Enviando teste para ${targetPhone}...`);
  const url = `${ZAPI_CONFIG.baseUrl}/${ZAPI_CONFIG.instanceId}/token/${ZAPI_CONFIG.token}/send-image`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CONFIG.clientToken,
    },
    body: JSON.stringify({
      phone: targetPhone,
      image: mediaUrl,
      caption: message,
    }),
  });

  const responseText = await res.text();
  console.log(`Status HTTP: ${res.status}`);
  console.log('Resposta Z-API:', responseText);
}

sendTest().catch(console.error);
