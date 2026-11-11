import os
import sys
import time
import struct
from datetime import datetime

# Librerías opcionales para metadatos profundos
try:
    from PIL import Image, ExifTags
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

try:
    from pypdf import PdfReader, PdfWriter
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    import mutagen
    from mutagen.easyid3 import EasyID3
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False


def formatear_fecha(timestamp):
    """Convierte un timestamp UNIX a formato legible."""
    return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')


def obtener_metadatos_sistema(ruta):
    """Extrae los metadatos básicos del sistema de archivos, incluyendo Fecha de Creación real."""
    stats = os.stat(ruta)
    
    # En Windows st_ctime es creación; en macOS/BSD existe st_birthtime
    if hasattr(stats, 'st_birthtime'):
        fecha_creacion = formatear_fecha(stats.st_birthtime)
    elif os.name == 'nt':
        fecha_creacion = formatear_fecha(stats.st_ctime)
    else:
        fecha_creacion = f"{formatear_fecha(stats.st_ctime)} (Cambio de metadatos / ctime)"

    return {
        "Nombre": os.path.basename(ruta),
        "Ruta absoluta": os.path.abspath(ruta),
        "Tamaño": f"{stats.st_size:,} bytes ({round(stats.st_size / 1024, 2)} KB)",
        "Fecha de creación": fecha_creacion,
        "Fecha de modificación": formatear_fecha(stats.st_mtime),
        "Último acceso": formatear_fecha(stats.st_atime),
        "UID Propietario": stats.st_uid
    }


def cambiar_fecha_creacion_windows(ruta, timestamp):
    """Cambia la fecha de creación real en Windows usando la API nativa kernel32."""
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
    
    FILE_WRITE_ATTRIBUTES = 0x0100
    OPEN_EXISTING = 3
    FILE_FLAG_BACKUP_SEMANTICS = 0x02000000

    handle = kernel32.CreateFileW(
        ruta, FILE_WRITE_ATTRIBUTES, 0, None, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, None
    )
    if handle == -1 or handle == 0xFFFFFFFF:
        raise ctypes.WinError(ctypes.get_last_error())

    # Conversión de época UNIX (1970) a época Windows FILETIME (1601) en intervalos de 100ns
    win_time = int((timestamp * 10000000) + 116444736000000000)
    low = win_time & 0xFFFFFFFF
    high = win_time >> 32

    class FILETIME(ctypes.Structure):
        _fields_ = [("dwLowDateTime", wintypes.DWORD),
                    ("dwHighDateTime", wintypes.DWORD)]

    ft_creacion = FILETIME(low, high)
    # Pasamos puntero solo al primer parámetro (Creación); Acceso y Modificación quedan en None
    res = kernel32.SetFileTime(handle, ctypes.byref(ft_creacion), None, None)
    kernel32.CloseHandle(handle)

    if not res:
        raise ctypes.WinError(ctypes.get_last_error())


def modificar_fechas_sistema(ruta):
    """Menú para modificar Fecha de Creación, Modificación o Acceso."""
    print("\n--- ¿Qué fecha del sistema deseas cambiar? ---")
    print("1. Fecha de Modificación y Acceso")
    print("2. Fecha de Creación (Soporte nativo en Windows / macOS)")
    print("3. Todas las fechas (Creación, Modificación y Acceso)")
    
    op = input("Selecciona una opción (1-3): ").strip()
    if op not in ["1", "2", "3"]:
        print("[!] Opción no válida.")
        return

    nueva_fecha_str = input("Ingresa la nueva fecha y hora (YYYY-MM-DD HH:MM:SS): ").strip()
    try:
        dt = datetime.strptime(nueva_fecha_str, '%Y-%m-%d %H:%M:%S')
        timestamp = time.mktime(dt.timetuple())

        if op in ["1", "3"]:
            stats = os.stat(ruta)
            os.utime(ruta, (timestamp, timestamp))
            print("[✓] Fecha de modificación y acceso actualizadas.")

        if op in ["2", "3"]:
            if os.name == 'nt':
                cambiar_fecha_creacion_windows(ruta, timestamp)
                print("[✓] Fecha de creación actualizada en Windows (vía kernel32).")
            elif sys.platform == 'darwin':
                # En macOS, si la nueva fecha es anterior a mtime, utime puede ajustar birthtime, o vía SetFile
                os.system(f'SetFile -d "{dt.strftime("%m/%d/%Y %H:%M:%S")}" "{ruta}"')
                print("[✓] Comando de actualización de fecha de creación ejecutado en macOS.")
            else:
                print("[i] En Linux, el kernel no permite alterar 'birthtime' directamente desde espacio de usuario sin modificar el reloj del sistema.")
    except ValueError:
        print("[!] Formato inválido. Usa YYYY-MM-DD HH:MM:SS (ej. 2026-10-25 14:30:00).")
    except Exception as e:
        print(f"[!] Error al cambiar la fecha: {e}")


