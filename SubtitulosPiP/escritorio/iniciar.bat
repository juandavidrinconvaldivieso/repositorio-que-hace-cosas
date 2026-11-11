@echo off
rem Inicia «Subtítulos en el escritorio». La primera vez instala PySide6 (unos 200 MB).
cd /d "%~dp0"
python -c "import PySide6" 2>nul || (
  echo Instalando PySide6, espera un momento...
  python -m pip install --user PySide6 || (echo No se pudo instalar PySide6. & pause & exit /b 1)
)
start "" pythonw subtitulos_escritorio.py
echo Subtitulos en el escritorio esta activo.
echo Busca el icono rojo en la bandeja de Windows (junto al reloj, quiza dentro de la flecha ^).
timeout /t 5 >nul
