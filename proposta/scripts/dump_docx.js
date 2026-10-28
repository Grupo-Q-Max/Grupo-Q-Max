const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const dumpText = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, "binary");
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        const text = doc.getFullText();
        fs.writeFileSync(filePath + ".txt", text);
        console.log(`Text dumped to ${path.basename(filePath)}.txt`);
    } catch (e) {
        console.error("Error reading " + filePath, e.message);
    }
};

dumpText(path.join(__dirname, "../MODELO FINORA.docx"));
dumpText(path.join(__dirname, "../PROPOSTA FINORA 2026XXX - MODELO  1 (1).docx"));
