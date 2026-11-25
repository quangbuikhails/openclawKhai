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

## Đăng nhập lại Drive mỗi tuần (G2C-03, D44)

Màn hình đồng ý OAuth ở chế độ Testing nên refresh token Drive hết hạn sau 7 ngày. Hết hạn thì `drive_save_document` trả "Drive cần đăng nhập lại" và không ghi gì; Sheets, Calendar (Service Account) không bị ảnh hưởng. Hạn hiện tại: **22/11/2026 khoảng 01:16 giờ Việt Nam** (`obtained_at` 2026-11-14T18:16:57Z + 7 ngày). Làm lại sớm nhất từ ngày thứ 5 (`scripts/post-deploy-check.sh` bắt đầu cảnh báo), dự kiến **20/11/2026, cùng lượt đăng nhập lại Codex** (hạn Codex 23/11/2026 13:56).

1. Chạy (máy chủ không có `node` nên dùng image OpenClaw; không mở cổng):

   ```bash
   cd ~/projects/khai-phien-ban-so && docker run --rm -it --user 1000:1000 --entrypoint node -v "$PWD/scripts:/s:ro" -v "$PWD/secrets/google:/g" "$(grep ^OPENCLAW_IMAGE ~/apps/openclaw/.env | cut -d= -f2)" /s/google-oauth-login.mjs /g/oauth-client.json /g/oauth-token.json
   ```

2. Mở đường dẫn script in ra, đăng nhập tài khoản của chủ, cấp quyền `drive.file`. Trình duyệt sẽ báo không vào được `http://127.0.0.1:1/...` (bình thường); chép **cả URL** ở thanh địa chỉ, dán vào dòng nhắc của script. Không dán URL hay token vào chat.
3. Script ghi `secrets/google/oauth-token.json` (quyền 600, kèm `obtained_at`), không in token. **Server chưa đọc lại tệp này sau khi đăng nhập lại** (23/11/2026: đăng nhập lại lúc 15:38 nhưng `drive_save_document` vẫn báo cần đăng nhập lại; `docker restart khai-mcp-google` lúc 15:52 thì lưu được; nguyên nhân suy luận, chưa kiểm chứng). Tạm thời, sau khi script ghi xong, lưu log rồi restart (không tạo lại container, không đổi cấu hình):

   ```bash
   docker logs -t khai-mcp-google > ~/khai-logs/mcp-google-$(date +%Y%m%d-%H%M).log 2>&1
   docker restart khai-mcp-google
   docker inspect -f '{{.State.StartedAt}}' khai-mcp-google   # ghi mốc giờ vào tasks.md
   ```

   Sửa dứt điểm: task Phát sinh "server Google đọc lại `oauth-token.json`" trong `docs/tasks.md`.
4. Kiểm: `bash scripts/post-deploy-check.sh` dòng "đăng nhập Drive" phải ĐẠT, hạn mới sau 7 ngày.

Xem lại Publish sang Production khi có tên miền đã xác minh (Google đòi trang chủ và chính sách riêng tư).

## Xoay MCP_GOOGLE_TOKEN (làm ở G2C-03 ngày 14/11/2026)

Token Bearer của MCP `google` nằm ở hai nơi: `secrets/mcp-google.env` (`MCP_GOOGLE_TOKEN`) và `~/.openclaw/openclaw.json` (`mcp.servers.google.headers.Authorization`).

1. Sao lưu ngoài repo: `cp -p secrets/mcp-google.env ~/.openclaw/mcp-google.env.truoc-xoay` và `cp -p ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.truoc-xoay`.
2. Tạo giá trị mới (`openssl rand -hex 32`), sửa `secrets/mcp-google.env`, tạo lại container (lệnh `up -d --force-recreate --no-deps khai-mcp-google` như mục MCP Google, bước 3). **Lưu `docker logs -t khai-mcp-google` ra tệp trước** vì tạo lại container xóa log.
3. Cập nhật `Authorization` trong `openclaw.json` bằng `mcp set … --dry-run` rồi áp dụng (nạp nóng). Không in giá trị token ra màn hình hay chat.
4. Kiểm: lời gọi công cụ đầu tiên từ phiên mới thành công. `BRIEF_TOKEN` là khóa riêng, không xoay cùng.

