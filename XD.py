import os
import re
import sys
import json
import math
import time
import unicodedata
import urllib.request
import urllib.parse
import urllib.error
from collections import Counter
from typing import List, Dict, Tuple, Any, Optional


class Colores:
    """Secuencias ANSI para dar formato legible a la interfaz de consola."""
    RESET = "\033[0m"
    NEGRITA = "\033[1m"
    CIAN = "\033[96m"
    VERDE = "\033[92m"
    AMARILLO = "\033[93m"
    ROJO = "\033[91m"
    MAGENTA = "\033[95m"
    GRIS = "\033[90m"


# Conjunto de palabras vacías (stopwords) en español que se filtran matemáticamente
STOPWORDS_ES = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "al", "del", "lo", "le", "les",
    "de", "en", "por", "para", "con", "sin", "sobre", "entre", "hacia", "hasta", "desde",
    "durante", "mediante", "tras", "ante", "bajo", "contra", "segun", "y", "e", "o", "u",
    "ni", "que", "quien", "cual", "como", "cuando", "donde", "cuanto", "porque", "pues",
    "si", "no", "mas", "pero", "sino", "aunque", "mientras", "es", "son", "fue", "fueron",
    "era", "eran", "ser", "esta", "estan", "estaba", "estar", "ha", "han", "habia", "haber",
    "hay", "tiene", "tienen", "tener", "hace", "hacer", "puede", "pueden", "poder", "se",
    "su", "sus", "mi", "mis", "tu", "tus", "nuestro", "nuestra", "este", "estos", "estas",
    "ese", "esa", "esos", "esas", "aquel", "aquella", "esto", "eso", "aquello", "todo",
    "toda", "todos", "todas", "otro", "otra", "otros", "otras", "mismo", "misma", "muy",
    "ya", "tambien", "solo", "tan", "tanto", "tanta", "cada", "algun", "alguno", "alguna",
    "ningun", "ninguno", "ninguna", "poco", "poca", "mucho", "mucha", "muchos", "muchas",
    "varios", "varias", "cualquier", "cualquiera", "dime", "explica", "explicame", "resumen",
    "busca", "buscar", "acerca", "sirve", "funciona", "significa", "consiste", "definicion"
}


def limpiar_pantalla() -> None:
    """Limpia la ventana de terminal en Windows, Linux o macOS."""
    os.system("cls" if os.name == "nt" else "clear")


def normalizar_palabra(palabra: str) -> str:
    """
    Elimina tildes, convierte a minúsculas y filtra caracteres no alfanuméricos
    para comparar raíces léxicas de forma determinista.
    """
    texto_sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", palabra.lower())
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9ñ]", "", texto_sin_tildes)


def contar_palabras(texto: str) -> int:
    """Cuenta el número exacto de palabras separadas por espacios en una cadena."""
    if not texto or not texto.strip():
        return 0
    return len(texto.strip().split())


def limpiar_consulta_busqueda(pregunta_usuario: str) -> Tuple[str, List[str]]:
    """
    Transforma una pregunta abierta (ej. '¿Qué es un agujero negro y cómo se forma?')
    en una consulta limpia de búsqueda ('agujero negro forma') usando reglas léxicas.
    """
    # Eliminar signos de interrogación, admiración y puntuación
    sin_signos = re.sub(r"[¿?¡!.,;:()\"'\[\]]", " ", pregunta_usuario).strip()
    palabras_brutas = sin_signos.split()

    palabras_clave = []
    terminos_normalizados = []

    for palabra in palabras_brutas:
        norm = normalizar_palabra(palabra)
        if len(norm) > 1 and norm not in STOPWORDS_ES:
            palabras_clave.append(palabra)
            terminos_normalizados.append(norm)

    # Si todas las palabras eran stopwords, conservar la frase sin signos
    consulta_limpia = " ".join(palabras_clave) if palabras_clave else sin_signos
    return consulta_limpia, terminos_normalizados


