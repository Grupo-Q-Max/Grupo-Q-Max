const fs = require('fs');
fs.copyFileSync('app/icon.png', 'public/favicon.png');
console.log('favicon.png copied to public/');