## Thư mục tệp gốc `media/inbound` (G2C-03, D43)

- Gateway lưu tệp gốc văn bản đến ở `~/.openclaw/workspace/media/inbound/openclaw-staged-<uuid>/`. `docker-compose.mcp-google.yml` gắn thư mục này **chỉ đọc** vào `khai-mcp-google` tại `/inbox`. Công cụ `drive_save_document` nhận mã tệp (`media://inbound/<mã>`), không nhận đường dẫn, và chỉ mở tệp qua các kiểm tra: mã đúng dạng, không liên kết tượng trưng, có tệp đánh dấu `.gitignore` của Gateway, đuôi jpg/jpeg/png/pdf/docx, đúng chữ ký tệp.
- Rủi ro chấp nhận: server đọc được mọi tệp trong `inbound`, không chỉ tệp của lượt đang xử lý. Chỉ phiên của chủ gọi được công cụ (D32).
- Dọn: `bash scripts/don-media-inbound.sh` chỉ liệt kê thư mục quá 14 ngày (đổi bằng `--ngay N`). Xóa thật phải thêm `--xoa` và gõ `XOA` khi được hỏi. Không đưa vào cron. `post-deploy-check.sh` cảnh báo khi thư mục trên 200 MB. Tệp đã lưu lên Drive thì bản trên Drive còn nguyên.

## Web app Biểu theo dõi, chỉ đọc (G4-02, D47)

Container `khai-web-admin`, cổng `127.0.0.1:28801`, mạng riêng `khai-pbs-web`. Dùng tệp compose riêng; không đụng `openclaw-gateway`, `khai-mcp-google`.

1. Khóa SA chỉ đọc: `secrets/google-ro/google-ro-sa.json` (đã có). Bảng tính thật và lịch "Công việc" chia sẻ cho SA này.
2. Tạo `secrets/web-admin.env` (nhập ẩn, không in giá trị). Chạy từ thư mục gốc repo, gõ với `!` nếu trong phiên Claude Code:

   ```bash
   install -m 600 /dev/null secrets/web-admin.env
   docker run --rm -it --user 1000:1000 --network none --read-only --cap-drop ALL --entrypoint node \
     -v "$PWD/scripts/web-admin-khoi-tao.mjs:/s.mjs:ro" -v "$PWD/secrets/web-admin.env:/out.env" \
     "$(grep ^OPENCLAW_IMAGE= ~/apps/openclaw/.env | cut -d= -f2-)" /s.mjs
   ```

   Hỏi lần lượt: mật khẩu (từ 12 ký tự, 2 lần), ID bảng tính, ID lịch. Ghi lại: thêm `--ghi-de` sau `/s.mjs`. Muốn thấy ký tự khi gõ (chẩn đoán): thêm `--hien`. Hai lần không khớp thì chỉ in độ dài, không in nội dung.
3. Bật (project `khai-pbs-web` riêng nên không có cảnh báo orphan; không bao giờ chạy `down` hay `--remove-orphans` với project `khai-pbs`):

   ```bash
   docker compose -p khai-pbs-web --env-file ~/apps/openclaw/.env -f deploy/docker-compose.web-admin.yml up -d --no-deps web-admin
   curl -fsS http://127.0.0.1:28801/healthz
   ```

4. Dừng, bật lại hay cập nhật mã: chỉ thao tác với `web-admin`. Sửa mã trong `web-admin/` thì chạy `up -d --force-recreate --no-deps web-admin` (tệp tĩnh đọc một lần lúc khởi động; `up -d` thường không làm gì khi cấu hình không đổi); dừng: `stop web-admin`. Đổi mật khẩu: chạy lại bước 2 với `--ghi-de` rồi tạo lại container (phiên cũ mất hiệu lực vì khóa phiên đổi).

