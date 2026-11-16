#!/usr/bin/env python3
"""
build_single.py — Genera la versión de un solo archivo a partir de la modular.

    python3 build_single.py            ->  dwa_demo.html

Une css/styles.css y todos los módulos de js/ (en orden de dependencias) en un
único HTML. Los módulos se concatenan quitando las líneas `import` y la palabra
`export`, y todo queda dentro de una función para no crear variables globales.
Por eso los nombres de nivel superior de los módulos no deben repetirse.
"""

import re
from pathlib import Path

ROOT = Path(__file__).parent

# Orden de dependencias: cada módulo después de los que importa
MODULES = [
    'geometry.js', 'config.js', 'world.js', 'scenarios.js', 'robot.js', 'dwa.js',
    'colors.js', 'canvas-view.js', 'render-world.js', 'render-velocity.js',
    'panel.js', 'ui.js', 'main.js',
]

IMPORT_RE = re.compile(r'^import\s.*?;\s*$', re.MULTILINE)
EXPORT_RE = re.compile(r'^export\s+', re.MULTILINE)


def bundle_js():
    parts = []
    for name in MODULES:
        src = (ROOT / 'js' / name).read_text(encoding='utf-8')
        src = IMPORT_RE.sub('', src)
        src = EXPORT_RE.sub('', src)
        parts.append(f'/* ===== {name} ===== */\n{src.strip()}\n')
    return "(() => {\n'use strict';\n\n" + '\n'.join(parts) + '})();\n'


def build(out_name='dwa_demo.html'):
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css' / 'styles.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="css/styles.css">', f'<style>\n{css}</style>')
    html = html.replace('<script type="module" src="js/main.js"></script>',
                        f'<script>\n{bundle_js()}</script>')
    out = ROOT / out_name
    out.write_text(html, encoding='utf-8')
    print(f'Generado {out} ({out.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    build()
