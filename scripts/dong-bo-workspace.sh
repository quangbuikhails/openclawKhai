#!/usr/bin/env bash
# Chép một chiều SOUL.md, AGENTS.md và skills/ từ openclaw-workspace/ trong repo sang workspace của OpenClaw (PLAN.md D20).
# Không chạm USER.md, IDENTITY.md, BOOTSTRAP.md, MEMORY.md, memory/, .git/ và mọi tệp khác trong workspace.
# Cách dùng: bash scripts/dong-bo-workspace.sh [--dry-run] [--dest <thư mục workspace>]
# Đích mặc định: $OPENCLAW_WORKSPACE_DIR, không có thì ~/.openclaw/workspace.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$repo_root/openclaw-workspace"
dest="${OPENCLAW_WORKSPACE_DIR:-$HOME/.openclaw/workspace}"
dry_run=0

# Ngưỡng nạp bootstrap mặc định theo tài liệu OpenClaw (chưa kiểm chứng trên bản đang dùng).
max_file_chars=20000
max_total_chars=60000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --dest)
      [[ $# -ge 2 ]] || { echo "Thiếu giá trị cho --dest" >&2; exit 1; }
      dest="$2"; shift 2 ;;
    *) echo "Tham số không hợp lệ: $1" >&2; exit 1 ;;
  esac
done

for f in SOUL.md AGENTS.md; do
  [[ -f "$src/$f" ]] || { echo "KHÔNG ĐẠT: thiếu $src/$f" >&2; exit 1; }
done
[[ -d "$dest" ]] || { echo "KHÔNG ĐẠT: không có thư mục đích $dest" >&2; exit 1; }

[[ $dry_run -eq 1 ]] && echo "[--dry-run] Không ghi gì." || echo "Đồng bộ thật."
echo "Nguồn: $src"
echo "Đích:  $dest"

total_chars=0
changed=0

for f in SOUL.md AGENTS.md; do
  chars="$(wc -m < "$src/$f")"
  total_chars=$((total_chars + chars))
  if [[ $chars -gt $max_file_chars ]]; then
    echo "CẢNH BÁO: $f dài $chars ký tự, vượt ngưỡng $max_file_chars (có thể bị cắt khi nạp)"
  fi
  if [[ ! -f "$dest/$f" ]]; then
    echo "MỚI:    $f"
    changed=$((changed + 1))
    [[ $dry_run -eq 1 ]] || cp -p "$src/$f" "$dest/$f"
  elif ! cmp -s "$src/$f" "$dest/$f"; then
    echo "GHI ĐÈ: $f (đích khác bản trong repo)"
    diff -u "$dest/$f" "$src/$f" | sed 's/^/    /' || true
    changed=$((changed + 1))
    [[ $dry_run -eq 1 ]] || cp -p "$src/$f" "$dest/$f"
  else
    echo "GIỮ:    $f (giống nhau)"
  fi
done

# skills/: chép từng thư mục skill có trong repo, không xóa gì ở đích.
if [[ -d "$src/skills" ]]; then
  for skill_dir in "$src"/skills/*/; do
    [[ -d "$skill_dir" ]] || continue
    name="$(basename "$skill_dir")"
    mkdir_needed=0
    [[ -d "$dest/skills/$name" ]] || mkdir_needed=1
    # --itemize-changes: dòng đầu mỗi tệp đổi; không có dòng nào nghĩa là giống nhau.
    out="$(rsync -rlt --dry-run --itemize-changes "$skill_dir" "$dest/skills/$name/" | grep -v '^\.d' || true)"
    if [[ -n "$out" || $mkdir_needed -eq 1 ]]; then
      echo "SKILL:  $name"
      [[ -z "$out" ]] || echo "$out" | sed 's/^/    /'
      changed=$((changed + 1))
      if [[ $dry_run -eq 0 ]]; then
        mkdir -p "$dest/skills/$name"
        rsync -rlt "$skill_dir" "$dest/skills/$name/"
      fi
    else
      echo "GIỮ:    skills/$name (giống nhau)"
    fi
    while IFS= read -r -d '' md; do
      c="$(wc -m < "$md")"
      total_chars=$((total_chars + c))
    done < <(find "$skill_dir" -type f -name 'SKILL.md' -print0)
  done
  # Skill có ở đích nhưng không có trong repo: chỉ báo, không xóa.
  if [[ -d "$dest/skills" ]]; then
    for d in "$dest"/skills/*/; do
      [[ -d "$d" ]] || continue
      [[ -d "$src/skills/$(basename "$d")" ]] || echo "MỒ CÔI: skills/$(basename "$d") (có ở đích, không có trong repo; không xóa)"
    done
  fi
fi

if [[ $total_chars -gt $max_total_chars ]]; then
  echo "CẢNH BÁO: tổng $total_chars ký tự vượt ngưỡng $max_total_chars"
fi

if [[ $dry_run -eq 1 ]]; then
  echo "ĐẠT (dry-run): $changed mục sẽ đổi, chưa ghi gì"
else
  echo "ĐẠT: đã đồng bộ, $changed mục đổi"
  echo "Mở phiên mới trên Control UI để trợ lý nạp bản mới."
fi
