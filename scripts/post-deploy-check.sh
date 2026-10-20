#!/usr/bin/env bash
# Kiểm tra nhanh sau triển khai: phần lệnh của SPEC mục 7.3 bước 1, cộng kiểm tra hạn đăng nhập Codex (G1-06, G1-07).
# Bước: healthz; models status --check; hạn token (expiresAt nhỏ nhất, giờ Việt Nam); channels status --probe.
# Cách dùng: bash scripts/post-deploy-check.sh
# Biến môi trường: OPENCLAW_DIR (mặc định ~/apps/openclaw), OPENCLAW_HEALTH_URL (mặc định http://127.0.0.1:28789/healthz).
# Thoát 0 nếu không có bước KHÔNG ĐẠT (CẢNH BÁO và BỎ QUA không tính); thoát 1 nếu có.
# Không in đầu ra thô của lệnh OpenClaw (có thể chứa email, mã, định danh): chỉ in kết luận từng bước và mã thoát.
# Lệnh OpenClaw chạy bằng `docker compose exec -T openclaw-gateway node dist/index.js` trong thư mục OPENCLAW_DIR.
# Chưa kiểm chứng với `-T`: `config get channels --json` và `channels status --probe` (chỉ `models status` đã kiểm chứng).
# Chưa kiểm chứng: đầu ra `channels status --probe` khi có kênh (docs không nêu mã thoát khi probe lỗi hoặc timeout).
set -uo pipefail

dir="${OPENCLAW_DIR:-$HOME/apps/openclaw}"
health_url="${OPENCLAW_HEALTH_URL:-http://127.0.0.1:28789/healthz}"
warn_days=3
fail_count=0
warn_count=0

[[ -f "$dir/docker-compose.yml" ]] || { echo "KHÔNG ĐẠT: không thấy $dir/docker-compose.yml" >&2; exit 1; }

# Chạy lệnh OpenClaw, gán đầu ra vào OC_OUT và mã thoát vào OC_RC. Lỗi chuẩn (stderr) bị bỏ.
oc() {
  OC_OUT="$(cd "$dir" && timeout 60 docker compose exec -T openclaw-gateway node dist/index.js "$@" 2>/dev/null </dev/null)"
  OC_RC=$?
}

report() { # $1 trạng thái, $2 tên bước, $3 ghi chú
  printf '[%s] %s: %s\n' "$1" "$2" "$3"
  case "$1" in
    "KHÔNG ĐẠT") fail_count=$((fail_count + 1)) ;;
    "CẢNH BÁO") warn_count=$((warn_count + 1)) ;;
  esac
}

# Bước 1: healthz (bỏ thân phản hồi).
if curl -fsS --max-time 10 -o /dev/null "$health_url" 2>/dev/null; then
  report "ĐẠT" "healthz" "$health_url trả lời"
else
  report "KHÔNG ĐẠT" "healthz" "không kết nối được hoặc lỗi: $health_url"
fi

# Bước 2: models status --check (docs /cli/models: 0 ổn; 2 credential sắp hết hạn; 1 thiếu, hết hạn hoặc lỗi).
oc models status --check
case "$OC_RC" in
  0) report "ĐẠT" "models status --check" "mã thoát 0" ;;
  2) report "CẢNH BÁO" "models status --check" "mã thoát 2: credential sắp hết hạn" ;;
  *) report "KHÔNG ĐẠT" "models status --check" "mã thoát $OC_RC (chạy tay để xem chi tiết)" ;;
esac

# Bước 3: hạn token. Lấy mọi khóa expiresAt (mili giây) trong models status --json, chọn giá trị nhỏ nhất.
oc models status --json
if [[ "$OC_RC" -ne 0 ]]; then
  report "KHÔNG ĐẠT" "hạn đăng nhập" "models status --json thoát $OC_RC (chạy tay để xem chi tiết)"
else
  verdict="$(printf '%s' "$OC_OUT" | WARN_DAYS="$warn_days" python3 -I -c '
