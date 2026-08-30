#!/usr/bin/env bash
# uniqlo_monitor.sh — 优衣库价格采集（跑在有 OpenCLI+登录淘宝的电脑上）
# 用法: ./uniqlo_monitor.sh [--limit 30]
# 依赖: opencli（含浏览器桥插件）+ 已登录淘宝的 Chrome
set -euo pipefail

LIMIT="${2:-30}"
KEYWORD="${1:-优衣库}"
DATA_DIR="$HOME/.uniqlo-monitor"
HIST="$DATA_DIR/history.jsonl"
SNAP="$DATA_DIR/latest.json"

mkdir -p "$DATA_DIR"

echo "==> 搜索淘宝: $KEYWORD (取 $LIMIT 件)"
RAW=$(opencli taobao search "$KEYWORD" --limit "$LIMIT" -f json)

# 提取核心字段，写入最新快照
echo "$RAW" | python3 - <<'PY' > "$SNAP"
import json, sys, time
items = json.load(sys.stdin)
out = []
for it in items if isinstance(items, list) else items.get("items", []):
    out.append({
        "id": str(it.get("id") or it.get("itemId") or it.get("url", "")),
        "title": it.get("title", ""),
        "price": it.get("price") or it.get("salePrice"),
        "shop": it.get("shop") or it.get("shopName", ""),
        "url": it.get("url") or it.get("itemUrl", ""),
        "ts": int(time.time()),
    })
json.dump(out, sys.stdout, ensure_ascii=False)
PY

COUNT=$(python3 -c "import json;print(len(json.load(open('$SNAP'))))")
echo "==> 拿到 $COUNT 件商品"

# 追加到历史（与上次对比，输出降价项）
python3 - <<PY
import json, os

snap = json.load(open("$SNAP"))
hist_path = "$HIST"

prev = {}
if os.path.exists(hist_path):
    with open(hist_path) as f:
        for line in f:
            try:
                rec = json.loads(line)
                prev[rec["id"]] = rec["price"]
            except Exception:
                pass

drops = []
with open(hist_path, "a") as f:
    for it in snap:
        if it["price"] is None:
            continue
        old = prev.get(it["id"])
        if old is not None and it["price"] is not None:
            try:
                if float(it["price"]) < float(old):
                    drops.append({"title": it["title"], "old": old, "new": it["price"], "url": it["url"]})
            except (TypeError, ValueError):
                pass
        f.write(json.dumps(it, ensure_ascii=False) + "\n")

print(f"==> 历史 {len(prev)} 条 -> 本次 {len(snap)} 条")
if drops:
    print("==> 🔔 发现降价 {len} 件:".format(len=len(drops)))
    for d in drops[:20]:
        print(f"    {d['title'][:40]}  {d['old']} -> {d['new']}  {d['url']}")
else:
    print("==> 无降价")
PY
