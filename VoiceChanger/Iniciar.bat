@echo off
cd /d "%~dp0"
python -c "import sounddevice, scipy" 2>nul || python -m pip install sounddevice scipy
start "" pythonw voicechanger.py
