const instanceId = '3F89F6D486DE607670FCC6875DDA7AD5';
const token = 'B6484C6CC1E7F0C99EAAD46C';
const clientToken = 'F3c0fad77fa1b4aa485ee6d6ff93b4bbbS';

async function test() {
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
  console.log('Testing Z-API status at:', url);
  const res = await fetch(url, {
    headers: { 'Client-Token': clientToken }
  });
  console.log('HTTP Status:', res.status);
  const data = await res.json();
  console.log('Data:', data);
}

test().catch(console.error);

