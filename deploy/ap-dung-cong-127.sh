#!/usr/bin/env bash
# Thêm "127.0.0.1:" vào ba cổng Gateway, cầu nối, MS Teams trong docker-compose.yml của OpenClaw (D19).
# Chạy lại nhiều lần không sao. Không gọi lệnh Docker.
# Cách dùng: bash deploy/ap-dung-cong-127.sh [đường dẫn docker-compose.yml]
set -euo pipefail

compose_file="${1:-$HOME/apps/openclaw/docker-compose.yml}"

if [[ ! -f "$compose_file" ]]; then
  echo "Không thấy tệp: $compose_file" >&2
  exit 1
fi

# Lưu bản gốc một lần, trước khi sửa lần đầu.
if [[ ! -f "$compose_file.bak" ]]; then
  cp -p "$compose_file" "$compose_file.bak"
  echo "Đã lưu bản gốc: $compose_file.bak"
fi

# Chỉ sửa dòng bắt đầu bằng "${OPENCLAW_..._PORT"; dòng đã có 127.0.0.1: thì không khớp nên giữ nguyên.
sed -i -E 's/^([[:space:]]*- ")(\$\{OPENCLAW_(GATEWAY|BRIDGE|MSTEAMS)_PORT:-)/\1127.0.0.1:\2/' "$compose_file"

echo "Các dòng cổng hiện tại:"
grep -nE '\$\{OPENCLAW_(GATEWAY|BRIDGE|MSTEAMS)_PORT:-' "$compose_file" || true

if [[ "$(grep -cE '^[[:space:]]*- "127\.0\.0\.1:\$\{OPENCLAW_(GATEWAY|BRIDGE|MSTEAMS)_PORT:-' "$compose_file")" -ne 3 ]]; then
  echo "KHÔNG ĐẠT: không đủ 3 cổng gắn 127.0.0.1, kiểm tra tay tệp $compose_file" >&2
  exit 1
fi
echo "ĐẠT: cả 3 cổng chỉ mở trên 127.0.0.1"