def realizar_peticion_json(url: str, timeout: int = 10) -> Dict[str, Any]:
    """
    Realiza una petición HTTP GET estándar con User-Agent identificable
    y devuelve la respuesta JSON decodificada sin requerir librerías externas.
    """
    cabeceras = {
        "User-Agent": "BuscadorAlgoritmicoPython/1.0 ( Proyecto Educativo Sin IA; Python-urllib )",
        "Accept": "application/json"
    }
    peticion = urllib.request.Request(url, headers=cabeceras)
    with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
        contenido = respuesta.read().decode("utf-8", errors="replace")
        return json.loads(contenido)


def buscar_en_internet_sin_ia(pregunta_usuario: str) -> Dict[str, Any]:
    """
    Busca en vivo en internet utilizando la API abierta de Wikipedia en español
    y DuckDuckGo Instant Answer como respaldo, devolviendo el texto documental.
    """
    consulta_limpia, terminos_norm = limpiar_consulta_busqueda(pregunta_usuario)
    if not consulta_limpia:
        raise ValueError("La consulta ingresada está vacía.")

    # 1. Buscar artículos relevantes en el índice web de Wikipedia en español
    parametros_busqueda = urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "srsearch": consulta_limpia,
        "utf8": "1",
        "format": "json",
        "srlimit": "3"
    })
    url_busqueda = f"https://es.wikipedia.org/w/api.php?{parametros_busqueda}"
    datos_busqueda = realizar_peticion_json(url_busqueda)

    resultados = datos_busqueda.get("query", {}).get("search", [])

    # Si no hay resultados con la consulta filtrada, intentar con la frase original sin signos
    if not resultados:
        frase_fallback = re.sub(r"[¿?¡!.,;:]", " ", pregunta_usuario).strip()
        parametros_busqueda = urllib.parse.urlencode({
            "action": "query",
            "list": "search",
            "srsearch": frase_fallback,
            "utf8": "1",
            "format": "json",
            "srlimit": "3"
        })
        datos_busqueda = realizar_peticion_json(f"https://es.wikipedia.org/w/api.php?{parametros_busqueda}")
        resultados = datos_busqueda.get("query", {}).get("search", [])

    if not resultados:
        raise LookupError(f"No se encontraron resultados en internet para: '{pregunta_usuario}'.")

    # 2. Descargar el contenido en texto plano del artículo principal
    titulo_principal = resultados[0]["title"]
    texto_extraido = descargar_extracto_wikipedia(titulo_principal)

    # Si el primer artículo es muy corto (ej. página de desambiguación), concatenar el 2do resultado
    if contar_palabras(texto_extraido) < 120 and len(resultados) > 1:
        segundo_titulo = resultados[1]["title"]
        segundo_texto = descargar_extracto_wikipedia(segundo_titulo)
        if segundo_texto:
            texto_extraido = f"{texto_extraido}\n\n{segundo_texto}"

    url_fuente = f"https://es.wikipedia.org/wiki/{urllib.parse.quote(titulo_principal.replace(' ', '_'))}"

    return {
        "titulo": titulo_principal,
        "texto_original": texto_extraido,
        "url_fuente": url_fuente,
        "consulta_limpia": consulta_limpia,
        "terminos_consulta": terminos_norm
    }


def descargar_extracto_wikipedia(titulo: str) -> str:
    """Descarga el cuerpo de texto limpio de un artículo específico mediante HTTP GET."""
    parametros_contenido = urllib.parse.urlencode({
        "action": "query",
        "prop": "extracts",
        "explaintext": "1",
        "titles": titulo,
        "format": "json"
    })
    url_contenido = f"https://es.wikipedia.org/w/api.php?{parametros_contenido}"
    datos_contenido = realizar_peticion_json(url_contenido)
    paginas = datos_contenido.get("query", {}).get("pages", {})

    for _, info_pagina in paginas.items():
        extracto = info_pagina.get("extract", "")
        if extracto:
            return extracto
    return ""


