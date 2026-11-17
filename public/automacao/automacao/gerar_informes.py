#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AutoInforme IRRF PJ - Gerador de Informes de Rendimentos
Em conformidade com a Instrução Normativa SRF nº 119/2000
"""

import os
import re
import sys
import unicodedata

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm

MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

MONTH_MAP = {
    'janeiro': 0, 'jan': 0, '1': 0, '01': 0,
    'fevereiro': 1, 'fev': 1, '2': 1, '02': 1,
    'março': 2, 'marco': 2, 'mar': 2, '3': 2, '03': 2,
    'abril': 3, 'abr': 3, '4': 3, '04': 3,
    'maio': 4, 'mai': 4, '5': 4, '05': 4,
    'junho': 5, 'jun': 5, '6': 5, '06': 5,
    'julho': 6, 'jul': 6, '7': 6, '07': 6,
    'agosto': 7, 'ago': 7, '8': 7, '08': 7,
    'setembro': 8, 'set': 8, '9': 8, '09': 8,
    'outubro': 9, 'out': 9, '10': 9,
    'novembro': 10, 'nov': 10, '11': 10,
    'dezembro': 11, 'dez': 11, '12': 11
}

def parse_date_or_month(val):
    if pd.isna(val):
        return -1, None
    if hasattr(val, 'month'): # Timestamp or datetime.date
        return val.month - 1, getattr(val, 'year', None)
    if isinstance(val, (int, float)):
        if 1 <= val <= 12 and int(val) == val:
            return int(val) - 1, None
        if 30000 < val < 70000:
            import datetime
            d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(val))
            return d.month - 1, d.year

    s = str(val).strip()
    if not s:
        return 0, None

    # BR format DD/MM/YYYY
    m_br = re.search(r'^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})', s)
    if m_br:
        m_num = int(m_br.group(2))
        y_num = int(m_br.group(3))
        if y_num < 100:
            y_num += 2000
        if 1 <= m_num <= 12:
            return m_num - 1, y_num

    # ISO format YYYY-MM-DD
    m_iso = re.search(r'^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})', s)
    if m_iso:
        y_num = int(m_iso.group(1))
        m_num = int(m_iso.group(2))
        if 1 <= m_num <= 12:
            return m_num - 1, y_num

    # Words
    clean = re.sub(r'[\u0300-\u036f]', '', unicodedata.normalize('NFD', s).lower().strip())
    clean = re.sub(r'[^a-z0-9]', '', clean)
    for word, idx in MONTH_MAP.items():
        if clean == word or clean.startswith(word):
            return idx, None

    # Number
    if clean.isdigit():
        num = int(clean)
        if 1 <= num <= 12:
            return num - 1, None

    return -1, None

def parse_month(val):
    m, _ = parse_date_or_month(val)
    return m

def parse_currency(val):
    if pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace('R$', '').strip()
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0.0

def format_brl(val):
    if val is None or val == 0:
        return "0,00"
    return f"R$ {val:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')

def sanitize_filename(name):
    clean = unicodedata.normalize('NFD', str(name))
    clean = re.sub(r'[\u0300-\u036f]', '', clean)
    clean = re.sub(r'[^a-zA-Z0-9_\-\s]', '', clean)
    clean = re.sub(r'\s+', '_', clean.strip())
    return clean[:50]

def gerar_pdf_empresa(output_path, config, company_data):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm
    )

    styles = getSampleStyleSheet()
    
    style_normal = ParagraphStyle('Normal8', fontName='Helvetica', fontSize=7.5, leading=9)
    style_bold = ParagraphStyle('Bold8', fontName='Helvetica-Bold', fontSize=8, leading=10)
    style_title_section = ParagraphStyle('TitleSec', fontName='Helvetica-Bold', fontSize=8.5, leading=10)
    
    elements = []

    # Pág. 1
    elements.append(Paragraph("<font size=7 color='#666666'>Pág. 1</font>", style_normal))
    elements.append(Spacer(1, 2 * mm))

    # QUADRO 1: FONTE PAGADORA
    elements.append(Paragraph("<b>1. FONTE PAGADORA</b>", style_title_section))
    elements.append(Spacer(1, 1 * mm))
    
    q1_data = [
        [Paragraph("Nome Empresarial", style_normal)],
        [Paragraph(f"<b>{config['fonte_pagadora_nome'].upper()}</b>", style_bold)],
        [Paragraph("CNPJ", style_normal)],
        [Paragraph(f"<b>{config['fonte_pagadora_cnpj']}</b>", style_bold)]
    ]
    t_q1 = Table(q1_data, colWidths=[186 * mm])
    t_q1.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('LINEBELOW', (0, 1), (0, 1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_q1)
    elements.append(Spacer(1, 3 * mm))

    # QUADRO 2: PESSOA JURÍDICA BENEFICIÁRIA
    elements.append(Paragraph("<b>2. PESSOA JURÍDICA BENEFICIÁRIA DOS RENDIMENTOS</b>", style_title_section))
    elements.append(Spacer(1, 1 * mm))
    
    q2_data = [
        [Paragraph("Nome Empresarial", style_normal)],
        [Paragraph(f"<b>{company_data['razao_social']}</b>", style_bold)],
        [Paragraph("CNPJ", style_normal)],
        [Paragraph(f"<b>{company_data['cnpj']}</b>", style_bold)]
    ]
    t_q2 = Table(q2_data, colWidths=[186 * mm])
    t_q2.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('LINEBELOW', (0, 1), (0, 1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_q2)
    elements.append(Spacer(1, 3 * mm))

    # QUADRO 3: RENDIMENTO E IMPOSTO RETIDO NA FONTE
    elements.append(Paragraph("<b>3. RENDIMENTO E IMPOSTO RETIDO NA FONTE</b>", style_title_section))
    elements.append(Spacer(1, 1 * mm))

    q3_header = [
        Paragraph("<b>Mês</b>", ParagraphStyle('HCenter', fontName='Helvetica-Bold', fontSize=7.5, alignment=1)),
        Paragraph("<b>Código de<br/>retenção</b>", ParagraphStyle('HCenter', fontName='Helvetica-Bold', fontSize=7.5, alignment=1)),
        Paragraph("<b>Descrição do rendimento</b>", ParagraphStyle('HLeft', fontName='Helvetica-Bold', fontSize=7.5)),
        Paragraph("<b>Rendimento<br/>(R$)</b>", ParagraphStyle('HRight', fontName='Helvetica-Bold', fontSize=7.5, alignment=2)),
        Paragraph("<b>Imposto retido<br/>(R$)</b>", ParagraphStyle('HRight', fontName='Helvetica-Bold', fontSize=7.5, alignment=2))
    ]

    q3_rows = [q3_header]

    for m in company_data['meses']:
        rend_txt = format_brl(m['rendimento'])
        irrf_txt = format_brl(m['irrf'])
        q3_rows.append([
            Paragraph(m['mes_nome'], ParagraphStyle('TCenter', fontName='Helvetica', fontSize=7, alignment=1)),
            Paragraph(m['codigo'], ParagraphStyle('TCenter', fontName='Helvetica', fontSize=7, alignment=1)),
            Paragraph(m['descricao'], ParagraphStyle('TLeft', fontName='Helvetica', fontSize=7)),
            Paragraph(rend_txt, ParagraphStyle('TRight', fontName='Helvetica', fontSize=7, alignment=2)),
            Paragraph(irrf_txt, ParagraphStyle('TRight', fontName='Helvetica', fontSize=7, alignment=2))
        ])

    # Linha Total
    total_rend_txt = format_brl(company_data['total_rendimento'])
    total_irrf_txt = format_brl(company_data['total_irrf'])
    q3_rows.append([
        Paragraph("<b>TOTAL</b>", ParagraphStyle('TCenter', fontName='Helvetica-Bold', fontSize=7.5, alignment=1)),
        Paragraph("-", ParagraphStyle('TCenter', fontName='Helvetica-Bold', fontSize=7.5, alignment=1)),
        Paragraph("-", ParagraphStyle('TCenter', fontName='Helvetica-Bold', fontSize=7.5, alignment=1)),
        Paragraph(f"<b>{total_rend_txt}</b>", ParagraphStyle('TRight', fontName='Helvetica-Bold', fontSize=7.5, alignment=2)),
        Paragraph(f"<b>{total_irrf_txt}</b>", ParagraphStyle('TRight', fontName='Helvetica-Bold', fontSize=7.5, alignment=2))
    ])

    t_q3 = Table(q3_rows, colWidths=[14 * mm, 20 * mm, 88 * mm, 34 * mm, 30 * mm])
    t_q3.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f0f0')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f8f8f8')),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_q3)
    elements.append(Spacer(1, 3 * mm))

    # QUADRO 4: INFORMAÇÕES COMPLEMENTARES
    elements.append(Paragraph("<b>4. INFORMAÇÕES COMPLEMENTARES</b>", style_title_section))
    elements.append(Spacer(1, 1 * mm))
    q4_data = [[Paragraph(config.get('info_comp', ''), style_normal)]]
    t_q4 = Table(q4_data, colWidths=[186 * mm], rowHeights=[12 * mm])
    t_q4.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_q4)
    elements.append(Spacer(1, 3 * mm))

    # QUADRO 5: RESPONSÁVEL PELAS INFORMAÇÕES
    elements.append(Paragraph("<b>5. RESPONSÁVEL PELAS INFORMAÇÕES</b>", style_title_section))
    elements.append(Spacer(1, 1 * mm))
    
    q5_data = [
        [Paragraph("Nome", style_normal), Paragraph("Data", style_normal), Paragraph("Assinatura", style_normal)],
        [Paragraph(f"<b>{config['responsavel_nome'].upper()}</b>", style_bold), Paragraph(f"<b>{config['data_emissao']}</b>", style_bold), Paragraph("", style_normal)]
    ]
    t_q5 = Table(q5_data, colWidths=[100 * mm, 40 * mm, 46 * mm])
    t_q5.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_q5)
    elements.append(Spacer(1, 4 * mm))

    # RODAPÉ OFICIAL
    style_footer_center = ParagraphStyle('FootC', fontName='Helvetica', fontSize=7.5, leading=9.5, alignment=1)
    style_footer_bold = ParagraphStyle('FootB', fontName='Helvetica-Bold', fontSize=8, leading=10, alignment=1)
    style_footer_left = ParagraphStyle('FootL', fontName='Helvetica', fontSize=7, leading=8.5)

    footer_text = f"""
    Aprovado pela IN/SRF nº 119/2000<br/>
    <b>COMPROVANTE ANUAL DE RENDIMENTOS PAGOS OU CREDITADOS E DE RETENÇÃO DE<br/>
    IMPOSTO DE RENDA NA FONTE - PESSOA JURÍDICA</b><br/>
    Ano-calendário de {config['ano_calendario']}<br/>
    <b>MINISTÉRIO DA FAZENDA</b><br/>
    Secretaria Especial da Receita Federal do Brasil
    """
    elements.append(Paragraph(footer_text, style_footer_center))

    doc.build(elements)

def processar_planilha(arquivo_caminho, pasta_saida="informes_gerados"):
    print(f"\n📂 Lendo arquivo: {arquivo_caminho}")
    
    if arquivo_caminho.endswith('.csv'):
        df = pd.read_csv(arquivo_caminho)
    else:
        df = pd.read_excel(arquivo_caminho)

    print(f"📊 Total de registros encontrados: {len(df)}")
    print(f"📋 Colunas: {list(df.columns)}")

    def norm(txt):
        return re.sub(r'[\u0300-\u036f]', '', unicodedata.normalize('NFD', str(txt)).lower().strip())

    def choose_column(exact_names, contains=()):
        normalized = {c: norm(c) for c in df.columns}
        for name in exact_names:
            found = next((c for c, value in normalized.items() if value == name), None)
            if found is not None:
                return found
        return next((c for c, value in normalized.items() if any(k in value for k in contains)), None)

    col_cnpj = choose_column(('cnpj', 'cpf/cnpj'), ('inscricao',))
    col_razao = choose_column(('fornecedor', 'razao social', 'beneficiario'), ('nome', 'empresa', 'favorecido'))
    col_fonte_nome = next((c for c in df.columns if norm(c) == 'empresa'), None)
    col_fonte_cnpj = next((c for c in df.columns if norm(c) == 'empresa cnpj'), None)
    col_mes = choose_column(('mes', 'competencia', 'periodo'))
    col_data = choose_column(('dt pagamento nota', 'data pagamento', 'dt pagamento'), ('pagamento',))
    col_rend = choose_column(('valor bruto nota', 'valor pago nota', 'valor pago', 'rendimento pago'), ('rendimento', 'valor bruto'))
    col_cod = next((c for c in df.columns if any(k in norm(c) for k in ['codigo', 'cod', 'darf', 'receita'])), None)
    col_irrf = choose_column(('valor tributo', 'valor pago tributo', 'irrf'), ('ir retido', 'imposto retido', 'retido', 'retencao'))
    col_desc = next((c for c in df.columns if any(k in norm(c) for k in ['descricao', 'historico', 'servico', 'natureza'])), None)

    print(f"🔍 Mapeamento: CNPJ='{col_cnpj}', Razão='{col_razao}', Mês='{col_mes or col_data}', Rendimento='{col_rend}', IRRF='{col_irrf}'")

    def first_value(column, default):
        if column:
            for value in df[column]:
                if not pd.isna(value) and str(value).strip() and str(value).strip().lower() not in ('empresa', 'total'):
                    return str(value).strip()
        return default

    fonte_nome = first_value(col_fonte_nome, 'ASSOCIACAO MANTENEDORA CY LOG GUARULHOS')
    fonte_cnpj = first_value(col_fonte_cnpj, '58.936.490/0001-12')
    clean_fonte_cnpj = re.sub(r'\D', '', fonte_cnpj)
    if clean_fonte_cnpj and len(clean_fonte_cnpj) <= 14:
        clean_fonte_cnpj = clean_fonte_cnpj.zfill(14)
        fonte_cnpj = f'{clean_fonte_cnpj[:2]}.{clean_fonte_cnpj[2:5]}.{clean_fonte_cnpj[5:8]}/{clean_fonte_cnpj[8:12]}-{clean_fonte_cnpj[12:]}'

    date_years = pd.to_datetime(df[col_data], errors='coerce').dropna().dt.year if col_data else pd.Series(dtype='int64')
    ano_calendario = str(int(date_years.mode().iloc[0])) if not date_years.empty else '2025'

    config = {
        'fonte_pagadora_nome': fonte_nome,
        'fonte_pagadora_cnpj': fonte_cnpj,
        'ano_calendario': ano_calendario,
        'responsavel_nome': 'LUCIANO JOSE DA PAIXAO FIEL REIS',
        'data_emissao': '18/03/2026',
        'info_comp': ''
    }

    empresas = {}

    for _, row in df.iterrows():
        razao = str(row[col_razao] if col_razao else 'Fornecedor').strip()
        cnpj = str(row[col_cnpj] if col_cnpj else '00.000.000/0000-00').strip()
        
        if pd.isna(razao) or razao == '' or razao.lower() in ['nan', 'none', 'total', 'fornecedor', 'beneficiario']:
            continue
        if cnpj.lower() in ['nan', 'none', 'total', 'cnpj']:
            continue

        clean_cnpj = re.sub(r'\D', '', cnpj)
        if clean_cnpj and len(clean_cnpj) <= 14:
            clean_cnpj = clean_cnpj.zfill(14)
            cnpj_formatted = f"{clean_cnpj[:2]}.{clean_cnpj[2:5]}.{clean_cnpj[5:8]}/{clean_cnpj[8:12]}-{clean_cnpj[12:]}"
        else:
            cnpj_formatted = cnpj

        key = clean_cnpj or razao.lower()

        rend_val = parse_currency(row[col_rend] if col_rend else 0)
        irrf_val = parse_currency(row[col_irrf] if col_irrf else 0)

        if not clean_cnpj and rend_val == 0 and irrf_val == 0:
            continue

        if key not in empresas:
            empresas[key] = {
                'razao_social': razao,
                'cnpj': cnpj_formatted,
                'meses': [{
                    'mes_index': i,
                    'mes_nome': MONTH_NAMES[i],
                    'codigo': '1708',
                    'descricao': 'Remuneração de serviços profissionais prestados por Pessoa Jurídica',
                    'rendimento': 0.0,
                    'irrf': 0.0
                } for i in range(12)],
                'total_rendimento': 0.0,
                'total_irrf': 0.0
            }

        # Obter mês
        mes_val = None
        for cand in [col_mes, col_data, 'Dt Pagamento Nota', 'Dt Pagamento Tributo', 'Dt Emissão', 'Dt Emissão Nota']:
            if cand and cand in row and not pd.isna(row[cand]) and str(row[cand]).strip():
                mes_val = row[cand]
                break

        mes_idx, detected_year = parse_date_or_month(mes_val)
        if mes_idx < 0 or mes_idx > 11:
            continue

        cod_val = str(row[col_cod]).strip() if col_cod and not pd.isna(row[col_cod]) else '1708'
        desc_val = str(row[col_desc]).strip() if col_desc and not pd.isna(row[col_desc]) else 'Remuneração de serviços profissionais prestados por Pessoa Jurídica'

        m = empresas[key]['meses'][mes_idx]
        m['rendimento'] += rend_val
        m['irrf'] += irrf_val
        if cod_val and cod_val.lower() != 'nan':
            m['codigo'] = cod_val
        if desc_val and desc_val.lower() != 'nan':
            m['descricao'] = desc_val

        empresas[key]['total_rendimento'] += rend_val
        empresas[key]['total_irrf'] += irrf_val

    os.makedirs(pasta_saida, exist_ok=True)
    print(f"\n🚀 Gerando {len(empresas)} arquivos PDF em '{pasta_saida}'...")

    for i, (key, emp) in enumerate(empresas.items(), 1):
        nome_arquivo = f"Informe_IR_{config['ano_calendario']}_{i:02d}_{sanitize_filename(emp['razao_social'])}.pdf"
        caminho_pdf = os.path.join(pasta_saida, nome_arquivo)
        gerar_pdf_empresa(caminho_pdf, config, emp)
        print(f"  ✅ [{i}/{len(empresas)}] Gerado: {nome_arquivo} (Rendimento: {format_brl(emp['total_rendimento'])}, IRRF: {format_brl(emp['total_irrf'])})")

    print(f"\n✨ Sucesso absoluto! Todos os {len(empresas)} informes foram gerados na pasta '{pasta_saida}'.")

if __name__ == '__main__':
    arquivo = sys.argv[1] if len(sys.argv) > 1 else 'exemplo_relatorio_tributos.xlsx'
    processar_planilha(arquivo)
