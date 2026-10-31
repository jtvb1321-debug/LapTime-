#!/usr/bin/env bash
# Monta a pasta de deploy do Grid Lap para a Discloud (raiz = projeto).
# Uso: deploy/discloud/montar-pacote.sh <pasta-saida> [commit|WORKTREE]
# Sem node_modules, .next, .env, .data nem logs; a versão do código é a do
# commit informado ou, por padrão, a da árvore de trabalho atual.
set -euo pipefail
SAIDA="${1:?informe a pasta de saida}"
ORIGEM="${2:-WORKTREE}"
RAIZ="$(git rev-parse --show-toplevel)"
AQUI="$RAIZ/deploy/discloud"

rm -rf "$SAIDA"; mkdir -p "$SAIDA"
if [ "$ORIGEM" = "WORKTREE" ]; then
  for d in app components lib public; do cp -r "$RAIZ/$d" "$SAIDA/$d"; done
  cp "$RAIZ"/{instrumentation.ts,package.json,package-lock.json,tsconfig.json,postcss.config.mjs,next.config.ts} "$SAIDA/"
else
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  git -C "$RAIZ" archive "$ORIGEM" | tar -x -C "$TMP"
  for d in app components lib public; do cp -r "$TMP/$d" "$SAIDA/$d"; done
  cp "$TMP"/{instrumentation.ts,package.json,package-lock.json,tsconfig.json,postcss.config.mjs,next.config.ts} "$SAIDA/"
fi
cp "$AQUI/start.js" "$AQUI/discloud.config" "$SAIDA/"

# next.config: build em dist/ e sem "standalone" (é só para Docker).
python - "$SAIDA" <<'PY'
import json, sys, pathlib
d = pathlib.Path(sys.argv[1])
c = d / "next.config.ts"; t = c.read_text(encoding="utf8")
t = t.replace('output: "standalone",', 'distDir: "dist",')
assert 'distDir: "dist"' in t
c.write_text(t, encoding="utf8")
p = d / "package.json"; j = json.loads(p.read_text(encoding="utf8"))
j["scripts"] = {"build": "next build", "start": "node start.js"}
p.write_text(json.dumps(j, indent=2), encoding="utf8")
PY
echo "Pacote montado em $SAIDA ($(du -sh "$SAIDA" | cut -f1))"
