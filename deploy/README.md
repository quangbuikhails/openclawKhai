# deploy — cấu hình mẫu OpenClaw của dự án

OpenClaw cài tại `~/apps/openclaw`, ngoài repo (PLAN.md D19). Thư mục này chỉ giữ phần dự án sửa thêm, không chứa bí mật.

| Tệp | Dùng để |
|---|---|
| `.env.example` | Mẫu `~/apps/openclaw/.env`: tên dự án Compose `khai-pbs`, cổng 28789/28790/28978, múi giờ, image, token Gateway |
| `ap-dung-cong-127.sh` | Thêm `127.0.0.1:` vào ba cổng trong `~/apps/openclaw/docker-compose.yml` |

## Cách áp dụng (anh Khải tự làm)

1. Đối chiếu `~/apps/openclaw/.env` với `.env.example`: các khóa phải đúng giá trị mẫu, trừ hai khóa: `OPENCLAW_GATEWAY_TOKEN` giữ token do script cài đặt sinh ra, không chép vào repo; `OPENCLAW_IMAGE` cố định theo digest (xem mục dưới).
2. Gắn cổng vào `127.0.0.1`. Script tự lưu bản gốc `docker-compose.yml.bak` nếu chưa có, chạy lại không sao:

   ```bash
   bash deploy/ap-dung-cong-127.sh
   ```

3. Khởi động lại Gateway rồi kiểm tra:

   ```bash
   cd ~/apps/openclaw && docker compose up -d openclaw-gateway
   curl -fsS http://127.0.0.1:28789/healthz
   ```

Sau mỗi lần cập nhật mã nguồn OpenClaw (`git pull` trong `~/apps/openclaw`), chạy lại bước 2 nếu `docker-compose.yml` bị ghi đè.

## Cố định OPENCLAW_IMAGE theo digest

Không để `OPENCLAW_IMAGE` là `latest` (PLAN.md mục 6). Lấy digest của image đang có trên máy:

```bash
docker image inspect ghcr.io/openclaw/openclaw:latest --format '{{index .RepoDigests 0}}'
```

Sửa dòng trong `~/apps/openclaw/.env` thành kết quả của lệnh trên, ví dụ:

```
OPENCLAW_IMAGE=ghcr.io/openclaw/openclaw@sha256:<digest>
```

Rồi `docker compose up -d openclaw-gateway`. Digest đang dùng ghi trong bảng phiên bản của PLAN.md mục 6; nâng phiên bản theo quy trình ở đó.