def dividir_en_oraciones(texto_bruto: str) -> List[str]:
    """
    Divide el documento descargado en oraciones individuales completas,
    eliminando encabezados de sección (== Sección ==) y fragmentos truncados.
    """
    # Eliminar encabezados tipo wiki y normalizar saltos de línea
    texto_limpio = re.sub(r"==+[^=]+==+", "\n", texto_bruto)
    texto_limpio = re.sub(r"\r\n", "\n", texto_limpio)
    texto_limpio = re.sub(r"\n{2,}", "\n", texto_limpio)

    # Proteger abreviaturas comunes para que no corten la oración por error
    abreviaturas = ["p. ej.", "ej.", "etc.", "dr.", "dra.", "sr.", "sra.", "aprox.", "a. c.", "d. c."]
    bloques = texto_limpio.split("\n")
    oraciones_finales: List[str] = []

    for bloque in bloques:
        linea = bloque.strip()
        if not linea:
            continue

        # Separar cuando hay un punto/signo seguido de espacio y letra mayúscula o número
        partes = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9\"«(])", linea)
        for parte in partes:
            oracion = re.sub(r"\s+", " ", parte).strip()
            num_palabras = contar_palabras(oracion)

            # Evitar títulos sueltos o frases incompletas demasiado cortas
            es_abreviatura = any(oracion.lower().endswith(abrev) for abrev in abreviaturas)
            if num_palabras >= 6 and oracion.endswith(".") and not es_abreviatura:
                oraciones_finales.append(oracion)

    return oraciones_finales


def resumir_sin_ia(
    texto_completo: str,
    terminos_consulta: List[str],
    limite_palabras: int = 380
) -> Dict[str, Any]:
    """
    ALGORITMO DETERMINISTA DE RESUMEN EXTRACTIVO (TF + LUHN + POSICIÓN):
    1. Calcula la matriz de Frecuencia de Términos (TF) de todo el texto.
    2. Puntúa cada oración según su densidad de palabras clave, coincidencia
       con la pregunta del usuario y posición estructural (apertura/definición).
    3. Selecciona las oraciones más relevantes garantizando estrictamente < 500 palabras.
    4. Reordena las oraciones elegidas según su orden de aparición original.
    """
    inicio_t = time.perf_counter()

    # Garantizar por código que el límite NUNCA alcance ni supere las 500 palabras
    limite_estricto = min(495, max(60, int(limite_palabras)))

    oraciones = dividir_en_oraciones(texto_completo)
    total_palabras_original = contar_palabras(texto_completo)

    if not oraciones:
        palabras_recorte = texto_completo.split()[:limite_estricto]
        texto_recorte = " ".join(palabras_recorte)
        return {
            "resumen": texto_recorte,
            "palabras_resumen": len(palabras_recorte),
            "palabras_original": total_palabras_original,
            "oraciones_seleccionadas": 1 if texto_recorte else 0,
            "oraciones_totales": 1,
            "top_terminos": [],
            "auditoria": [],
            "tiempo_ms": round((time.perf_counter() - inicio_t) * 1000, 2)
        }

    # PASO 1: Construir tabla de Frecuencia de Términos (TF)
    conteo_terminos: Counter = Counter()
    for oracion in oraciones:
        for palabra in oracion.split():
            norm = normalizar_palabra(palabra)
            if len(norm) > 3 and norm not in STOPWORDS_ES and not norm.isdigit():
                conteo_terminos[norm] += 1

    max_frecuencia = max(conteo_terminos.values()) if conteo_terminos else 1
    pesos_tf: Dict[str, float] = {
        termino: frec / max_frecuencia for termino, frec in conteo_terminos.items()
    }

    # Guardar los 10 términos con mayor peso matemático para mostrarlos en consola
    top_terminos = [
        {"termino": t, "apariciones": c, "peso_tf": round(c / max_frecuencia, 2)}
        for t, c in conteo_terminos.most_common(10)
    ]

    # PASO 2: Puntuar cada oración matemáticamente
    oraciones_puntuadas: List[Dict[str, Any]] = []
    conjunto_consulta = set(terminos_consulta)

    for indice, oracion in enumerate(oraciones):
        palabras_oracion = oracion.split()
        num_palabras = len(palabras_oracion)

        suma_tf = 0.0
        coincidencias_consulta = 0

        for p in palabras_oracion:
            norm = normalizar_palabra(p)
            suma_tf += pesos_tf.get(norm, 0.0)
            if norm in conjunto_consulta:
                coincidencias_consulta += 1

        # Densidad léxica suavizada para no premiar oraciones excesivamente largas
        densidad_tf = suma_tf / math.pow(num_palabras, 0.65)

        # Factor de relevancia respecto a la pregunta del usuario
        factor_consulta = 1.0 + min(coincidencias_consulta * 0.35, 1.4)

        # Factor de posición (las primeras oraciones contienen la definición principal)
        if indice == 0:
            factor_posicion = 2.45
        elif indice == 1:
            factor_posicion = 1.65
        elif indice < 5:
            factor_posicion = 1.30
        elif indice < 12:
            factor_posicion = 1.10
        else:
            factor_posicion = 1.00

        puntaje_final = round(densidad_tf * factor_consulta * factor_posicion, 4)

        oraciones_puntuadas.append({
            "indice": indice,
            "texto": oracion,
            "palabras": num_palabras,
            "puntaje": puntaje_final,
            "elegida": False
        })

    # PASO 3: Selección voraz (Greedy) respetando el tope estricto < 500 palabras
    ordenadas_por_puntaje = sorted(oraciones_puntuadas, key=lambda x: x["puntaje"], reverse=True)

    palabras_acumuladas = 0
    seleccionadas: List[Dict[str, Any]] = []

    for candidata in ordenadas_por_puntaje:
        if palabras_acumuladas + candidata["palabras"] <= limite_estricto:
            candidata["elegida"] = True
            seleccionadas.append(candidata)
            palabras_acumuladas += candidata["palabras"]

    # PASO 4: Ordenar las oraciones ganadoras por su orden cronológico original
    seleccionadas.sort(key=lambda x: x["indice"])

    # Agrupar en párrafos de hasta 3 oraciones para lectura fluida
    parrafos: List[str] = []
    for i in range(0, len(seleccionadas), 3):
        bloque = " ".join(o["texto"] for o in seleccionadas[i:i + 3])
        parrafos.append(bloque)

    resumen_final = "\n\n".join(parrafos)
    tiempo_ms = round((time.perf_counter() - inicio_t) * 1000, 2)

    return {
        "resumen": resumen_final,
        "palabras_resumen": palabras_acumuladas,
        "palabras_original": total_palabras_original,
        "oraciones_seleccionadas": len(seleccionadas),
        "oraciones_totales": len(oraciones),
        "top_terminos": top_terminos,
        "auditoria": ordenadas_por_puntaje[:10],
        "tiempo_ms": tiempo_ms
    }


