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

Đăng nhập Codex (OAuth ChatGPT) của Gateway có hạn: `expiresAt` hiện là `1792943476465` (22:51 ngày 25/10/2026). Làm trước hạn này (mục tiêu 22/10/2026). Anh Khải tự chạy các bước dưới đây trong terminal Ubuntu (có TTY), đứng trong `~/apps/openclaw`; chỉ thao tác với `openclaw-gateway` của dự án, không đụng `openclaw-bot`, `9router-bot`. Quy trình đã chạy thật ngày 18/10/2026 (OpenClaw 2026.10.3); các điều đã và chưa kiểm chứng ghi ở cuối mục.

**Bí mật:** mã thiết bị, URL chuyển hướng, token hiện trên màn hình là bí mật. Không dán, không chụp, không gửi cho ai (kể cả trợ lý lập trình), không ghi vào repo. Bản sao lưu bên dưới chứa thông tin xác thực: để ngoài repo, giữ quyền 700.

1. Dừng Gateway rồi sao lưu cả thư mục (dừng để tệp SQLite không đang được ghi). Lệnh `cp -a` dừng lại nếu bản sao lưu đã tồn tại, để không chép lồng thư mục:

   ```bash
   cd ~/apps/openclaw
   docker compose stop openclaw-gateway
   # Lần đăng nhập thứ hai (27/10/2026) đã dùng tên ~/.openclaw.truoc-dangnhap2; lần sau đổi hậu tố để không đè bản cũ.
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
   # Chọn đúng bản sao lưu của lần đăng nhập vừa làm: truoc-dangnhap (18/10/2026) hoặc truoc-dangnhap2 (27/10/2026).
   cp -a ~/.openclaw.truoc-dangnhap ~/.openclaw
   docker compose up -d openclaw-gateway
   curl -fsS http://127.0.0.1:28789/healthz
   ```

   Rồi kiểm chứng lại như bước 4 (`expiresAt` quay về `1792943476465`). Docs không có quy trình hoàn tác cho đăng nhập; đây là cách đề xuất của dự án, chưa chạy thử.

Nguồn (docs.openclaw.ai, bản đang phát hành, chưa đối chiếu với 2026.10.3, tra ngày 18/10/2026): `/cli/models`, `/concepts/oauth`, `/providers/openai/setup`, `/install/docker`.

Đã kiểm chứng (18/10/2026, OpenClaw 2026.10.3):

- `docker compose exec openclaw-gateway node dist/index.js models auth login --provider openai --device-code` chạy được trong Docker, trực tiếp trong terminal, không cần `-it`; không dùng `--force`, `--profile-id`, `--set-default`.
- Sau đăng nhập chỉ còn 1 hồ sơ OAuth; mô hình mặc định không đổi; `expiresAt` chuyển từ `1792943476465` sang `1793182040342` (khoảng 17:07 ngày 28/10/2026, `models status` ghi "expires in 10d"), tức hạn mỗi lần đăng nhập khoảng 10 ngày. Lần đăng nhập thứ hai (27/10/2026) đưa `expiresAt` sang `1793935067843` (10:17 ngày 06/11/2026). `models status --check` thoát 0 (`status=usable`), `healthz` live, phiên mới trả lời bình thường.

Chưa kiểm chứng:

- Đã kiểm chứng 27/10/2026: OpenClaw không tự gia hạn đăng nhập Codex (`expiresAt` giữ nguyên, `post-deploy-check` báo còn 1,3 ngày dù Gateway chạy bình thường), phải đăng nhập lại bằng tay. Chưa rõ ý nghĩa của `expiresAt` (hạn access token hay hạn phiên OAuth). Theo dõi `expiresAt` và đăng nhập lại trước 06/11/2026 (nếu còn dưới 3 ngày).
- Ngưỡng "sắp hết hạn" của `models status --check`.
- Cách hoàn tác ở bước 5 (chưa chạy thử).

## MCP Google (G2-01B, spike)

Server MCP nhỏ (`mcp-google/server.mjs`) chạy ở container riêng `khai-mcp-google`, dùng lại image OpenClaw đang ghim digest (Node và SDK MCP có sẵn trong `/app/node_modules`, không thêm package). HTTP trong mạng `khai-pbs_default`, không publish cổng. Chỉ thao tác đúng một bảng tính và một lịch theo `SPREADSHEET_ID`, `CALENDAR_ID` trong `secrets/mcp-google.env` (đổi tên từ `TEST_SPREADSHEET_ID`, `TEST_CALENDAR_ID` ở G2-04: phải sửa tệp này trước khi chạy lại). `SHEET_MODE`, `CAL_MODE` (`test` mặc định, hoặc `prod`) phải khớp tên bảng tính, lịch; chế độ `test` chỉ ghi vào việc có Nội dung cần xử lý bắt đầu `[TEST]`. Công cụ: `task_list`, `task_add`, `task_set_status`, `task_set_due`, `date_today`, `cal_*`; không có công cụ xóa dòng. `cal_create`, `cal_update`, `cal_delete` chỉ tác động sự kiện do trợ lý tạo (dấu `private.owner`, PLAN.md D25), sự kiện chủ tự tạo chỉ đọc; `CAL_MODE=test` bắt buộc tiêu đề bắt đầu `[TEST]`.

Anh Khải tự làm (không dán khóa, token vào chat hay repo):

1. Tạo `secrets/google-sa.json` (khóa Service Account) và `secrets/mcp-google.env` theo mẫu cuối `deploy/.env.example`. Container chạy user 1000:1000: `chmod 600` đủ nếu uid máy là 1000 (`id -u`).
2. Xem trước cấu hình ghép, không khởi động gì:

   ```bash
   cd ~/apps/openclaw
   docker compose -f docker-compose.yml -f ~/projects/khai-phien-ban-so/deploy/docker-compose.mcp-google.yml config
   ```

   Kiểm tra: dịch vụ `khai-mcp-google` không có `ports`, đúng hai mount `:ro`, `env_file` đã giải đường dẫn.
3. Khởi động chỉ dịch vụ này, không đụng Gateway:

   ```bash
   docker compose -f docker-compose.yml -f ~/projects/khai-phien-ban-so/deploy/docker-compose.mcp-google.yml up -d --no-deps khai-mcp-google
   docker logs khai-mcp-google
   ```

4. Đăng ký vào OpenClaw (token ghi thẳng vào `openclaw.json` bằng `mcp set`, không dùng `${...}`, không sửa môi trường Gateway). Khóa và cú pháp `mcp set`, `toolFilter` đối chiếu `/cli/mcp/registry` trước khi chạy (chưa kiểm chứng). Quy trình đổi cấu hình:

   1. Sao lưu, không dừng Gateway: `cp -p ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.truoc-nhom11`
   2. `mcp set … --dry-run`, đọc kết quả
   3. Áp dụng `mcp set …`
   4. `config validate`
   5. `curl -fsS http://127.0.0.1:28789/healthz`
   6. Mở phiên mới (dấu + cạnh PHIÊN)
   7. Kiểm `expiresAt` của Codex (`models status`) còn nguyên

   Lấy tên công cụ thực tế bằng `mcp probe` hoặc `mcp doctor <tên> --probe`.

Hoàn tác: `mcp unset <tên>` (hoặc chép lại `openclaw.json.truoc-nhom11`), rồi `docker compose -f … -f … rm -sf khai-mcp-google`; xóa `secrets/mcp-google.env`, `secrets/google-sa.json` và thu hồi khóa trong Google Cloud. Không xóa volume.
