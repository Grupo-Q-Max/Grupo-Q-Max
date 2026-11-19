"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Play, CheckCircle2, AlertTriangle, LoaderCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminProxy } from "@/lib/api-client";
import * as XLSX from "xlsx";

type Props = {
  eventId: number;
  messageTemplate: string;
};

export default function ExcelUploader({ eventId, messageTemplate }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(100);
  
  const [analysis, setAnalysis] = useState<{
    total: number;
    duplicateQueue: number;
    duplicateRegistered: number;
    ready: { name: string; cleanPhone: string }[];
  } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setAnalysis(null);
    
    setAnalyzing(true);
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const json = XLSX.utils.sheet_to_json(worksheet);
      
      const contacts = json.map((row: any) => ({
        name: row['Nome'] || row['NOME'] || row['name'] || row['Name'] || '',
        phone: String(row['Telefone'] || row['TELEFONE'] || row['phone'] || row['Phone'] || row['Celular'] || row['CELULAR'] || '')
      })).filter(c => c.phone);

      if (contacts.length === 0) {
        throw new Error("Não encontramos as colunas 'Nome' e 'Telefone' na planilha.");
      }

      const res = await fetchAdminProxy(`/whatsapp/event/${eventId}/analyze-contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts })
      });

      if (!res.ok) throw new Error("Erro na análise da planilha.");
      const result = await res.json();
      setAnalysis(result);
      toast.success("Planilha analisada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler a planilha.");
      setFile(null);
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleEnqueue() {
    if (!analysis || analysis.ready.length === 0) return;
    if (!messageTemplate || !messageTemplate.trim()) {
      return toast.error("A mensagem de envio não pode estar vazia. Preencha e salve a 'Mensagem de Cadastro' abaixo.");
    }

    const batch = analysis.ready.slice(0, batchSize);
    
    setEnqueuing(true);
    try {
      const res = await fetchAdminProxy(`/whatsapp/event/${eventId}/enqueue-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageTemplate,
          contacts: batch
        })
      });

      if (!res.ok) throw new Error("Erro ao iniciar o envio.");
      
      const data = await res.json();
      toast.success(`${data.queuedCount} mensagens foram enfileiradas com sucesso!`);
      
      // Update analysis state to reflect the sent items
      setAnalysis(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          duplicateQueue: prev.duplicateQueue + batch.length,
          ready: prev.ready.slice(batchSize)
        };
      });

    } catch (err: any) {
      toast.error(err.message || "Falha ao enviar o lote.");
    } finally {
      setEnqueuing(false);
    }
  }

  return (
    <div className="bg-surface border-2 border-emerald-500/30 rounded-3xl p-6 flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-black text-lg text-emerald-400 flex items-center gap-2">
            <FileSpreadsheet size={22} />
            <span>🎯 Disparo Inteligente por Excel</span>
          </h2>
          <p className="text-text-2 text-xs mt-1 max-w-2xl leading-relaxed">
            Faça upload da sua planilha (Excel ou CSV) contendo colunas <strong className="text-text">Nome</strong> e <strong className="text-text">Telefone</strong>. 
            O sistema cruzará os dados automaticamente para pular quem já é cliente ou já está na fila.
          </p>
        </div>
        
        <div>
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={analyzing || enqueuing}
            className="w-full sm:w-auto py-3 px-6 rounded-xl font-black transition-all bg-surface hover:bg-line-strong text-emerald-400 border border-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            {analyzing ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />}
            Importar Planilha
          </button>
        </div>
      </div>

      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-paper border border-line">
          <div className="flex flex-col items-center justify-center text-center p-3">
            <span className="text-[10px] uppercase font-bold text-text-2 tracking-wider">Total Lidos</span>
            <span className="text-3xl font-black text-text mt-1">{analysis.total}</span>
          </div>
          
          <div className="flex flex-col items-center justify-center text-center p-3 border-t md:border-t-0 md:border-l border-line">
            <span className="text-[10px] uppercase font-bold text-[#8A4B00] tracking-wider">Já estão na Fila</span>
            <span className="text-3xl font-black text-[#8A4B00] mt-1">{analysis.duplicateQueue}</span>
          </div>
          
          <div className="flex flex-col items-center justify-center text-center p-3 border-t md:border-t-0 md:border-l border-line">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Já Cadastrados</span>
            <span className="text-3xl font-black text-rose-400 mt-1">{analysis.duplicateRegistered}</span>
          </div>

          <div className="flex flex-col items-center justify-center text-center p-3 border-t md:border-t-0 md:border-l border-emerald-500/30 bg-emerald-500/15 md:rounded-r-xl">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Prontos p/ Enviar</span>
            <span className="text-3xl font-black text-emerald-400 mt-1">{analysis.ready.length}</span>
          </div>
        </div>
      )}

      {analysis && analysis.ready.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-text">
              <strong className="text-text block mb-1">Tudo pronto para o disparo!</strong>
              O sistema usará o texto salvo na seção <strong className="text-emerald-400">"Mensagem de Cadastro"</strong> que fica logo abaixo nesta tela.
              
              <div className="my-2 p-2 bg-paper rounded-lg border border-line text-xs text-text-2 italic line-clamp-2">
                {messageTemplate ? `"${messageTemplate}"` : "⚠️ NENHUMA MENSAGEM CONFIGURADA!"}
              </div>
              
              Selecione quantos contatos deseja enfileirar agora. O sistema vai aplicar os atrasos inteligentes (5 a 12 min) e pausar automaticamente à noite (21h as 08h).
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl px-4 py-3.5 outline-none w-full sm:w-auto cursor-pointer"
            >
              <option value={10}>Lote de 10</option>
              <option value={20}>Lote de 20</option>
              <option value={50}>Lote de 50</option>
              <option value={100}>Lote de 100</option>
            </select>
            <button
              onClick={handleEnqueue}
              disabled={enqueuing}
              className="w-full sm:w-auto py-3.5 px-6 rounded-full font-black transition-all bg-finora-600 hover:bg-finora-700 text-white disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {enqueuing ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              {enqueuing ? "Enviando..." : `Disparar Lote de ${batchSize}`}
            </button>
          </div>
        </div>
      )}
      
      {analysis && analysis.ready.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-[#FFF3DC] border border-[#F2D19B] rounded-2xl text-sm text-[#8A4B00]">
          <AlertTriangle size={20} className="shrink-0 text-[#8A4B00]" />
          Nenhum contato novo encontrado para envio. Todos já foram processados ou já se cadastraram.
        </div>
      )}
    </div>
  );
}
