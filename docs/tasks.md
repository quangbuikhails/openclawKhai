# tasks — Danh sách việc

> Mỗi lần giao cho agent đúng một task. Agent chỉ đánh `[x]` khi đã chạy bước "Kiểm chứng" và dán kết quả.
> Mã task: `G<gói>-<số>`. Commit theo dạng `feat(goi1): ...`.
> Xong task: thêm dòng `Ghi nhận:` ngay dưới task (ngày; phiên bản OpenClaw nếu liên quan; lỗi đáng nhớ). Đây là nơi duy nhất ghi kết quả, không tạo tệp nhật ký riêng.

## Đang làm

_(chưa có)_

## Gói 1 — Hạ tầng

- [ ] **G1-00 Chuẩn bị máy và tài khoản** _(anh Khải tự làm)_
  - Làm: bật WSL2 + Ubuntu (`wsl --install`); cài Docker Desktop, bật WSL Integration cho Ubuntu; cài Git trong Ubuntu; đặt máy không tự ngủ khi cắm điện. Tạo lịch Google "Công việc" và bảng tính trống "Khải Phiên Bản Số – Biểu theo dõi". Chuẩn bị tài khoản Zalo phụ (cho Gói 3).
  - Kiểm chứng: trong Ubuntu, `docker --version`, `docker compose version`, `git --version` đều chạy; `docker run --rm hello-world` thành công.

- [ ] **G1-01 Khởi tạo repo**
  - Làm: đặt repo tại `~/projects/khai-phien-ban-so`; `git init`; tạo `.gitignore` (đã có mẫu); commit các tệp `AGENTS.md`, `CLAUDE.md`, `docs/`.
  - Kiểm chứng: `git status` sạch; `git check-ignore .env secrets/x tmp/x` trả về cả ba đường dẫn.

- [x] **G1-02 Cài OpenClaw bằng Docker và đăng nhập Codex** _(anh Khải tự chạy; agent chỉ hướng dẫn và đọc log)_
  - Làm: theo hướng dẫn cài đặt đã có; OpenClaw nằm ở `~/apps/openclaw`.
  - Kiểm chứng: `curl -fsS http://127.0.0.1:28789/healthz` thành công; `docker compose exec openclaw-gateway node dist/index.js models list` có mô hình Codex.
  - Ghi nhận: 15/10/2026; OpenClaw 2026.10.3 (59cb447), image `ghcr.io/openclaw/openclaw:latest`; cài theo D19 (tên dự án `khai-pbs`, cổng 28789/28790/28978, khóa `127.0.0.1`); đăng nhập Codex bằng device code, mô hình mặc định `openai/gpt-6-astra`, `models list` có Auth yes; `openclaw-bot` (bản cũ) vẫn chạy. Lỗi đáng nhớ: chạy công cụ dòng lệnh ngay sau khi Gateway khởi động báo GatewayLockNamespaceError (chờ 90 giây hoặc dùng `exec`); cảnh báo "Failed to reset agents.defaults.sandbox.mode to off" cần kiểm tra lại. Kênh chat và tìm kiếm web bỏ qua, làm sau.

- [x] **G1-03 Ghi lại cấu hình mẫu vào repo**
  - Làm: sao chép phần cấu hình (đã xóa token, mật khẩu) vào `deploy/`, kèm `deploy/README.md` ngắn ghi cách áp dụng. Cố định `OPENCLAW_IMAGE` theo phiên bản đang chạy (PLAN.md mục 6), ghi dòng đầu vào bảng phiên bản.
  - Kiểm chứng: `git grep -nIiE "token|password|secret|cookie"` chỉ ra chỗ giữ chỗ như `<ĐIỀN_TOKEN>`, không có giá trị thật.
  - Ghi nhận: 15/10/2026; OpenClaw 2026.10.3 (59cb447), digest `sha256:70b8dbd2…`, bổ sung vào dòng sẵn có của bảng phiên bản. Cố định theo digest vì chưa kiểm chứng tên nhãn image trên ghcr.io. `.env` thật vẫn để `latest`, anh Khải tự đổi theo `deploy/README.md`.
  - Hoàn tất 15/10/2026: đã ghim OPENCLAW_IMAGE theo digest sha256:70b8dbd2… trong ~/apps/openclaw/.env (thay cho latest nêu ở dòng trên); docker compose up -d openclaw-gateway tạo lại container; healthz trả ok, container healthy sau 1-3 phút khởi động (lần curl đầu bị reset do chưa sẵn sàng); openclaw-bot và 9router-bot vẫn chạy bình thường.