### Đường ghi cho Kanban (G4-03, D47)
`khai-web-admin` ghi trạng thái duy nhất qua `khai-mcp-google:3000/web/task-status` (mạng `khai-pbs-write`, internal, chỉ hai container này). Cần ba giá trị, không in ra màn hình:
- `WEB_TOKEN` (≥32 ký tự, khác `MCP_GOOGLE_TOKEN`, `BRIEF_TOKEN`) và `WEB_ORIGIN=http://khai-web-admin` có trong **cả hai** tệp `secrets/mcp-google.env` và `secrets/web-admin.env`. Thiếu một trong hai thì mcp tắt đường `/web`, web chỉ đọc.
- Sinh token: `t=$(openssl rand -hex 32); printf 'WEB_TOKEN=%s\nWEB_ORIGIN=http://khai-web-admin\n' "$t" | tee -a secrets/mcp-google.env secrets/web-admin.env >/dev/null; unset t`.
- Thứ tự đưa lên: (1) lưu `docker logs -t khai-mcp-google > ~/khai-mcp-google-$(date +%F-%H%M).log 2>&1`; (2) tạo lại `khai-mcp-google` (lệnh ở mục "Chính sách khởi động lại"), việc này tạo mạng `khai-pbs-write`; kiểm `docker logs khai-mcp-google` có `web: bật`; (3) tạo lại `web-admin` (`up -d --force-recreate --no-deps web-admin`). Quay lui: `git revert` rồi tạo lại hai container theo thứ tự trên; `WEB_TOKEN` thừa trong tệp env vô hại.
- `MCP_WRITE_URL` (địa chỉ khai-mcp-google cho đường ghi) khai báo trong `deploy/docker-compose.web-admin.yml`, mặc định `http://khai-mcp-google:3000`; chỉ đổi khi tên container hoặc cổng đổi.
- Kiểm: `/web/task-status` thiếu Origin hoặc sai Origin trả 403; `MCP_GOOGLE_TOKEN` gọi `/web/...` trả 401; `WEB_TOKEN` gọi `/mcp` trả 401.

## Truy cập từ điện thoại (Tailscale; G4-05, D48)

Tailscale cài trên Windows (không cài trong WSL), tailnet gói Personal, 2 máy: desktop-5ofd6fr (100.126.218.63, Windows), iphone-15-pro-max (100.112.123.77, iOS). MagicDNS và HTTPS Certificates đã bật. Địa chỉ: `https://desktop-5ofd6fr.tail7d6c8a.ts.net` (chỉ trong tailnet). Không dùng Funnel, không mở cổng router.

Chạy trong PowerShell trên Windows:

```powershell
tailscale serve status                                  # xem cấu hình hiện có
tailscale serve --bg http://127.0.0.1:28801             # bật lại
tailscale serve --https=443 off                         # tắt
```

Chính sách tailnet (Access controls): không dùng mặc định cho phép tất cả; chỉ một grant `src 100.112.123.77` → `dst 100.126.218.63`, `ip tcp:443`; tests: accept `100.126.218.63:443`, deny `100.126.218.63:3389`, `:445`, `:28789`. Thêm thiết bị mới (điện thoại, máy tính khác) thì phải thêm địa chỉ của nó vào `src` của grant, nếu không máy đó không vào được. Quay lui chính sách: Logs → Configuration trong trang quản trị Tailscale (bản cũ trước G4-05 anh Khải còn lưu ở tệp tailscale-policy-cu.txt trên máy). Không bật Funnel: Funnel đưa trang ra Internet, trái D18.

Kiểm sau khi đổi: iPhone bật Tailscale mở được trang; tắt Tailscale, dùng 4G thì không vào được. `tailscale serve --bg` còn sau khi khởi động lại Windows hay không: kiểm ở lần khởi động lại tới.

## MCP Google (G2-01B, spike)