def mostrar_resultado_en_consola(datos_web: Dict[str, Any], resultado_resumen: Dict[str, Any], limite: int) -> None:
    """Imprime en pantalla el resumen generado, las métricas matemáticas y la fuente."""
    borde = "=" * 72
    print(f"\n{Colores.CIAN}{Colores.NEGRITA}{borde}{Colores.RESET}")
    print(f"{Colores.VERDE}{Colores.NEGRITA} TEMA LOCALIZADO:{Colores.RESET} {Colores.NEGRITA}{datos_web['titulo'].upper()}{Colores.RESET}")
    print(f"{Colores.GRIS} Clave de búsqueda limpia: '{datos_web['consulta_limpia']}'{Colores.RESET}")
    print(f"{Colores.CIAN}{Colores.NEGRITA}{borde}{Colores.RESET}\n")

    # Cuerpo del resumen (< 500 palabras)
    print(resultado_resumen["resumen"])

    # Cálculo de reducción porcentual
    pal_orig = resultado_resumen["palabras_original"]
    pal_res = resultado_resumen["palabras_resumen"]
    reduccion = round((1 - (pal_res / pal_orig)) * 100, 1) if pal_orig > 0 else 0.0

    print(f"\n{Colores.CIAN}{'-' * 72}{Colores.RESET}")
    print(
        f"{Colores.VERDE}✔ Palabras del resumen:{Colores.RESET} {Colores.NEGRITA}{pal_res} / {limite} máx.{Colores.RESET} "
        f"(Garantizado < 500 palabras | 0% IA)"
    )
    print(
        f"{Colores.CIAN}• Artículo original:{Colores.RESET} {pal_orig} palabras "
        f"({resultado_resumen['oraciones_seleccionadas']}/{resultado_resumen['oraciones_totales']} oraciones elegidas | "
        f"Compresión: -{reduccion}%)"
    )
    print(f"{Colores.CIAN}• Tiempo de cálculo matemático:{Colores.RESET} {resultado_resumen['tiempo_ms']} ms")
    print(f"{Colores.CIAN}• Fuente directa:{Colores.RESET} {datos_web['url_fuente']}")

    # Mostrar las palabras clave con mayor frecuencia (TF)
    if resultado_resumen["top_terminos"]:
        terminos_str = ", ".join(
            f"{item['termino']} ({item['apariciones']})"
            for item in resultado_resumen["top_terminos"][:7]
        )
        print(f"{Colores.MAGENTA}• Raíces más frecuentes (TF):{Colores.RESET} {terminos_str}")
    print(f"{Colores.CIAN}{borde}{Colores.RESET}")


