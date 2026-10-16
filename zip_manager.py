import os
import glob
import json
import zipfile
from datetime import datetime
from typing import List, Dict, Any, Tuple

HISTORICO_PADRAO = os.path.join("backups", "zips_processados.json")

def carregar_historico(caminho_historico: str = HISTORICO_PADRAO) -> Dict[str, Any]:
    """Carrega o histórico de arquivos ZIP já processados."""
    if os.path.exists(caminho_historico):
        try:
            with open(caminho_historico, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def salvar_historico(historico: Dict[str, Any], caminho_historico: str = HISTORICO_PADRAO):
    """Salva o histórico de arquivos ZIP processados."""
    os.makedirs(os.path.dirname(caminho_historico), exist_ok=True)
    with open(caminho_historico, "w", encoding="utf-8") as f:
        json.dump(historico, f, indent=2, ensure_ascii=False)

def buscar_arquivos_zip(pastas: List[str]) -> List[str]:
    """Busca todos os arquivos .zip nas pastas especificadas (sem duplicatas)."""
    arquivos = []
    for pasta in pastas:
        if not os.path.exists(pasta):
            continue
        padroes = [
            os.path.join(pasta, "*.zip"),
            os.path.join(pasta, "*.ZIP")
        ]
        for p in padroes:
            arquivos.extend(glob.glob(p))
    return sorted(list(dict.fromkeys(arquivos)))

def verificar_e_extrair_zips(
    pastas_busca: List[str],
    pasta_destino: str = "notas",
    caminho_historico: str = HISTORICO_PADRAO
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Verifica se existem novos arquivos ZIP nas pastas de busca.
    Se houver, extrai os arquivos XML e PDF para a pasta_destino.
    
    Retorna:
    - zips_extraidos: lista de dicts com info de cada zip que foi extraído agora.
    - arquivos_novos: lista de caminhos dos arquivos recém-extraídos.
    """
    os.makedirs(pasta_destino, exist_ok=True)
    historico = carregar_historico(caminho_historico)
    zips_encontrados = buscar_arquivos_zip(pastas_busca)

    zips_extraidos = []
    arquivos_novos = []

    for z_path in zips_encontrados:
        nome_arq = os.path.basename(z_path)
        try:
            tamanho = os.path.getsize(z_path)
            mtime = os.path.getmtime(z_path)
        except OSError:
            continue

        # Verifica se já foi extraído com o mesmo tamanho e data de modificação
        registro = historico.get(nome_arq)
        if registro and registro.get("tamanho") == tamanho and registro.get("mtime") == mtime:
            continue

        # É um novo ZIP ou foi alterado
        arquivos_deste_zip = []
        try:
            with zipfile.ZipFile(z_path, "r") as z:
                # Extrai apenas arquivos relevantes (XML e PDF) ou todos
                for item in z.infolist():
                    if item.is_dir():
                        continue
                    ext = os.path.splitext(item.filename)[1].lower()
                    if ext in [".xml", ".pdf"]:
                        # Extrai para a pasta destino
                        destino_final = z.extract(item, pasta_destino)
                        arquivos_deste_zip.append(destino_final)
                        arquivos_novos.append(destino_final)
                    elif not ext:
                        # Arquivo sem extensão (caso raro)
                        pass

            historico[nome_arq] = {
                "caminho": z_path,
                "tamanho": tamanho,
                "mtime": mtime,
                "data_extracao": datetime.now().isoformat(),
                "total_extraidos": len(arquivos_deste_zip)
            }
            zips_extraidos.append({
                "arquivo": nome_arq,
                "caminho": z_path,
                "total_arquivos": len(arquivos_deste_zip)
            })
        except Exception as e:
            # Em caso de erro na leitura do zip
            zips_extraidos.append({
                "arquivo": nome_arq,
                "caminho": z_path,
                "erro": str(e)
            })

    if zips_extraidos:
        salvar_historico(historico, caminho_historico)

    return zips_extraidos, arquivos_novos