Server MCP nhỏ (`mcp-google/server.mjs`) chạy ở container riêng `khai-mcp-google`, dùng lại image OpenClaw đang ghim digest (Node và SDK MCP có sẵn trong `/app/node_modules`, không thêm package). HTTP trong mạng `khai-pbs_default`, không publish cổng. Chỉ thao tác đúng một bảng tính và một lịch theo `SPREADSHEET_ID`, `CALENDAR_ID` trong `secrets/mcp-google.env` (đổi tên từ `TEST_SPREADSHEET_ID`, `TEST_CALENDAR_ID` ở G2-04: phải sửa tệp này trước khi chạy lại). `SHEET_MODE`, `CAL_MODE` (`test` mặc định, hoặc `prod`) phải khớp tên bảng tính, lịch; chế độ `test` chỉ ghi vào việc có Nội dung cần xử lý bắt đầu `[TEST]`. Công cụ: `task_list`, `task_add`, `task_set_status`, `task_set_due`, `date_today`, `cal_*`; không có công cụ xóa dòng. `cal_create`, `cal_update`, `cal_delete` chỉ tác động sự kiện do trợ lý tạo (dấu `private.owner`, PLAN.md D25), sự kiện chủ tự tạo chỉ đọc; `CAL_MODE=test` bắt buộc tiêu đề bắt đầu `[TEST]`.

Bản tin và đồng bộ lịch (G2-06b): công cụ `brief_today`, `task_sync_calendar`, `task_sync_all`; `task_add`, `task_set_due`, `task_set_status` tự đồng bộ [Nhắc], [Hạn] (sự kiện cả ngày mang `private.owner`, `stt`, `kind`; không tạo mới sự kiện có ngày đã qua). Điểm HTTP cho job `--command`, dùng token riêng `BRIEF_TOKEN` (không mở được `/mcp`; thiếu, dưới 32 ký tự hoặc trùng `MCP_GOOGLE_TOKEN` thì các đường này trả 404): `GET /brief/morning` (07:30), `GET /brief/afternoon` (14:00, không có việc thì đúng `NO_REPLY`), `POST /sync/all` (một dòng tóm tắt; dừng nếu biểu rỗng, đọc lỗi, hoặc định xóa quá 10 sự kiện; `?force=1` chỉ vượt ngưỡng 10, job đối chiếu 06:30 không dùng; `?quiet=1` thì thành công in đúng `NO_REPLY`, dừng hoặc lỗi vẫn in câu "⚠️"). Lỗi nghiệp vụ trả HTTP 200 kèm câu bắt đầu "⚠️". Không đưa token vào dòng lệnh job: lệnh đọc tiêu đề từ tệp `brief-auth.txt` (xem ba job bên dưới, G2-06d).

Ba job nhắc việc (G2-06d, anh Khải tạo ngày 29/10/2026, OpenClaw 2026.10.3; job `--command` chạy trong container Gateway qua `sh -lc`, không gọi mô hình). Token không nằm trong dòng lệnh job: `curl` đọc tiêu đề xác thực từ tệp `~/.openclaw/brief-auth.txt` (Gateway thấy là `/home/node/.openclaw/brief-auth.txt`), tệp này không nằm trong repo. Tạo tệp (chạy ở thư mục gốc repo; một dòng `Authorization: Bearer <BRIEF_TOKEN>`, quyền 600):

```bash
( umask 077; printf 'Authorization: Bearer %s\n' "$(grep '^BRIEF_TOKEN=' secrets/mcp-google.env | cut -d= -f2-)" > ~/.openclaw/brief-auth.txt )
```

Lưu ý: đổi `BRIEF_TOKEN` thì phải tạo lại tệp này. Container `khai-mcp-google` có `restart: unless-stopped` (xem mục "Chính sách khởi động lại và chạy bù" bên dưới).

Lệnh tạo job (ở `~/apps/openclaw`; cả ba `--tz Asia/Ho_Chi_Minh --exact --no-deliver`, lệnh mẫu dưới đây chưa có `--announce`, phần gắn gửi tin xem ngay sau khối lệnh). Phần `|| echo` bảo đảm server dừng vẫn ra câu báo lỗi chứ không rỗng; `2>/dev/null` giữ `summary` không có nhãn `stderr:`:

