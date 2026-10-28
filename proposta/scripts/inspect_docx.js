const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const fs = require("fs");
const path = require("path");

const inspectDocx = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, "binary");
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });
        
        const text = doc.getFullText();
        const tags = text.match(/\{[^{}]+\}/g) || [];
        const uniqueTags = [...new Set(tags)];
        
        console.log(`\nTags in ${path.basename(filePath)}:`);
        console.log(uniqueTags);
    } catch (e) {
        console.error("Error reading " + filePath, e.message);
    }
};

inspectDocx(path.join(__dirname, "../MODELO FINORA.docx"));
inspectDocx(path.join(__dirname, "../PROPOSTA FINORA 2026XXX - MODELO  1 (1).docx"));
