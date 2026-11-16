const instanceId = '3F89F6D486DE607670FCC6875DDA7AD5';
const token = 'B6484C6CC1E7F0C99EAAD46C';
const clientToken = 'F3c0fad77fa1b4aa485ee6d6ff93b4bbbS';

async function checkDetails() {
  const endpoints = ['status', 'phone', 'me', 'qr-code/image'];
  for (const ep of endpoints) {
    try {
      const res = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/${ep}`, {
        headers: { 'Client-Token': clientToken }
      });
      const data = await res.json().catch(() => null);
      console.log(`Endpoint [${ep}] -> HTTP ${res.status}:`, data);
    } catch (e) {
      console.log(`Endpoint [${ep}] error:`, e.message);
    }
  }
}

checkDetails().catch(console.error);