```bash
cd ~/apps/openclaw
OC="docker compose exec -T openclaw-gateway node dist/index.js"

$OC automations create --name "Bản tin sáng" --cron "30 7 * * 1-5" --tz Asia/Ho_Chi_Minh --exact --no-deliver \
  --command 'curl -fsS --max-time 30 -H @/home/node/.openclaw/brief-auth.txt http://khai-mcp-google:3000/brief/morning 2>/dev/null || echo "⚠️ Không lấy được bản tin 07:30: máy chủ Google không phản hồi. Anh kiểm tra giúp."'

$OC automations create --name "Nhắc việc 14:00" --cron "0 14 * * 1-5" --tz Asia/Ho_Chi_Minh --exact --no-deliver \
  --command 'curl -fsS --max-time 30 -H @/home/node/.openclaw/brief-auth.txt http://khai-mcp-google:3000/brief/afternoon 2>/dev/null || echo "⚠️ Không lấy được nhắc việc 14:00: máy chủ Google không phản hồi. Anh kiểm tra giúp."'

$OC automations create --name "Đối chiếu lịch" --cron "30 6 * * 1-5" --tz Asia/Ho_Chi_Minh --exact --no-deliver \
  --command 'curl -fsS --max-time 60 -X POST -H @/home/node/.openclaw/brief-auth.txt "http://khai-mcp-google:3000/sync/all?quiet=1" 2>/dev/null || echo "⚠️ Không đồng bộ được lịch: máy chủ Google không phản hồi."'
```

Gắn gửi tin cho Bản tin sáng và Nhắc việc 14:00 (G2-06d, 02/11/2026; Đối chiếu lịch giữ `--no-deliver`): `automations edit <id> --announce --channel zalo --to <ID_ZALO> --failure-alert --failure-alert-channel telegram --failure-alert-to <ID_TELEGRAM> --failure-alert-after 1`. ID Zalo là số, không cần tiền tố; `<ID_ZALO>`, `<ID_TELEGRAM>` là giữ chỗ, giá trị thật không ghi vào repo. Nếu Zalo giao lỗi thì Telegram nhận thông báo "delivery failed" kèm tên job và giờ chạy, không kèm nội dung bản tin.

Kết quả chạy tay 29/10/2026 (bảng thật đang rỗng): bản tin 1315 ms ra bốn mục "Không có"; nhắc 14:00 556 ms ra `NO_REPLY` (run không có `summary`, `diagnostics.summary` là `NO_REPLY`); đối chiếu 1246 ms ra cảnh báo biểu rỗng, định xóa 0 sự kiện. Xem lịch sử chạy bằng `automations runs`.

Chính sách khởi động lại và chạy bù (G2-06e, 30/10/2026, OpenClaw 2026.10.3):

- `khai-mcp-google` và `openclaw-gateway` đều `unless-stopped`: Docker tự bật lại sau khi máy khởi động lại, trừ container đã dừng bằng tay. Container đang chạy đã đổi bằng `docker update --restart unless-stopped khai-mcp-google` (không dừng container). Tệp `deploy/docker-compose.mcp-google.yml` đã đặt `restart: unless-stopped` cho khớp, để lần tạo lại (`--force-recreate`) giữ nguyên chính sách; nếu hai nơi lệch nhau thì lần tạo lại sẽ ghi đè theo tệp compose.
- Sự cố sau khi bật máy (03/11 và 10/11/2026, G2-08): `khai-mcp-google` thoát mã 127 khi Docker tự khởi động, trong khi Gateway và hai bot khác tự lên bình thường. Nguyên nhân chưa chứng minh được (nghi ổ Ubuntu WSL chưa sẵn sàng khi gắn tệp đơn lẻ `google-sa.json`); đã đổi sang gắn thư mục `secrets/google`. Nếu còn lỗi, **bước 0 trước khi tạo lại container** (để giữ bằng chứng):
  ```bash
  docker ps -a --filter name=khai-mcp-google --format '{{.Status}}'
  docker inspect khai-mcp-google --format '{{.State.ExitCode}} | {{.State.Error}}'
  docker logs --tail 20 khai-mcp-google
  ```
  Ghi kết quả vào `docs/tasks.md` (mục Phát sinh), rồi mới chạy ở `~/apps/openclaw`: `docker compose -f docker-compose.yml -f ~/projects/khai-phien-ban-so/deploy/docker-compose.mcp-google.yml up -d --no-deps --force-recreate khai-mcp-google`. Không dùng `--remove-orphans`. Xác nhận bằng `docker logs --tail 5 khai-mcp-google` ("biểu: prod, lịch: prod, brief: bật") và `bash scripts/post-deploy-check.sh`.
  Vài dòng MODULE_NOT_FOUND ngay trước dòng 'lắng nghe cổng 3000' sau khi bật máy là bình thường (ổ WSL chưa sẵn sàng, Docker tự chạy lại); chỉ xử lý khi container ở trạng thái Exited.