# =====================================================================
# SOPORTE PARA AUDIO (FLAC, MP3, OGG, M4A, WAV) Y ARCHIVOS .FLC
# =====================================================================

def es_flac_por_cabecera(ruta):
    """Verifica si un archivo (como un .flc) es en realidad un audio FLAC mirando sus primeros 4 bytes."""
    try:
        with open(ruta, "rb") as f:
            return f.read(4) == b"fLaC"
    except Exception:
        return False


def obtener_metadatos_flc_animacion(ruta):
    """Lee la cabecera binaria de 128 bytes de una animación Autodesk FLIC (.flc / .fli)."""
    datos = {}
    try:
        with open(ruta, "rb") as f:
            header = f.read(128)
            if len(header) < 128:
                return {"Aviso": "Archivo demasiado pequeño para ser una cabecera FLIC estándar."}
            
            size, magic, frames, width, height, depth, flags, speed = struct.unpack("<IHHHHHHI", header[:20])
            if magic == 0xAF12:
                datos["Tipo de formato"] = "Animación Autodesk FLIC (.FLC)"
            elif magic == 0xAF11:
                datos["Tipo de formato"] = "Animación Autodesk FLI original (.FLI)"
            else:
                return {"Aviso": f"Cabecera FLIC no estándar (Magic: {hex(magic)})."}

            datos["Resolución"] = f"{width}x{height} píxeles"
            datos["Profundidad de color"] = f"{depth} bits"
            datos["Total de fotogramas (Frames)"] = frames
            datos["Velocidad (Delay entre frames)"] = f"{speed} ms"
            
            # Bytes 80-83 y 88-91 en .FLC guardan fecha de creación/actualización en formato MS-DOS
            creacion_dos, _, actualizacion_dos = struct.unpack("<III", header[80:92])
            datos["Marca interna MS-DOS (Creación)"] = hex(creacion_dos)
            datos["Marca interna MS-DOS (Actualización)"] = hex(actualizacion_dos)
    except Exception as e:
        datos["Error"] = f"Error al leer binario FLC: {e}"
    return datos


def modificar_metadatos_flc_animacion(ruta):
    """Permite modificar la velocidad de reproducción (Speed/Delay) o dimensiones en la cabecera .FLC."""
    print("\n--- Modificar cabecera binaria de animación FLC ---")
    print("1. Cambiar velocidad de reproducción (milisegundos entre fotogramas)")
    print("2. Cambiar dimensiones declaradas (Ancho x Alto)")
    op = input("Selecciona una opción (1-2): ").strip()

    try:
        with open(ruta, "r+b") as f:
            header = f.read(20)
            size, magic, frames, width, height, depth, flags, speed = struct.unpack("<IHHHHHHI", header)
            if magic not in (0xAF12, 0xAF11):
                print("[!] El archivo no tiene una cabecera FLIC válida para editar.")
                return

            if op == "1":
                nuevo_speed = int(input(f"Velocidad actual ({speed} ms). Nueva velocidad en ms: ").strip())
                f.seek(16)
                f.write(struct.pack("<I", nuevo_speed))
                print(f"[✓] Velocidad de animación actualizada a {nuevo_speed} ms.")
            elif op == "2":
                nuevo_w = int(input(f"Ancho actual ({width}). Nuevo ancho: ").strip())
                nuevo_h = int(input(f"Alto actual ({height}). Nuevo alto: ").strip())
                f.seek(8)
                f.write(struct.pack("<HH", nuevo_w, nuevo_h))
                print(f"[✓] Dimensiones actualizadas a {nuevo_w}x{nuevo_h}.")
            else:
                print("[!] Opción no válida.")
    except Exception as e:
        print(f"[!] Error al modificar binario FLC: {e}")


