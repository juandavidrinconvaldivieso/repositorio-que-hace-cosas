"""Genera messenger.ico: un orbe brillante estilo Aero."""
from PIL import Image, ImageDraw, ImageFilter

S = 256
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# Orbe con degradado radial azul
orb = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(orb)
for r in range(118, 0, -1):
    t = r / 118
    col = (int(20 + 140 * (1 - t)), int(140 + 110 * (1 - t)), int(40 + 120 * (1 - t)), 255)
    d.ellipse((128 - r, 128 - r, 128 + r, 128 + r), fill=col)
d.ellipse((10, 10, 246, 246), outline=(15, 80, 30, 255), width=4)
img.alpha_composite(orb)

# Brillo superior
gloss = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(gloss).ellipse((44, 22, 212, 128), fill=(255, 255, 255, 170))
img.alpha_composite(gloss.filter(ImageFilter.GaussianBlur(6)))

img.save("messenger.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

