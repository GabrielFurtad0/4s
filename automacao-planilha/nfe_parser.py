import os
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any, Optional

MESES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

def clean_tag(tag: str) -> str:
    """Remove namespace da tag XML se presente."""
    if '}' in tag:
        return tag.split('}', 1)[1]
    return tag

def parse_nfe_xml(filepath: str) -> Optional[Dict[str, Any]]:
    """
    Lê um arquivo XML de NF-e (padrão nacional SEFAZ) e extrai:
    - Número da Nota Fiscal
    - Data de Emissão (string formatada e objeto datetime)
    - Mês e Ano
    - Emitente e Destinatário
    - Status de autorização (cStat)
    - Lista de Produtos (código, descrição, quantidade, valor unitário, valor total)
    """
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Encontra o elemento infNFe independente de namespace
        inf_nfe = None
        for elem in root.iter():
            if clean_tag(elem.tag) == "infNFe":
                inf_nfe = elem
                break

        if inf_nfe is None:
            inf_nfe = root

        numero_nf = ""
        raw_date = ""
        data_obj = None
        data_emissao_str = ""
        mes_nome = ""
        ano = None
        emitente_nome = ""
        destinatario_nome = ""
        c_stat = "100"
        x_motivo = ""
        produtos = []

        # Localiza tags gerais
        for elem in root.iter():
            tag = clean_tag(elem.tag)
            if tag == "nNF" and not numero_nf:
                numero_nf = (elem.text or "").strip()
            elif tag in ("dhEmi", "dEmi") and not raw_date:
                raw_date = (elem.text or "").strip()
            elif tag == "xNome" and not emitente_nome:
                emitente_nome = (elem.text or "").strip()
            elif tag == "cStat" and c_stat == "100":
                c_stat = (elem.text or "").strip()
            elif tag == "xMotivo" and not x_motivo:
                x_motivo = (elem.text or "").strip()

        # Processa data
        if raw_date:
            try:
                date_part = raw_date[:10]
                dt = datetime.strptime(date_part, "%Y-%m-%d")
                data_obj = datetime(dt.year, dt.month, dt.day, 0, 0)
                data_emissao_str = dt.strftime("%d/%m/%Y")
                mes_nome = MESES_PT[dt.month - 1]
                ano = dt.year
            except Exception:
                data_emissao_str = raw_date

        # Destinatário
        for dest in inf_nfe.iter():
            if clean_tag(dest.tag) == "dest":
                for child in dest:
                    if clean_tag(child.tag) == "xNome":
                        destinatario_nome = (child.text or "").strip()
                        break

        # Itera sobre os blocos <det> de produtos
        for det in inf_nfe.iter():
            if clean_tag(det.tag) == "det":
                prod_elem = None
                for child in det:
                    if clean_tag(child.tag) == "prod":
                        prod_elem = child
                        break
                
                if prod_elem is not None:
                    c_prod = ""
                    x_prod = ""
                    q_com = 0.0
                    v_un_com = 0.0
                    v_prod = 0.0

                    for p_child in prod_elem:
                        p_tag = clean_tag(p_child.tag)
                        val = (p_child.text or "").strip()
                        if p_tag == "cProd":
                            c_prod = val
                        elif p_tag == "xProd":
                            x_prod = val
                        elif p_tag == "qCom":
                            try:
                                q_com = float(val.replace(",", "."))
                            except ValueError:
                                q_com = 0.0
                        elif p_tag == "vUnCom":
                            try:
                                v_un_com = float(val.replace(",", "."))
                            except ValueError:
                                v_un_com = 0.0
                        elif p_tag == "vProd":
                            try:
                                v_prod = float(val.replace(",", "."))
                            except ValueError:
                                v_prod = 0.0

                    if x_prod:
                        produtos.append({
                            "codigo": c_prod,
                            "descricao": x_prod,
                            "quantidade": q_com,
                            "valor_unitario": v_un_com,
                            "valor_total": v_prod
                        })

        if not numero_nf and not produtos:
            return None

        try:
            numero_nf_formatado = str(int(numero_nf))
        except ValueError:
            numero_nf_formatado = numero_nf

        return {
            "arquivo": os.path.basename(filepath),
            "caminho_completo": filepath,
            "tipo_arquivo": "XML",
            "numero_nf": numero_nf_formatado,
            "data_obj": data_obj,
            "data_emissao": data_emissao_str,
            "mes_nome": mes_nome,
            "ano": ano,
            "emitente": emitente_nome,
            "destinatario": destinatario_nome,
            "c_stat": c_stat,
            "motivo_status": x_motivo,
            "produtos": produtos
        }
    except Exception as e:
        return {
            "arquivo": os.path.basename(filepath),
            "caminho_completo": filepath,
            "erro": f"Erro ao ler XML: {str(e)}"
        }
