"""
Renderiza a arte da Pipoca (capivara) em PNG.

A geometria abaixo e a mesma do assets/pipoca.svg. O desenho e feito em
4x e reduzido com LANCZOS, o que da bordas suaves sem precisar de
anti-aliasing manual.

Uso:
    python scripts/make-avatar.py

Saida: assets/pipoca.png (1024x1024, recorte circular)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- configuracao
SIZE = 1024          # tamanho final
SS = 4               # supersampling
W = SIZE * SS        # canvas de trabalho

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "pipoca.png"
OUT_CIRCLE = ROOT / "assets" / "pipoca-circular.png"

# Paleta (mesma de persona.js -> avatar.palette)
CREME_CLARO = (247, 241, 227)
CREME_ESCURO = (241, 231, 211)
SOMBRA = (228, 214, 188)
MARROM = (138, 98, 64)
MARROM_CLARO = (150, 107, 74)
MARROM_ESCURO = (122, 85, 55)
MARROM_FOCINHO = (192, 152, 106)
CONTORNO = (94, 65, 40)
PRETO = (43, 43, 43)
BRANCO = (255, 255, 255)
AMARELO = (245, 200, 66)
AMARELO_ESCURO = (217, 168, 46)


def s(value):
    """Escala uma coordenada de 1x para o canvas de trabalho."""
    return int(round(value * SS))


def ellipse(draw, cx, cy, rx, ry, fill):
    draw.ellipse([s(cx - rx), s(cy - ry), s(cx + rx), s(cy + ry)], fill=fill)


def rotated_round_rect(size, radius, fill, angle):
    """Retangulo arredondado rotacionado em torno do proprio centro."""
    w, h = size
    pad = 4
    tile = Image.new("RGBA", (s(w) + pad * 2, s(h) + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(tile).rounded_rectangle(
        [pad, pad, pad + s(w), pad + s(h)], radius=s(radius), fill=fill
    )
    return tile.rotate(angle, resample=Image.BICUBIC, expand=True)


def line(draw, p1, p2, color, width):
    draw.line([s(p1[0]), s(p1[1]), s(p2[0]), s(p2[1])], fill=color, width=s(width))
    for x, y in (p1, p2):  # pontas arredondadas
        ellipse(draw, x, y, width / 2, width / 2, color)


def load_font(size):
    for name in ("segoeuib.ttf", "arialbd.ttf", "calibrib.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


# --------------------------------------------------------------------- desenho
def build():
    img = Image.new("RGBA", (W, W), CREME_CLARO + (255,))
    draw = ImageDraw.Draw(img)

    # fundo com leve gradiente vertical
    for y in range(W):
        t = y / W
        color = tuple(
            int(CREME_CLARO[i] + (CREME_ESCURO[i] - CREME_CLARO[i]) * t) for i in range(3)
        )
        draw.line([(0, y), (W, y)], fill=color + (255,))

    ellipse(draw, 512, 880, 360, 52, SOMBRA)          # sombra no chao
    ellipse(draw, 512, 676, 286, 222, MARROM)         # corpo
    ellipse(draw, 398, 852, 62, 34, MARROM_ESCURO)    # patinhas
    ellipse(draw, 626, 852, 62, 34, MARROM_ESCURO)

    for cx in (356, 668):                             # orelhas
        ellipse(draw, cx, 428, 40, 40, MARROM_ESCURO)
        ellipse(draw, cx, 428, 20, 20, CONTORNO)

    # cabeca larga e achatada (retangulo arredondado), topo em 372
    draw.rounded_rectangle(
        [s(302), s(372), s(722), s(726)], radius=s(165), fill=MARROM_CLARO
    )

    ellipse(draw, 512, 646, 128, 84, MARROM_FOCINHO)  # focinho
    ellipse(draw, 470, 632, 14, 10, (74, 53, 36))     # narinas
    ellipse(draw, 554, 632, 14, 10, (74, 53, 36))

    # sobrancelhas (alpha_composite invalida o draw anterior)
    left = rotated_round_rect((74, 11), 5, CONTORNO, 0)
    img.alpha_composite(left, (s(429) - left.width // 2, s(505) - left.height // 2))

    right = rotated_round_rect((74, 11), 5, CONTORNO, 13)
    img.alpha_composite(right, (s(595) - right.width // 2, s(486) - right.height // 2))

    # olhos sonolentos, bem espacados
    for cx in (428, 596):
        ellipse(draw, cx, 552, 19, 19, PRETO)
        ellipse(draw, cx + 7, 545, 7, 7, BRANCO)

    # sorriso de canto
    line(draw, (478, 688), (512, 700), (74, 53, 36), 12)
    line(draw, (512, 700), (552, 684), (74, 53, 36), 12)

    # pipocas (o apelido)
    for cx, cy, r in ((126, 186, 24), (172, 146, 19), (188, 204, 15),
                      (892, 170, 22), (934, 216, 15), (852, 222, 13)):
        ellipse(draw, cx, cy, r, r, AMARELO)
    for cx, cy, r in ((152, 170, 8), (914, 192, 7)):
        ellipse(draw, cx, cy, r, r, AMARELO_ESCURO)

    # assinatura discreta
    font = load_font(s(26))
    draw.text((s(968), s(972)), "pipoca", font=font, fill=CONTORNO + (140,), anchor="rs")

    final = img.resize((SIZE, SIZE), Image.LANCZOS)
    return final


def circular(image):
    """Mesma arte com recorte circular, ja pronta para foto de perfil."""
    out = image.copy()
    mask = Image.new("L", (image.width, image.height), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, image.width - 1, image.height - 1], fill=255)
    out.putalpha(mask)
    return out


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)

    image = build()
    image.save(OUT)
    print(f"gerado: {OUT} ({image.width}x{image.height})")

    # A foto de perfil do WhatsApp e recortada em circulo. O PNG com o
    # circulo ja embutido evita os cantos aparecerem no cache.
    circle = circular(image)
    circle.save(OUT_CIRCLE)
    print(f"gerado: {OUT_CIRCLE} (recorte circular)")
