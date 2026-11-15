#!/usr/bin/env bash
# Dọn tệp gốc văn bản Gateway đã lưu ở ~/.openclaw/workspace/media/inbound (G2C-03, D43).
# Mặc định CHỈ LIỆT KÊ thư mục openclaw-staged-* quá N ngày (mặc định 14). Chỉ xóa khi có cờ --xoa.
# Cách dùng: bash scripts/don-media-inbound.sh [--ngay N] [--xoa]
# Biến môi trường: INBOUND_DIR. Chỉ động tới thư mục con tên openclaw-staged-<uuid>; không đi theo liên kết tượng trưng.
# Không có chế độ tự chạy: không đưa vào cron. Tệp đã tải lên Drive thì bản trên Drive vẫn còn.
set -uo pipefail

inbound="${INBOUND_DIR:-$HOME/.openclaw/workspace/media/inbound}"
days=14
delete=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ngay) days="${2:-}"; shift 2 ;;
    --xoa) delete=1; shift ;;
    *) echo "Cách dùng: $0 [--ngay N] [--xoa]" >&2; exit 2 ;;
  esac
done
[[ "$days" =~ ^[0-9]+$ ]] || { echo "KHÔNG ĐẠT: --ngay phải là số nguyên" >&2; exit 2; }
[[ -d "$inbound" ]] || { echo "KHÔNG ĐẠT: không thấy $inbound" >&2; exit 1; }

mapfile -t found < <(find "$inbound" -mindepth 1 -maxdepth 1 -type d -name 'openclaw-staged-*' ! -type l -mmin +"$((days * 1440))" | sort)
if [[ "${#found[@]}" -eq 0 ]]; then
  echo "Không có thư mục nào quá $days ngày."
  exit 0
fi

total_kb=0
for d in "${found[@]}"; do
  kb="$(du -sk "$d" | cut -f1)"
  total_kb=$((total_kb + kb))
  printf '%s  %s KB  %s\n' "$(date -r "$d" '+%d/%m/%Y %H:%M')" "$kb" "$(basename "$d")"
done
echo "Tổng: ${#found[@]} thư mục, $total_kb KB, quá $days ngày."

if [[ "$delete" -eq 0 ]]; then
  echo "Chỉ liệt kê. Muốn xóa: thêm cờ --xoa (sẽ hỏi xác nhận)."
  exit 0
fi
read -r -p "Xóa ${#found[@]} thư mục trên? Gõ XOA để xác nhận: " answer
[[ "$answer" == "XOA" ]] || { echo "Đã hủy, chưa xóa gì."; exit 1; }
for d in "${found[@]}"; do
  rm -rf -- "$d" && echo "đã xóa $(basename "$d")"
done