- Dừng tạm: `docker stop khai-mcp-google` (Docker không tự bật lại). Cần bật lại: `docker compose -f docker-compose.yml -f ~/projects/khai-phien-ban-so/deploy/docker-compose.mcp-google.yml up -d --no-deps khai-mcp-google` (ở `~/apps/openclaw`). Trong lúc dừng, cả ba job in câu báo lỗi "⚠️".
- Sau khi đổi `secrets/mcp-google.env` phải chạy `docker compose ps` (hoặc `docker logs khai-mcp-google`): server kiểm tra khởi động sai thì thoát mã 1 và Docker thử bật lại liên tục (trạng thái `Restarting`), các job vẫn in "⚠️".
- Chạy bù: job `--command` chạy bù khi Gateway tắt qua giờ chạy. Thử ngày 30/10/2026: job thử đặt 08:05, dừng Gateway trước 08:05, bật lại khoảng 08:28; job chạy bù đúng một lần lúc 08:30:23 (khoảng 2 phút sau khi Gateway lên), status ok. Bản tin chạy bù mang nội dung của lúc chạy, không phải của giờ định. Chưa thử lỡ nhiều giờ hay nhiều ngày (ví dụ cả cuối tuần).
- Độ dài `summary`: job thử in 8000 ký tự, `summary` lưu đủ (8021 byte kể cả nhãn), không bị cắt. Bản tin thật nhỏ hơn nhiều (mỗi mục tối đa 15 dòng).

Checklist iPhone (chuông lịch không phải lớp chắc chắn; bản tin và nhắc việc qua kênh vẫn là lớp chính):

- [x] Tắt Chế độ Nguồn điện thấp (anh Khải làm ngày 28/10/2026).
- [x] Bật Làm mới ứng dụng trong nền (anh Khải làm ngày 28/10/2026; chuông 10:45 không báo, báo đúng sau khi chỉnh hai mục này lúc 10:52).
- [ ] Bật thông báo cho ứng dụng Google Calendar (Cài đặt > Thông báo).

Chuyển lịch từ test sang thật (G2-05, 28/10/2026): (1) chia sẻ lịch "Công việc" cho email Service Account với quyền "Thực hiện thay đổi đối với sự kiện" (Make changes to events); (2) sao lưu `secrets/mcp-google.env`, rồi sửa `CALENDAR_ID` thành mã lịch thật và `CAL_MODE=prod` (mã lịch chỉ nằm ở tệp này, không ghi vào repo; chỉ chép dòng "ID lịch", kết thúc bằng `@group.calendar.google.com`, không chép các ô URL, mã nhúng, địa chỉ iCal; sửa tệp env bằng nano, không dán mã vào dòng lệnh); (3) tạo lại container `khai-mcp-google` (`up -d --no-deps --force-recreate khai-mcp-google`) và xem `docker logs khai-mcp-google`: phải thấy "lịch: prod". Kiểm tra mốc thông báo mặc định của lịch thật: 30 phút trước (có giờ), 09:00 (cả ngày). Ở `prod` server không còn chặn tiền tố `[TEST]`.

Anh Khải tự làm (không dán khóa, token vào chat hay repo):

1. Tạo `secrets/google/google-sa.json` (khóa Service Account) và `secrets/mcp-google.env` theo mẫu cuối `deploy/.env.example`. Container chạy user 1000:1000: nếu uid máy là 1000 (`id -u`) thì `chmod 700 secrets/google` và `chmod 600 secrets/google/google-sa.json secrets/mcp-google.env`. Compose gắn thư mục `secrets/google` (chỉ đọc) vào `/run/secrets`, không gắn tệp đơn lẻ.
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

Hoàn tác: `mcp unset <tên>` (hoặc chép lại `openclaw.json.truoc-nhom11`), rồi `docker compose -f … -f … rm -sf khai-mcp-google`; xóa `secrets/mcp-google.env`, `secrets/google/` và thu hồi khóa trong Google Cloud. Không xóa volume.

