const rawData = `
MANUELA SANTOS	11 91057-2810
HENRIQUE ISSAO 	44 99157-6897
FERNANDA MAGNABOSCO	48 99135-8485
ANA CARLA ARAÚJO	11 93418-0813
MARIANA BEDIN	11 97182-2337
NEIFI AKID	11 98131-4073
AMARO	11 98461-4877
FE 	11 98758-9444
SIDNEIS MUNHOZ	11 99268-1053
DRA. NATALIA REZENDE	11 99485-9700
JULIANY	11 99911-5925
REGINA	11 99991-4329
ANA PAULA DIAS	12 98266-7000
MARIANA	12 99700-9042
VICTOR LIMA	13 99737-2118
SAMIA LEAL	24 99218-6034
RRBARCELLOS2505	27 99737-3410
MARCELO QUEIROZ	31 97145-0047
RAQUEL LIMA	31 99184-0512
LILIANY	31 99499-4044
ÉRICA CARVALHO	35 99202-5541
JONATHAS PIASSI	37 99812-5671
THIAGO MILEIB	37 99821-0053
PAULA	37 99929-5163
DANI	41 99899-0019
JÉSSICA LIMA NESELLO 	41 99992-3089
GABRIELA LIMA FABRI	44 98455-0078
GLAUBER COSTA DE OLIVEIRA	55 99101-2648
VICTORIA MACHADO	61 98191-3071
TIA THAY	62 98406-6349
DRA ESTER LEONCIO	99 98405-9241
KARINNE SOUSA	99 99183-6364
	11 91333-0818
	11 94272-3105
	11 94635-9247
	11 94738-1450
	11 95000-7889
	11 95253-3109
	11 95648-6071
	11 95991-1782
	11 96339-0004
	11 96340-8878
	11 96424-7797
	11 99517-6991
	11 99547-1996
	11 99621-8074
	11 99632-8065
	11 99938-4590
	11 99991-1447
	14 99767-9363
	14 99783-8312
	15 98166-6459
	15 99772-7553
	16 98146-0330
	16 98218-3419
	16 99149-6639
	16 99250-1880
	27 99691-8219
	27 99946-2051
	27 99978-1227
	28 99884-2926
	31 98586-0407
`;

function parseContacts(raw) {
  const lines = raw.trim().split('\n');
  const contacts = [];
  const seenPhones = new Set();
  let duplicates = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('NOME')) continue;

    // Split by tab or multiple spaces
    let name = '';
    let phoneStr = '';

    const tabParts = line.split('\t');
    if (tabParts.length >= 2) {
      name = tabParts[0].trim();
      phoneStr = tabParts[tabParts.length - 1].trim();
    } else {
      // Find the phone part (numbers at the end)
      const match = trimmed.match(/^(.*?)(?:[\s\t]+)(\d{2}[\s\d\-]+)$/);
      if (match) {
        name = match[1].trim();
        phoneStr = match[2].trim();
      } else {
        phoneStr = trimmed;
      }
    }

    const clean = phoneStr.replace(/\D/g, '');
    if (clean.length < 10) continue;

    let fullPhone = clean.length === 10 || clean.length === 11 ? `55${clean}` : clean;
    const ddd = fullPhone.slice(2, 4);

    if (seenPhones.has(fullPhone)) {
      duplicates++;
      continue;
    }
    seenPhones.add(fullPhone);

    // Formatar nome amigável
    let friendlyName = '';
    if (name) {
      // Capitalizar
      const parts = name.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      friendlyName = parts[0];
      if (parts[0].toLowerCase().startsWith('dr')) {
        friendlyName = parts.slice(0, 2).join(' ');
      }
    }

    contacts.push({
      rawName: name,
      friendlyName,
      phone: fullPhone,
      displayPhone: phoneStr,
      ddd: Number(ddd)
    });
  }

  // Ordenar: DDD 11 PRIMEIRO, depois os outros DDDs em ordem crescente!
  contacts.sort((a, b) => {
    if (a.ddd === 11 && b.ddd !== 11) return -1;
    if (a.ddd !== 11 && b.ddd === 11) return 1;
    if (a.ddd !== b.ddd) return a.ddd - b.ddd;
    return a.phone.localeCompare(b.phone);
  });

  return { contacts, duplicates };
}

const { contacts, duplicates } = parseContacts(rawData);
console.log(`Total contatos únicos processados: ${contacts.length}`);
console.log(`Duplicados ignorados: ${duplicates}`);
console.log('\n--- CONTAGEM POR DDD (ORDENADOS) ---');
const dddCounts = {};
contacts.forEach(c => {
  dddCounts[c.ddd] = (dddCounts[c.ddd] || 0) + 1;
});
console.log(dddCounts);

console.log('\n--- PRIMEIROS 10 CONTATOS DA FILA ---');
contacts.slice(0, 10).forEach((c, i) => {
  console.log(`${i + 1}. DDD ${c.ddd} | ${c.phone} | Nome: "${c.friendlyName || '(Sem nome)'}" (Original: "${c.rawName}")`);
});

console.log('\n--- ÚLTIMOS 5 CONTATOS DA FILA ---');
contacts.slice(-5).forEach((c, i) => {
  console.log(`${contacts.length - 4 + i}. DDD ${c.ddd} | ${c.phone} | Nome: "${c.friendlyName || '(Sem nome)'}" (Original: "${c.rawName}")`);
});

