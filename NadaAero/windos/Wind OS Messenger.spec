# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['windos.py'],
    pathex=[],
    binaries=[],
    datas=[('main.html', '.'), ('toast.html', '.'), ('aero.css', '.'), ('skins.css', '.'), ('mobile.css', '.'), ('common.js', '.'), ('retro.js', '.'), ('bots.js', '.'), ('player.js', '.'), ('media.js', '.'), ('calls.js', '.'), ('forums.js', '.'), ('home.js', '.'), ('shorts.js', '.'), ('auth.js', '.'), ('wm.js', '.'), ('app.js', '.'), ('webshim.js', '.'), ('i18n.js', '.')],
    hiddenimports=['websrv', 'activity'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Wind OS Messenger',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version='D:/DATOS/Documents/New Folder/NadaAero/windos/build/version_info.txt',
    icon=['windos.ico'],
)
