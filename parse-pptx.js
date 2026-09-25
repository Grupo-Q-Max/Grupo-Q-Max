const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// PPTX is a zip file, so we can unzip it
const file = 'Manual de Marca Technology.pptx';
const tempDir = path.join(__dirname, 'temp_pptx');

if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir);

console.log('Extracting PPTX...');
try {
    fs.copyFileSync(file, 'temp.zip');
    // using powershell to extract
    execSync(`powershell -Command "Expand-Archive -LiteralPath 'temp.zip' -DestinationPath '${tempDir}'"`);
    
    // Read slides
    const slidesDir = path.join(tempDir, 'ppt', 'slides');
    const slideFiles = fs.readdirSync(slidesDir).filter(f => f.endsWith('.xml'));
    
    let allText = '';
    
    for (const slideFile of slideFiles) {
        const content = fs.readFileSync(path.join(slidesDir, slideFile), 'utf8');
        // Extract text from <a:t>...</a:t> tags
        const regex = /<a:t>(.*?)<\/a:t>/g;
        let match;
        allText += `\n--- ${slideFile} ---\n`;
        while ((match = regex.exec(content)) !== null) {
            allText += match[1] + ' ';
        }
        allText += '\n';
    }
    
    console.log(allText);
    
    // Read theme colors
    const themeFile = path.join(tempDir, 'ppt', 'theme', 'theme1.xml');
    if (fs.existsSync(themeFile)) {
        const themeContent = fs.readFileSync(themeFile, 'utf8');
        const colorRegex = /<a:srgbClr val="([0-9A-Fa-f]{6})"\/>/g;
        let colorMatch;
        console.log('\n--- Cores Encontradas no Tema ---');
        const colors = new Set();
        while ((colorMatch = colorRegex.exec(themeContent)) !== null) {
            colors.add('#' + colorMatch[1]);
        }
        console.log(Array.from(colors).join('\n'));
    }

} catch (e) {
    console.error('Error:', e);
} finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
