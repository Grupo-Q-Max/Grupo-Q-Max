"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var adapter_mariadb_1 = require("@prisma/adapter-mariadb");
var client_1 = require("../src/generated/prisma/client");
function getDatabaseConfig() {
    var databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl)
        throw new Error('DATABASE_URL não configurada.');
    var url = new URL(databaseUrl);
    return {
        host: url.hostname,
        port: Number(url.port || 3306),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ''),
    };
}
var config = getDatabaseConfig();
var adapter = new adapter_mariadb_1.PrismaMariaDb({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: 10,
});
var prisma = new client_1.PrismaClient({ adapter: adapter });
var SPINTAX_MESSAGE = "{Oieee|Oii|Oi|Ol\u00E1|Fala}, {nome}! {Aqui quem fala \u00E9 o|Sou o|Meu nome \u00E9} *HUGO, CEO da FINORA*. {\uD83D\uDC4B|\uD83D\uDE01|\uD83D\uDE80|\u270C\uFE0F}\n{Quero te agradecer|Passando para agradecer|Queria deixar meu agradecimento|Muito obrigado} por ter visitado nosso espa\u00E7o no *Clinicorp Summit 2026*!\n{Sabemos que|Entendemos que|A gente sabe que} {contabilidade, impostos e finan\u00E7as|a parte financeira e cont\u00E1bil|lidar com impostos e finan\u00E7as} sempre {s\u00E3o um grande desafio|d\u00E3o dor de cabe\u00E7a|s\u00E3o uma parte dif\u00EDcil}, e n\u00F3s {queremos te ajudar com isso|estamos aqui pra resolver isso|podemos cuidar disso} para voc\u00EA focar no que de verdade importa: a odontologia.\nVoc\u00EA {tem|teria|consegue} 30 minutinhos para uma conversa pra {entendermos melhor como podemos transformar|a gente te mostrar como ajudar|n\u00F3s avaliarmos como alavancar} a sua cl\u00EDnica?\n{A prop\u00F3sito|Ali\u00E1s|Aproveitando o contato}, voc\u00EA sabia que no evento n\u00F3s brindamos voc\u00EA com {duas cortesias|dois presentes}? {\uD83C\uDF81|\uD83C\uDF89|\u2728} \u00C9 isso mesmo! Pra quem {participou|esteve com a gente|marcou presen\u00E7a} no Clinicorp Summit e fechar conosco este m\u00EAs, estamos dando um *Diagn\u00F3stico de Obriga\u00E7\u00F5es Tribut\u00E1rias* e um *Certificado Digital (PF ou PJ)*.\n\uD83D\uDC49 {Para agendar e pegar suas cortesias, \u00E9 s\u00F3 chamar o comercial|Chama nosso time comercial aqui|Manda uma mensagem pro nosso time agora|Para garantir seus presentes, chama o time} em um desses n\u00FAmeros:\n\uD83D\uDCF1 (11) 91295-7356 (Edvaldo)\n\uD83D\uDCF1 (11) 95352-9736 (Vit\u00F3ria)\n{Um abra\u00E7o|Forte abra\u00E7o|Grande abra\u00E7o} e te {vejo|espero|encontro} entre os maiores na pr\u00F3xima edi\u00E7\u00E3o!";
function parseSpintax(text) {
    var spintaxRegex = /\{([^{}]+)\}/g;
    var result = text;
    var match;
    while ((match = spintaxRegex.exec(result)) !== null) {
        var options = match[1].split('|');
        var randomOption = options[Math.floor(Math.random() * options.length)];
        result = result.replace(match[0], randomOption);
        spintaxRegex.lastIndex = 0;
    }
    return result;
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var EVENT_ID, participations, queuedCount, _i, participations_1, part, phone, firstName, msg, cleanPhone;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Iniciando Broadcast do Hugo...');
                    EVENT_ID = 2;
                    return [4 /*yield*/, prisma.participations.findMany({
                            where: { event_id: EVENT_ID },
                            include: { participants: true },
                        })];
                case 1:
                    participations = _b.sent();
                    console.log("Encontrados ".concat(participations.length, " participantes."));
                    queuedCount = 0;
                    _i = 0, participations_1 = participations;
                    _b.label = 2;
                case 2:
                    if (!(_i < participations_1.length)) return [3 /*break*/, 5];
                    part = participations_1[_i];
                    phone = part.participants.phone;
                    if (!phone)
                        return [3 /*break*/, 4];
                    firstName = ((_a = part.participants.full_name) === null || _a === void 0 ? void 0 : _a.split(' ')[0]) || 'Visitante';
                    msg = SPINTAX_MESSAGE.replace(/\{nome\}/gi, firstName);
                    msg = parseSpintax(msg);
                    cleanPhone = phone.replace(/\D/g, '');
                    if (cleanPhone.length < 10)
                        return [3 /*break*/, 4];
                    // Enqueue
                    return [4 /*yield*/, prisma.message_queue.create({
                            data: {
                                event_id: EVENT_ID,
                                participant_id: part.participants.id,
                                phone: cleanPhone,
                                message: msg,
                                status: 'PENDING',
                                next_attempt_at: new Date(),
                            },
                        })];
                case 3:
                    // Enqueue
                    _b.sent();
                    queuedCount++;
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("Sucesso! ".concat(queuedCount, " mensagens adicionadas \u00E0 fila."));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(console.error)
    .finally(function () { return prisma.$disconnect(); });