def obtener_metadatos_audio(ruta):
    """Extrae propiedades técnicas y etiquetas (Artista, Creador, Software, Álbum) de archivos de audio."""
    if not HAS_MUTAGEN:
        return {"Aviso": "Instala 'mutagen' (pip install mutagen) para leer etiquetas de audio y FLAC."}
    
    datos = {}
    try:
        audio = mutagen.File(ruta, easy=True)
        if audio is None:
            return {"Aviso": "Formato de audio no reconocido por mutagen."}
        
        # Propiedades técnicas (duración, frecuencia, canales, bitrate)
        if audio.info:
            duracion = round(getattr(audio.info, 'length', 0), 2)
            datos["Duración"] = f"{duracion} segundos ({round(duracion/60, 2)} min)"
            if hasattr(audio.info, 'sample_rate'):
                datos["Frecuencia de muestreo"] = f"{audio.info.sample_rate} Hz"
            if hasattr(audio.info, 'bitrate') and audio.info.bitrate:
                datos["Bitrate"] = f"{round(audio.info.bitrate / 1000)} kbps"
            if hasattr(audio.info, 'channels'):
                datos["Canales"] = audio.info.channels

        # Etiquetas (Tags: Vorbis Comments en FLAC/OGG, ID3 en MP3)
        if audio.tags:
            for clave, valor in audio.tags.items():
                val_str = ", ".join(valor) if isinstance(valor, list) else str(valor)
                datos[f"Tag [{clave}]"] = val_str
        else:
            datos["Etiquetas"] = "Sin etiquetas de metadatos registradas."
    except Exception as e:
        datos["Error"] = f"No se pudo leer el audio: {e}"
    return datos


def modificar_metadatos_audio(ruta):
    """Modifica etiquetas de audio (Artista/Creador, Título, Álbum, Fecha, Software/EncodedBy)."""
    if not HAS_MUTAGEN:
        print("[!] Necesitas instalar 'mutagen' (pip install mutagen) para editar audio.")
        return

    campos_audio = {
        "1": ("artist", "Artista / Creador"),
        "2": ("title", "Título de la pista"),
        "3": ("album", "Álbum"),
        "4": ("date", "Fecha / Año de lanzamiento"),
        "5": ("encodedby", "Software / Codificado por (Encoder)"),
        "6": ("genre", "Género")
    }
    print("\n--- Etiquetas de Audio (FLAC / MP3 / OGG) disponibles ---")
    for k, v in campos_audio.items():
        print(f"{k}. {v[1]} ({v[0]})")

    op = input("Selecciona el campo a modificar (1-6): ").strip()
    if op not in campos_audio:
        print("[!] Opción no válida.")
        return

    clave_tag, nombre_legible = campos_audio[op]
    nuevo_valor = input(f"Nuevo valor para {nombre_legible}: ").strip()

    try:
        audio = mutagen.File(ruta, easy=True)
        if audio is None:
            print("[!] No se pudo abrir el archivo como audio editable.")
            return
        if audio.tags is None:
            audio.add_tags()
        
        audio[clave_tag] = [nuevo_valor]
        audio.save()
        print(f"[✓] Etiqueta '{nombre_legible}' actualizada a '{nuevo_valor}'.")
    except Exception as e:
        print(f"[!] Error al guardar etiqueta en el archivo de audio: {e}")


# =====================================================================
# SOPORTE PARA PDF E IMÁGENES
# =====================================================================

def obtener_metadatos_pdf(ruta):
    if not HAS_PYPDF:
        return {"Aviso": "Instala 'pypdf' para ver metadatos internos de PDF."}
    datos = {}
    try:
        reader = PdfReader(ruta)
        if reader.metadata:
            for k, v in reader.metadata.items():
                datos[k.lstrip('/')] = str(v)
        else:
            datos["Info"] = "El PDF no contiene diccionario de metadatos."
    except Exception as e:
        datos["Error"] = f"Error al leer PDF: {e}"
    return datos


