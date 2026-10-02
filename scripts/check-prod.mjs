async function main() {
  // Check team API
  const r1 = await fetch('https://qmaxbrasil.com.br/api/team');
  console.log('=== /api/team ===');
  console.log('Status:', r1.status);
  console.log('Headers:', Object.fromEntries(r1.headers.entries()));
  const t1 = await r1.text();
  console.log('Body:', t1.substring(0, 2000));

  // Check CRM page
  const r2 = await fetch('https://qmaxbrasil.com.br/crm');
  console.log('\n=== /crm ===');
  console.log('Status:', r2.status);
  const t2 = await r2.text();
  // Look for error info in HTML
  const errorMatch = t2.match(/Error.*?<\/|error.*?<\//i);
  console.log('Error snippet:', errorMatch ? errorMatch[0] : 'none found');
  console.log('Body first 500:', t2.substring(0, 500));
}
main().catch(console.error);
