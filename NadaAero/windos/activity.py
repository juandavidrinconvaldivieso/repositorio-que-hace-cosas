"""Detecta la app que la persona tiene en primer plano (solo Windows) para mostrarla en su perfil."""
import ctypes
import os
import re
from ctypes import wintypes

KNOWN = {  # ejecutable -> (nombre, tipo)
    "code.exe": ("Visual Studio Code", "use"), "devenv.exe": ("Visual Studio", "use"), "pycharm64.exe": ("PyCharm", "use"),
    "chrome.exe": ("Google Chrome", "use"), "opera.exe": ("Opera", "use"), "msedge.exe": ("Microsoft Edge", "use"),
    "firefox.exe": ("Firefox", "use"), "brave.exe": ("Brave", "use"),
    "spotify.exe": ("Spotify", "listen"), "vlc.exe": ("VLC", "watch"), "wmplayer.exe": ("Windows Media Player", "watch"),
    "discord.exe": ("Discord", "use"), "whatsapp.exe": ("WhatsApp", "use"), "telegram.exe": ("Telegram", "use"),
    "steam.exe": ("Steam", "use"), "epicgameslauncher.exe": ("Epic Games", "use"),
    "minecraft.exe": ("Minecraft", "play"), "minecraftlauncher.exe": ("Minecraft Launcher", "use"),
    "robloxplayerbeta.exe": ("Roblox", "play"), "fortniteclient-win64-shipping.exe": ("Fortnite", "play"),
    "valorant-win64-shipping.exe": ("VALORANT", "play"), "leagueoflegends.exe": ("League of Legends", "play"),
    "gta5.exe": ("GTA V", "play"), "cs2.exe": ("Counter-Strike 2", "play"), "hollow_knight.exe": ("Hollow Knight", "play"),
    "blender.exe": ("Blender", "use"), "krita.exe": ("Krita", "use"), "photoshop.exe": ("Photoshop", "use"),
    "winword.exe": ("Word", "use"), "excel.exe": ("Excel", "use"), "powerpnt.exe": ("PowerPoint", "use"),
    "obs64.exe": ("OBS Studio", "use"), "notepad.exe": ("Bloc de notas", "use"), "baldi.exe": ("Baldi's Basics", "play"),
}
IGNORE = {"explorer.exe", "wind os messenger.exe", "python.exe", "pythonw.exe", "searchapp.exe", "searchhost.exe",
          "shellexperiencehost.exe", "applicationframehost.exe", "lockapp.exe", "startmenuexperiencehost.exe",
          "msedgewebview2.exe", "textinputhost.exe", "systemsettings.exe", "taskmgr.exe", "dwm.exe", "conhost.exe",
          "windowsterminal.exe", "powershell.exe", "cmd.exe"}

_user32 = ctypes.WinDLL("user32", use_last_error=True) if os.name == "nt" else None
_kernel32 = ctypes.WinDLL("kernel32", use_last_error=True) if os.name == "nt" else None


def _foreground():
    """(ejecutable en minúsculas, título de la ventana) de la ventana activa, o (None, None)."""
    if not _user32:
        return None, None
    hwnd = _user32.GetForegroundWindow()
    if not hwnd:
        return None, None
    buf = ctypes.create_unicode_buffer(300)
    _user32.GetWindowTextW(hwnd, buf, 300)
    title = buf.value
    pid = wintypes.DWORD()
    _user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    h = _kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return None, title
    try:
        size = wintypes.DWORD(600)
        path = ctypes.create_unicode_buffer(600)
        if not _kernel32.QueryFullProcessImageNameW(h, 0, path, ctypes.byref(size)):
            return None, title
        return os.path.basename(path.value).lower(), title
    finally:
        _kernel32.CloseHandle(h)


def current():
    """Devuelve {"app", "kind"} de lo que se está usando ahora, o None si no hay nada que mostrar."""
    exe, title = _foreground()
    if not exe or exe in IGNORE:
        return None
    if exe in ("javaw.exe", "java.exe") and title and "minecraft" in title.lower():
        return {"app": "Minecraft", "kind": "play"}
    if exe in KNOWN:
        name, kind = KNOWN[exe]
        return {"app": name, "kind": kind}
    # Desconocida: nombre del ejecutable, un poco más legible
    name = re.sub(r"[-_.]?(win64|x64|shipping|launcher)$", "", exe[:-4] if exe.endswith(".exe") else exe, flags=re.I)
    name = re.sub(r"[-_]+", " ", name).strip()
    return {"app": name[:1].upper() + name[1:40], "kind": "use"} if len(name) >= 2 else None