- [ ] **G1-04 Viết SOUL.md và AGENTS.md cho trợ lý**
  - Làm: tạo `openclaw-workspace/SOUL.md` (giọng văn, xưng hô, nguyên tắc riêng tư, tự giới thiệu là trợ lý AI) và `openclaw-workspace/AGENTS.md` (việc được làm, không được làm), dựa trên bản nháp `ban-nhap/SOUL.md`, `ban-nhap/AGENTS-tro-ly.md` (anh Khải đưa vào khi giao task). Đối chiếu tài liệu OpenClaw, trình cách gắn workspace để chốt C9.
  - Kiểm chứng: gắn workspace vào OpenClaw; chạy các câu thử SPEC mục 7.1 làm được trên Control UI, dán câu hỏi và câu trả lời; anh Khải duyệt giọng văn.

- [ ] **G1-05 Kiểm tra bảo mật**
  - Làm: chạy kiểm tra bảo mật của OpenClaw; rà soát thư mục được mount vào container.
  - Kiểm chứng: dán kết quả; liệt kê các mount; không có cảnh báo mức cao chưa xử lý.

- [ ] **G1-06 Script kiểm tra sau triển khai**
  - Làm: `scripts/post-deploy-check.sh` chạy phần lệnh của SPEC mục 7.3 (`healthz`, `channels status --probe`, `models status --check`), in rõ ĐẠT/KHÔNG ĐẠT từng bước; không in token.
  - Kiểm chứng: chạy script khi Gateway đang chạy → toàn bộ ĐẠT; tắt Gateway rồi chạy lại → báo KHÔNG ĐẠT đúng bước; dán cả hai đầu ra.

## Gói 2 — Ra lệnh, công việc, lịch hẹn, nhắc nhở

> Trước khi bắt đầu: chốt C1, C2, C4, C8, C11 trong PLAN.md (C3 đã chốt thành D14).
> Task nào sửa skill: chạy lại phần tương ứng của bộ kiểm thử hồi quy (SPEC mục 7) trước khi báo xong.
> Bản nháp skill `cong-viec`, `lich-hen`, `nhac-viec` trong `ban-nhap/skills/` là đầu vào khi lập chi tiết G2-04 → G2-06.

- [ ] **G2-01 Khảo sát cách kết nối Google** — trình 2–3 phương án cho C1, C2 (ưu, nhược, các bước anh Khải phải làm). Không viết code.
- [ ] **G2-02 Kết nối bot Zalo chính thức, giới hạn chỉ chủ ra lệnh**
- [ ] **G2-03 Kết nối Telegram làm kênh dự phòng**
- [ ] **G2-04 Biểu theo dõi và skill công việc** — tạo biểu 14 cột theo PLAN.md mục 4 (kèm công thức Ngày nhắc việc, danh sách thả xuống, định dạng màu, trang `log`); skill thêm, xem, cập nhật trên biểu; kiểm chứng CV1–CV7, NV2, NV3.
- [ ] **G2-05 Skill lịch hẹn: thêm (có xác nhận), xem trên Google Calendar**
- [ ] **G2-06 Nhắc việc** — nhắc theo Ngày nhắc việc (D15), tạo và cập nhật sự kiện [Nhắc], [Hạn] trên Calendar (D17), nhắc trước giờ hẹn, bản tin đầu ngày, nhắc việc quá hạn.
- [ ] **G2-07 Chạy thử 3 ngày, đối chiếu tiêu chí nghiệm thu Gói 2 trong SPEC.md; đạt thì triển khai theo PLAN.md mục 6 với nhãn `goi2-v1`**

_(Chi tiết "Làm" và "Kiểm chứng" của từng task Gói 2 được bổ sung sau khi G2-01 được duyệt.)_

## Gói 2C — Tiếp nhận văn bản giao việc

> Bắt đầu sau khi Gói 2 nghiệm thu. Trước G2C-02: chốt C17; C2 phải gồm quyền ghi thư mục Drive riêng.
> Bản nháp skill `tiep-nhan-van-ban` trong `ban-nhap/skills/` là đầu vào.

