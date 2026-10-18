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

## Đăng nhập lại Codex

Đăng nhập Codex (OAuth ChatGPT) của Gateway có hạn: `expiresAt` hiện là `1792943476465` (22:51 ngày 25/10/2026). Làm trước hạn này (mục tiêu 22/10/2026). Anh Khải tự chạy các bước dưới đây trong terminal Ubuntu (có TTY), đứng trong `~/apps/openclaw`; chỉ thao tác với `openclaw-gateway` của dự án, không đụng `openclaw-bot`, `9router-bot`. Chưa ai chạy quy trình này; mọi chỗ ghi "chưa kiểm chứng" ở cuối mục là điều cần quan sát khi làm lần đầu.

**Bí mật:** mã thiết bị, URL chuyển hướng, token hiện trên màn hình là bí mật. Không dán, không chụp, không gửi cho ai (kể cả trợ lý lập trình), không ghi vào repo. Bản sao lưu bên dưới chứa thông tin xác thực: để ngoài repo, giữ quyền 700.

1. Dừng Gateway rồi sao lưu cả thư mục (dừng để tệp SQLite không đang được ghi). Lệnh `cp -a` dừng lại nếu bản sao lưu đã tồn tại, để không chép lồng thư mục:

   ```bash
   cd ~/apps/openclaw
   docker compose stop openclaw-gateway
   test ! -e ~/.openclaw.truoc-dangnhap && cp -a ~/.openclaw ~/.openclaw.truoc-dangnhap
   ls -ld ~/.openclaw ~/.openclaw.truoc-dangnhap
   ```

   Nếu `test` báo tồn tại thì dừng, đổi tên bản sao lưu cũ (không xóa) rồi làm lại.

2. Bật lại Gateway TRƯỚC khi đăng nhập (`exec` cần container đang chạy), đợi `healthz` đạt:

   ```bash
   docker compose up -d openclaw-gateway
   curl -fsS http://127.0.0.1:28789/healthz
   ```

3. Đăng nhập bằng mã thiết bị. Chạy trực tiếp trong terminal (không dùng `-T`, không chạy qua script), rồi làm theo hướng dẫn trên màn hình bằng trình duyệt trên máy Windows:

   ```bash
   docker compose exec openclaw-gateway node dist/index.js models auth login --provider openai --device-code
   ```

   Giữ lệnh chạy cho tới khi hoàn tất. Nếu lệnh báo lỗi (kể cả cờ `--device-code` không được nhận): **dừng, không thử cờ khác, không dùng `--force`**, chép nguyên văn dòng lỗi (đã xóa mã, URL, token nếu có) và báo lại. `--force` xóa mọi hồ sơ xác thực hiện có của nhà cung cấp, kể cả hồ sơ dùng chung của agent main. Không dùng `--profile-id`, `--set-default`: docs ghi hai cờ này buộc dừng Gateway.

4. Kiểm chứng:

   ```bash
   docker compose exec openclaw-gateway node dist/index.js models status --json | grep -i expir
   docker compose exec openclaw-gateway node dist/index.js models status --check; echo "mã thoát: $?"
   curl -fsS http://127.0.0.1:28789/healthz
   ```

   Đạt khi: `expiresAt` mới **lớn hơn** `1792943476465`; mã thoát `0` (`2` nghĩa là credential vẫn sắp hết hạn, `1` là lỗi xác thực); `healthz` live; mở phiên mới trên Control UI (dấu + cạnh PHIÊN), nói "Chào em" thì trợ lý trả lời bình thường.

5. Hoàn tác (khi đăng nhập làm hỏng xác thực hiện có). Không xóa, chỉ đổi tên thư mục hỏng:

   ```bash
   cd ~/apps/openclaw
   docker compose stop openclaw-gateway
   mv ~/.openclaw ~/.openclaw.hong-$(date +%Y%m%d-%H%M)
   cp -a ~/.openclaw.truoc-dangnhap ~/.openclaw
   docker compose up -d openclaw-gateway
   curl -fsS http://127.0.0.1:28789/healthz
   ```

   Rồi kiểm chứng lại như bước 4 (`expiresAt` quay về `1792943476465`). Docs không có quy trình hoàn tác cho đăng nhập; đây là cách đề xuất của dự án, chưa chạy thử.

Nguồn (docs.openclaw.ai, bản đang phát hành, chưa đối chiếu với 2026.10.3, tra ngày 18/10/2026): `/cli/models`, `/concepts/oauth`, `/providers/openai/setup`, `/install/docker`.

Chưa kiểm chứng:

- Cờ `--device-code` có được bản 2026.10.3 nhận và chạy được trong Docker không; định dạng và thời hạn của mã thiết bị.
- `docker compose exec` (thay vì `run --rm openclaw-cli`, từng bị `GatewayLockNamespaceError`) có chạy được lệnh đăng nhập không, và có cần `-it` không (đã ghi chạy trực tiếp trong terminal có TTY).
- Đăng nhập khi Gateway đang chạy có ghi đè hồ sơ `openai` hiện có không (docs chỉ nói rõ cho `--force`).
- Ý nghĩa của `expiresAt` (hạn access token hay hạn phiên OAuth), vì sao nó chưa đổi dù docs ghi runtime tự làm mới token, và ngưỡng "sắp hết hạn" của `models status --check`.
- Cách hoàn tác ở bước 5.