import json, os, sys, time
from datetime import datetime, timedelta, timezone
text = sys.stdin.read()
start = text.find("{")
if start < 0:
    print("FAIL|không đọc được JSON"); sys.exit()
try:
    data, _ = json.JSONDecoder().raw_decode(text[start:])
except ValueError:
    print("FAIL|không đọc được JSON"); sys.exit()
vals = []
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == "expiresAt" and isinstance(v, (int, float)) and not isinstance(v, bool):
                vals.append(v)
            else:
                walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)
walk(data)
if not vals:
    print("FAIL|không thấy expiresAt trong kết quả"); sys.exit()
low = min(vals)
vn = timezone(timedelta(hours=7))
when = datetime.fromtimestamp(low / 1000, vn).strftime("%d/%m/%Y %H:%M")
days = (low - time.time() * 1000) / 86400000
if days <= 0:
    print("FAIL|đã hết hạn lúc %s" % when)
elif days < float(os.environ["WARN_DAYS"]):
    print("WARN|hết hạn lúc %s, còn %.1f ngày" % (when, days))
else:
    print("OK|hết hạn lúc %s, còn %.1f ngày" % (when, days))
' 2>/dev/null)"
  case "${verdict%%|*}" in
    OK) report "ĐẠT" "hạn đăng nhập" "${verdict#*|}" ;;
    WARN) report "CẢNH BÁO" "hạn đăng nhập" "${verdict#*|} (dưới $warn_days ngày: đăng nhập lại, xem deploy/README.md)" ;;
    *) report "KHÔNG ĐẠT" "hạn đăng nhập" "${verdict#*|}" ;;
  esac
fi

# Bước 4: kênh. Xác định "chưa có kênh" bằng config get channels --json (bản đã che bí mật), chỉ đếm khóa, không in nội dung.
oc config get channels --json
chan_rc="$OC_RC"
chan_state="$(printf '%s' "$OC_OUT" | RC="$chan_rc" python3 -I -c '
import json, os, sys
text = sys.stdin.read().strip()
start = text.find("{")
data = None
if start >= 0:
    try:
        data, _ = json.JSONDecoder().raw_decode(text[start:])
    except ValueError:
        print("UNKNOWN"); sys.exit()
# Quan sát 18/10/2026: chưa có kênh thì lệnh thoát 1 kèm {"ok": false, "error": {"message": "Config path is valid but unset: channels. ..."}}
if isinstance(data, dict) and data.get("ok") is False:
    msg = str((data.get("error") or {}).get("message", ""))
    print("NONE" if "valid but unset" in msg else "UNKNOWN"); sys.exit()
if os.environ["RC"] != "0":
    print("UNKNOWN"); sys.exit()
if text in ("null", "{}"):
    print("NONE"); sys.exit()
print("SOME" if isinstance(data, dict) and data else "UNKNOWN")
' 2>/dev/null)"
case "$chan_state" in
  NONE) report "BỎ QUA" "channels status --probe" "chưa có kênh nào cấu hình (config get channels: đường dẫn hợp lệ nhưng chưa đặt)" ;;
  SOME)
    oc channels status --probe
    if [[ "$OC_RC" -eq 0 ]]; then
      report "ĐẠT" "channels status --probe" "mã thoát 0 (chỉ kiểm mã thoát, chưa kiểm từng kênh)"
    else
      report "KHÔNG ĐẠT" "channels status --probe" "mã thoát $OC_RC (chạy tay để xem chi tiết)"
    fi
    ;;
  *) report "KHÔNG ĐẠT" "channels status --probe" "không xác định được kênh đã cấu hình (config get channels thoát $chan_rc; chạy tay để xem)" ;;
esac

echo "----"
if [[ "$fail_count" -gt 0 ]]; then
  echo "KẾT LUẬN: KHÔNG ĐẠT ($fail_count bước không đạt, $warn_count cảnh báo). Quay lui theo PLAN.md mục 6, không sửa nóng."
  exit 1
fi
echo "KẾT LUẬN: ĐẠT ($warn_count cảnh báo)."
exit 0