def modificar_metadatos_pdf(ruta):
    if not HAS_PYPDF:
        print("[!] Instala 'pypdf' para editar PDFs.")
        return
    campos = {
        "1": ("/Author", "Autor / Creador"),
        "2": ("/Creator", "Software de origen (Creator)"),
        "3": ("/Producer", "Software conversor (Producer)"),
        "4": ("/Title", "Título")
    }
    print("\n--- Propiedades de PDF ---")
    for k, v in campos.items():
        print(f"{k}. {v[1]}")
    op = input("Selecciona el campo (1-4): ").strip()
    if op not in campos:
        return
    clave_pdf = campos[op][0]
    nuevo_valor = input(f"Nuevo valor para {clave_pdf}: ").strip()
    try:
        reader = PdfReader(ruta)
        writer = PdfWriter()
        writer.append_pages_from_reader(reader)
        meta = {k: str(v) for k, v in (reader.metadata or {}).items()}
        meta[clave_pdf] = nuevo_valor
        writer.add_metadata(meta)
        with open(ruta, "wb") as f_out:
            writer.write(f_out)
        print(f"[✓] Propiedad '{clave_pdf}' actualizada.")
    except Exception as e:
        print(f"[!] Error al modificar PDF: {e}")


def obtener_metadatos_imagen(ruta):
    if not HAS_PILLOW:
        return {"Aviso": "Instala 'Pillow' para ver datos EXIF de imágenes."}
    datos = {}
    try:
        with Image.open(ruta) as img:
            datos["Formato"] = img.format
            datos["Dimensiones"] = f"{img.width}x{img.height}"
            exif = img.getexif()
            if exif:
                for tag_id, valor in exif.items():
                    if not isinstance(valor, bytes):
                        datos[str(ExifTags.TAGS.get(tag_id, tag_id))] = str(valor)
    except Exception as e:
        datos["Error"] = f"Error EXIF: {e}"
    return datos


def modificar_metadatos_imagen(ruta):
    if not HAS_PILLOW:
        print("[!] Instala 'Pillow' para editar imágenes.")
        return
    campos_exif = {
        "1": (315, "Artist (Creador)"),
        "2": (305, "Software"),
        "3": (270, "ImageDescription"),
        "4": (33432, "Copyright")
    }
    for k, v in campos_exif.items():
        print(f"{k}. {v[1]}")
    op = input("Selecciona el campo (1-4): ").strip()
    if op not in campos_exif:
        return
    tag_id, nombre = campos_exif[op]
    nuevo_valor = input(f"Nuevo valor para {nombre}: ").strip()
    try:
        with Image.open(ruta) as img:
            exif = img.getexif()
            exif[tag_id] = nuevo_valor
            img.save(ruta, exif=exif)
        print(f"[✓] Etiqueta '{nombre}' actualizada.")
    except Exception as e:
        print(f"[!] Error al guardar EXIF: {e}")


def renombrar_archivo(ruta):
    directorio = os.path.dirname(ruta)
    nuevo_nombre = input("Ingresa el nuevo nombre del archivo (con extensión): ").strip()
    if not nuevo_nombre:
        return ruta
    nueva_ruta = os.path.join(directorio, nuevo_nombre)
    try:
        os.rename(ruta, nueva_ruta)
        print(f"[✓] Archivo renombrado a: {nuevo_nombre}")
        return nueva_ruta
    except Exception as e:
        print(f"[!] Error al renombrar: {e}")
        return ruta


# =====================================================================
# MENÚ PRINCIPAL E INTERFAZ
# =====================================================================

EXTENSIONES_AUDIO = [".flac", ".mp3", ".ogg", ".wav", ".m4a"]
EXTENSIONES_IMAGEN = [".jpg", ".jpeg", ".tiff", ".png", ".webp"]