def guardar_resumen_txt(titulo: str, resumen: str, url: str, num_palabras: int) -> str:
    """Guarda el último resumen generado en un archivo de texto local."""
    nombre_seguro = re.sub(r"[^a-zA-Z0-9_-]", "_", normalizar_palabra(titulo))[:30] or "resumen"
    nombre_archivo = f"resumen_{nombre_seguro}.txt"
    with open(nombre_archivo, "w", encoding="utf-8") as archivo:
        archivo.write(f"RESUMEN ALGORÍTMICO (SIN IA): {titulo.upper()}\n")
        archivo.write(f"Fuente: {url}\n")
        archivo.write(f"Longitud: {num_palabras} palabras (< 500 palabras)\n")
        archivo.write("=" * 60 + "\n\n")
        archivo.write(resumen + "\n")
    return nombre_archivo


def ejecutar_programa_interactivo() -> None:
    """
    Bucle principal interactivo. También permite ejecución directa por argumentos
    de consola, por ejemplo: python proyecto_base.py "¿Qué es el protocolo TCP/IP?"
    """
    limite_palabras_usuario = 380  # Siempre menor a 500 palabras
    ultimo_resultado: Optional[Tuple[Dict[str, Any], Dict[str, Any]]] = None

    # Si el usuario pasó la pregunta directamente desde la terminal al ejecutar el script
    if len(sys.argv) > 1:
        pregunta_cli = " ".join(sys.argv[1:])
        try:
            print(f"{Colores.AMARILLO}Buscando en internet y resumiendo sin IA: '{pregunta_cli}'...{Colores.RESET}")
            datos_web = buscar_en_internet_sin_ia(pregunta_cli)
            res = resumir_sin_ia(datos_web["texto_original"], datos_web["terminos_consulta"], limite_palabras_usuario)
            mostrar_resultado_en_consola(datos_web, res, limite_palabras_usuario)
        except Exception as err:
            print(f"{Colores.ROJO}Error: {err}{Colores.RESET}")
        return

    while True:
        try:
            limpiar_pantalla()
            print(f"{Colores.CIAN}{Colores.NEGRITA}{'=' * 72}{Colores.RESET}")
            print(f"{Colores.NEGRITA}   BUSCADOR Y RESUMIDOR DE INTERNET EN PYTHON (100% SIN IA • < 500 PALABRAS){Colores.RESET}")
            print(f"{Colores.CIAN}{Colores.NEGRITA}{'=' * 72}{Colores.RESET}")
            print(f" Límite actual configurado: {Colores.VERDE}{limite_palabras_usuario} palabras{Colores.RESET} (Tope estricto: < 500)\n")
            print(f" {Colores.VERDE}[Escribe cualquier pregunta o tema]{Colores.RESET} para buscar en internet y resumirlo.")
            print(f" {Colores.AMARILLO}[L]{Colores.RESET} Cambiar límite de palabras (60 - 495)")
            if ultimo_resultado:
                print(f" {Colores.AMARILLO}[A]{Colores.RESET} Ver auditoría matemática de oraciones del último resumen")
                print(f" {Colores.AMARILLO}[G]{Colores.RESET} Guardar último resumen en un archivo .txt")
            print(f" {Colores.ROJO}[S]{Colores.RESET} Salir del programa\n")

            entrada = input(f"{Colores.CIAN}¿Qué quieres buscar hoy? > {Colores.RESET}").strip()

            if not entrada:
                continue

            comando = entrada.lower()

            if comando in ("s", "salir", "exit", "0"):
                print(f"\n{Colores.VERDE}Cerrando el buscador algorítmico. ¡Hasta pronto!{Colores.RESET}")
                break

            elif comando == "l":
                nuevo_str = input("Ingresa el nuevo límite máximo de palabras (60 a 495): ").strip()
                if nuevo_str.isdigit():
                    limite_palabras_usuario = min(495, max(60, int(nuevo_str)))
                    print(f"{Colores.VERDE}Límite actualizado a {limite_palabras_usuario} palabras.{Colores.RESET}")
                else:
                    print(f"{Colores.ROJO}Valor no válido. Se mantiene en {limite_palabras_usuario}.{Colores.RESET}")
                input(f"\n{Colores.GRIS}Presiona [Enter] para continuar...{Colores.RESET}")

            elif comando == "a" and ultimo_resultado:
                datos_w, res_r = ultimo_resultado
                print(f"\n{Colores.MAGENTA}{Colores.NEGRITA}--- TOP ORACIONES PUNTUADAS MATEMÁTICAMENTE ---{Colores.RESET}")
                for item in res_r["auditoria"]:
                    estado = f"{Colores.VERDE}[INCLUIDA]{Colores.RESET}" if item["elegida"] else f"{Colores.GRIS}[DESCARTADA]{Colores.RESET}"
                    print(f"• Oración #{item['indice'] + 1} | Score: {Colores.CIAN}{item['puntaje']}{Colores.RESET} | {item['palabras']} pal. {estado}")
                    print(f"  \"{item['texto'][:110]}...\"")
                input(f"\n{Colores.GRIS}Presiona [Enter] para volver...{Colores.RESET}")

            elif comando == "g" and ultimo_resultado:
                datos_w, res_r = ultimo_resultado
                ruta = guardar_resumen_txt(
                    datos_w["titulo"],
                    res_r["resumen"],
                    datos_w["url_fuente"],
                    res_r["palabras_resumen"]
                )
                print(f"\n{Colores.VERDE}✔ Resumen guardado exitosamente en: {ruta}{Colores.RESET}")
                input(f"\n{Colores.GRIS}Presiona [Enter] para volver...{Colores.RESET}")

            else:
                print(f"\n{Colores.AMARILLO}[1/2] Consultando internet mediante HTTP directo para: '{entrada}'...{Colores.RESET}")
                datos_web = buscar_en_internet_sin_ia(entrada)
                print(f"{Colores.AMARILLO}[2/2] Calculando matriz de frecuencias (TF) y extrayendo oraciones clave...{Colores.RESET}")
                resultado_resumen = resumir_sin_ia(
                    datos_web["texto_original"],
                    datos_web["terminos_consulta"],
                    limite_palabras_usuario
                )
                ultimo_resultado = (datos_web, resultado_resumen)
                mostrar_resultado_en_consola(datos_web, resultado_resumen, limite_palabras_usuario)
                input(f"\n{Colores.GRIS}Presiona [Enter] para hacer otra búsqueda o ver opciones...{Colores.RESET}")

        except LookupError as error_busqueda:
            print(f"\n{Colores.ROJO}[Sin coincidencias]: {error_busqueda}{Colores.RESET}")
            input(f"\n{Colores.GRIS}Presiona [Enter] para intentar con otros términos...{Colores.RESET}")
        except urllib.error.URLError as error_red:
            print(f"\n{Colores.ROJO}[Error de conexión a internet]: Verifica tu red ({error_red.reason}).{Colores.RESET}")
            input(f"\n{Colores.GRIS}Presiona [Enter] para continuar...{Colores.RESET}")
        except KeyboardInterrupt:
            print(f"\n\n{Colores.AMARILLO}Interrupción detectada. Cerrando el programa...{Colores.RESET}")
            break
        except Exception as error_general:
            print(f"\n{Colores.ROJO}[Error inesperado]: {error_general}{Colores.RESET}")
            input(f"\n{Colores.GRIS}Presiona [Enter] para continuar...{Colores.RESET}")


if __name__ == "__main__":
    ejecutar_programa_interactivo()