## Lọc công cụ MCP và đồng bộ workspace cho G2-06c (anh Khải tự làm)

Cú pháp `openclaw mcp tools … --include … --exclude …` đã chạy được trên OpenClaw 2026.10.3 (29/10/2026); `mcp show --json | grep toolFilter` và `config validate` đạt. Cờ `--dry-run` của `mcp tools` chưa kiểm chứng; lệnh khác với dưới đây thì đối chiếu https://docs.openclaw.ai (`/cli/mcp`). Lệnh `openclaw` chạy trong `~/apps/openclaw` qua `docker compose exec openclaw-gateway node dist/index.js <lệnh>` (viết tắt `OC` bên dưới). `task_sync_all` bị loại vì chỉ job `--command` gọi (qua HTTP), mô hình không được gọi.

```bash
cd ~/apps/openclaw
OC="docker compose exec openclaw-gateway node dist/index.js"

# 1. Sao lưu cấu hình (không dừng Gateway)
cp -p ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.truoc-g206c

# 2. Đặt bộ lọc công cụ cho máy chủ "google"
$OC mcp tools google --include "date_*,task_*,cal_*,brief_today" --exclude task_sync_all

# 3. Kiểm: phải thấy toolFilter có đúng include/exclude trên
$OC mcp show google --json | grep toolFilter

# 4. Kiểm cấu hình và Gateway
$OC config validate
curl -fsS http://127.0.0.1:28789/healthz

# 5. Đồng bộ workspace: xem trước, đọc kết quả, rồi chạy thật
cd ~/projects/khai-phien-ban-so
bash scripts/dong-bo-workspace.sh --dry-run
bash scripts/dong-bo-workspace.sh
```

Sau đó mở phiên mới trên Control UI (dấu + cạnh PHIÊN) rồi chạy danh sách kiểm chứng G2-06c trong `docs/tasks.md`. Hoàn tác: chép lại `~/.openclaw/openclaw.json.truoc-g206c` (hoặc đặt lại bộ lọc cũ `sheet_*`... theo tài liệu), đồng bộ lại workspace từ commit trước.

## Tắt khẩn cấp kênh Telegram

Anh Khải tự làm. Lệnh OpenClaw chạy trong `~/apps/openclaw`. Có ba mức, từ nhẹ đến nặng; mỗi mức ghi rõ đã kiểm chứng chưa.

### Mức 1: tắt tạm (đã kiểm chứng 02/11/2026, OpenClaw 2026.10.3)

```bash
cd ~/apps/openclaw
docker compose exec -T openclaw-gateway node dist/index.js config set channels.telegram.enabled false --strict-json < /dev/null
```

Dấu `<` ở cuối lệnh là chuyển hướng stdin thật (để `docker compose exec` không treo chờ nhập), không phải chỗ điền giá trị; gõ nguyên văn.

Trạng thái chuyển thành `disabled, configured, stopped` và bot không trả lời. Token và danh sách cho phép giữ nguyên. Bật lại bằng cùng lệnh với `true` thay cho `false`, rồi kiểm tra:

```bash
docker compose exec -T openclaw-gateway node dist/index.js channels status --probe < /dev/null
```

Kỳ vọng: `enabled, configured, running, connected`.

### Mức 2: cắt hẳn khi nghi lộ token (đã làm thật ngày 31/10/2026)

1. Gửi `/revoke` cho @BotFather, chọn bot. Token cũ hết hiệu lực ngay.
2. Ghi token mới vào `~/.openclaw/telegram-token.txt` bằng `read -rs` (không gõ token vào lệnh, không dán vào chat).

### Mức 3: gỡ tài khoản kênh (chưa thử, suy luận từ trợ giúp; chưa kiểm chứng hành vi)

- `channels remove --channel telegram`: chỉ tắt.
- Thêm `--delete`: xóa mục cấu hình, không hỏi lại.

Sao lưu trước: `cp -p ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.truoc-go-telegram`.

Tin gửi lúc kênh tắt có được xử lý lại sau khi bật hay không: chưa kiểm chứng.