def menu_archivo(ruta):
    while True:
        if not os.path.exists(ruta):
            print("[!] El archivo ya no existe.")
            break

        ext = os.path.splitext(ruta)[1].lower()
        es_flc_audio = (ext == ".flc" and es_flac_por_cabecera(ruta))

        print("\n" + "=" * 60)
        print(f" ARCHIVO SELECCIONADO: {os.path.basename(ruta)}")
        print("=" * 60)

        print("\n[1] METADATOS DEL SISTEMA DE ARCHIVOS:")
        for k, v in obtener_metadatos_sistema(ruta).items():
            print(f"  • {k}: {v}")

        # Detección inteligente según formato
        if ext in EXTENSIONES_AUDIO or es_flc_audio:
            print("\n[2] METADATOS INTERNOS DE AUDIO (FLAC / ID3 / Vorbis):")
            for k, v in obtener_metadatos_audio(ruta).items():
                print(f"  • {k}: {v}")
        elif ext in [".flc", ".fli"]:
            print("\n[2] METADATOS INTERNOS DE ANIMACIÓN (.FLC / FLIC):")
            for k, v in obtener_metadatos_flc_animacion(ruta).items():
                print(f"  • {k}: {v}")
        elif ext == ".pdf":
            print("\n[2] METADATOS INTERNOS (PDF):")
            for k, v in obtener_metadatos_pdf(ruta).items():
                print(f"  • {k}: {v}")
        elif ext in EXTENSIONES_IMAGEN:
            print("\n[2] METADATOS INTERNOS (IMAGEN / EXIF):")
            for k, v in obtener_metadatos_imagen(ruta).items():
                print(f"  • {k}: {v}")

        print("\n--- ¿Qué propiedad deseas modificar? ---")
        print("1. Cambiar nombre del archivo")
        print("2. Cambiar fechas del archivo (Creación, Modificación o Acceso)")
        
        if ext in EXTENSIONES_AUDIO or es_flc_audio:
            print("3. Modificar etiquetas de Audio (Artista/Creador, Álbum, Título, Software)")
        elif ext in [".flc", ".fli"]:
            print("3. Modificar cabecera de animación .FLC (Velocidad / Resolución)")
        elif ext == ".pdf":
            print("3. Modificar Creador, Autor o Software (PDF)")
        elif ext in EXTENSIONES_IMAGEN:
            print("3. Modificar Creador (Artist), Software o Copyright (EXIF)")
        print("0. Volver a la lista de archivos")

        op = input("\nElige una opción: ").strip()
        if op == "1":
            ruta = renombrar_archivo(ruta)
        elif op == "2":
            modificar_fechas_sistema(ruta)
        elif op == "3":
            if ext in EXTENSIONES_AUDIO or es_flc_audio:
                modificar_metadatos_audio(ruta)
            elif ext in [".flc", ".fli"]:
                modificar_metadatos_flc_animacion(ruta)
            elif ext == ".pdf":
                modificar_metadatos_pdf(ruta)
            elif ext in EXTENSIONES_IMAGEN:
                modificar_metadatos_imagen(ruta)
        elif op == "0":
            break
        else:
            print("[!] Opción no válida.")


def main():
    directorio = input("Ingresa la ruta de la carpeta a escanear (Enter para carpeta actual): ").strip() or "."
    if not os.path.isdir(directorio):
        print("[!] Directorio no válido.")
        return

    while True:
        archivos = [f for f in os.listdir(directorio) if os.path.isfile(os.path.join(directorio, f))]
        print("\n=== ARCHIVOS DISPONIBLES ===")
        if not archivos:
            print("No hay archivos en este directorio.")
            break

        for idx, nombre in enumerate(archivos, 1):
            ruta_c = os.path.join(directorio, nombre)
            tam_kb = round(os.path.getsize(ruta_c) / 1024, 1)
            print(f"{idx}. {nombre} ({tam_kb} KB)")
        print("0. Salir")

        sel = input("\nSelecciona el número de archivo: ").strip()
        if sel == "0":
            break
        if sel.isdigit() and 1 <= int(sel) <= len(archivos):
            menu_archivo(os.path.join(directorio, archivos[int(sel) - 1]))
        else:
            print("[!] Selección inválida.")


if __name__ == "__main__":
    main()