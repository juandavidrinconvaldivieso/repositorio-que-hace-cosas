import os
import sys
import streamlit.web.bootstrap as bootstrap

def resolve_path(relative_path):
    """Obtiene la ruta absoluta de los recursos temporales de PyInstaller."""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

if __name__ == '__main__':
    # Ruta absoluta hacia tu script real app.py
    script_path = resolve_path('Test_24.py')
    
    # Marcamos el flag interno para simular que fue invocado por la consola
    sys.argv = ["streamlit", "run", script_path, "--global.developmentMode=false"]
    
    # Forzamos el arranque del backend del servidor local
    bootstrap.run(script_path, "streamlit run", [], flag_options={})