- [ ] **G2C-01 Khảo sát** — không viết code. Trình: bot Zalo và Telegram nhận ảnh, PDF, Word đến dung lượng bao nhiêu; trợ lý đọc ảnh, PDF scan, tệp Word bằng cách nào (C17); thử bóc tách 3 văn bản mẫu thông thường do anh Khải chọn, so với đọc tay; cách tải tệp lên Drive theo quyền đã chốt ở C2.
- [ ] **G2C-02 Skill tiếp nhận văn bản** — đọc, bóc tách, gửi dòng đề xuất, chờ xác nhận; dừng khi thấy dấu độ mật; hỏi khi trùng Số ký hiệu; kiểm chứng TV1, TV3, TV5, TV6.
- [ ] **G2C-03 Lưu tệp lên Drive, ghi biểu, tạo sự kiện lịch sau khi xác nhận** — theo quy tắc tên tệp, thư mục ở PLAN.md mục 4; kiểm chứng TV2, TV4.
- [ ] **G2C-04 Cập nhật qua chat** — "xong văn bản …", "dời hạn …", "chờ ý kiến …" cập nhật biểu và lịch sau khi xác nhận.
- [ ] **G2C-05 Chạy thử 1 tuần với văn bản thật (chỉ văn bản thông thường), nghiệm thu Gói 2C, triển khai với nhãn `goi2c-v1`**

## Gói 4 — Web app: Biểu theo dõi, Lịch, Kanban

> Bắt đầu sau Gói 2C (D7). Trước G4-02: chốt C6, C16. Giao diện theo bản thiết kế (PLAN.md mục 7).

- [ ] **G4-01 Khảo sát và kế hoạch** — không viết code. Trình: cấu trúc web app và máy chủ nhỏ đọc, ghi Sheets, Calendar (C6); cách đăng nhập; phương án truy cập từ điện thoại (C16) kèm các bước anh Khải phải làm.
- [ ] **G4-02 Biểu theo dõi trên web** — bảng 14 cột, lọc, tô màu, mở tệp Drive.
- [ ] **G4-03 Kanban** — 4 cột theo D16, kéo thẻ đổi trạng thái trên Sheets, ghi `log`.
- [ ] **G4-04 Lịch công việc** — lịch tháng, tuần từ biểu và lịch hẹn.
- [ ] **G4-05 Truy cập từ điện thoại theo C16** — kiểm tra không vào được từ mạng ngoài khi không có quyền.
- [ ] **G4-06 Màn quản lý kênh** (Zalo phụ, Telegram) và các màn còn lại — lập chi tiết khi tới.
- [ ] **G4-07 Nghiệm thu Gói 4 theo SPEC, triển khai với nhãn `goi4-v1`**

## Gói 2B — Hỏi đáp mở rộng (chỉ cho chủ)

> Bắt đầu sau khi Gói 4 nghiệm thu (D7). Trước G2B-02: chốt C12–C15.

- [ ] **G2B-01 Khảo sát** — không viết code. Trình: cách bật tìm kiếm web theo C12; image OpenClaw đang chạy có Python/Node và thư viện tạo .docx không (C13); bot Zalo và Telegram có gửi được tệp .docx và ảnh không, giới hạn dung lượng; cách chặn các công cụ này với người không phải chủ (tool policy) để dùng cho Gói 3.
- [ ] **G2B-02 Bật tra cứu web và quy tắc dẫn nguồn** — cập nhật `openclaw-workspace/AGENTS.md` của trợ lý; kiểm chứng CB1, CB2, CB5.
- [ ] **G2B-03 Bật tạo ảnh** — theo C14; kiểm chứng CB4.
- [ ] **G2B-04 Skill tạo tệp Word** — theo C13, C15; kiểm chứng CB3.
- [ ] **G2B-05 Chạy lại toàn bộ bộ kiểm thử hồi quy, nghiệm thu Gói 2B, triển khai với nhãn `goi2b-v1`**

## Gói 3

_(Lập danh sách task khi bắt đầu gói.)_

## Phát sinh

> Agent ghi ở đây những việc phát hiện ngoài phạm vi task đang làm. Anh Khải quyết định có đưa vào danh sách hay không.
> Sự cố khi chạy thật ghi theo mẫu 4 dòng:
> `Sự cố dd/mm:` hiện tượng · `Nguyên nhân:` … · `Đã khắc phục:` … · `Task mới:` mã task hoặc "không cần".

- (Đề xuất, xem xét sau Gói 2) Việc định kỳ tự kiểm tra kênh và hạn đăng nhập Codex, báo qua Telegram khi có lỗi.
