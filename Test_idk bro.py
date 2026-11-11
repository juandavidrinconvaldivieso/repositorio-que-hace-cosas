import win32print

# Conectar con la impresora Epson L32150
printer_name = win32print.GetDefaultPrinter()
hPrinter = win32print.OpenPrinter(printer_name)

# Configuración para centrar en hoja Carta/A4 (80 columnas x 60 filas aproximadamente)
ANCHO_PAGINA = 80
SALTOS_VERTICALES = 28  # Lleva el texto aproximadamente a la mitad de la hoja

texto_original = "Hola, este es un texto centrado desde Python."

# 1. Centrado Horizontal: Rellena con espacios a la izquierda y derecha
texto_centrado = texto_original.center(ANCHO_PAGINA)

# 2. Centrado Vertical + Comando de expulsión:
# Ponemos los saltos de línea iniciales, luego el texto y al final '\x0c' (Form Feed)
# El carácter '\x0c' le dice a la Epson "terminé la página, escupe el papel"
contenido_final = "\n" * SALTOS_VERTICALES + texto_centrado + "\n\x0c"

try:
    # Iniciamos el trabajo de impresión enviando los datos crudos (RAW)
    hJob = win32print.StartDocPrinter(hPrinter, 1, ("Texto Centrado Epson", None, "RAW"))
    win32print.StartPagePrinter(hPrinter)
    
    # Enviamos los datos codificados en bytes
    win32print.WritePrinter(hPrinter, contenido_final.encode("utf-8"))
    
    win32print.EndPagePrinter(hPrinter)
    win32print.EndDocPrinter(hPrinter)
    print("¡Impresión enviada! Tu Epson L32150 centrará el texto y expulsará el papel.")

finally:
    # Cerramos el proceso siempre
    win32print.ClosePrinter(hPrinter)
