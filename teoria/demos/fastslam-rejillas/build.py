"""Genera fastslam-rejillas.html: la demo en un único archivo, sin dependencias locales.

Los módulos de js/ se concatenan en orden de dependencias dentro de un único
<script type="module">, quitando los import/export. El resultado se puede abrir
con doble clic (los módulos sueltos de index.html necesitan un servidor local).

Uso:  python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
MODULES = [
    "js/slam/random.js",
    "js/slam/world.js",
    "js/slam/laser.js",
    "js/slam/occupancy-grid.js",
    "js/slam/motion.js",
    "js/slam/observation-model.js",
    "js/slam/fastslam.js",
    "js/slam/loop-closure.js",
    "js/slam/route.js",
    "js/slam/simulation.js",
    "js/ui/history.js",
    "js/ui/render.js",
    "js/ui/main.js",
]

IMPORT = re.compile(r"^import\s[^;]*;\n", re.MULTILINE)


def bundle_scripts():
    parts = []
    for name in MODULES:
        code = (ROOT / name).read_text(encoding="utf-8")
        code = IMPORT.sub("", code)
        code = re.sub(r"^export\s+", "", code, flags=re.MULTILINE)
        parts.append(f"// ===== {name} =====\n{code.strip()}\n")
    return "\n".join(parts)


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "css/demo.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="css/demo.css">',
                        "<style>\n" + css + "</style>")
    html = html.replace('<script type="module" src="js/ui/main.js"></script>',
                        '<script type="module">\n' + bundle_scripts() + "</script>")
    (ROOT / "fastslam-rejillas.html").write_text(html, encoding="utf-8")
    print("fastslam-rejillas.html generado")


if __name__ == "__main__":
    main()
