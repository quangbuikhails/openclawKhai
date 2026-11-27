# AGENTS.md — Dự án Khải Phiên Bản Số

Chỉ dẫn cho agent lập trình (Codex, Claude Code). Đọc hết trước khi làm bất kỳ task nào.

## Dự án là gì

**Khải Phiên Bản Số**: trợ lý AI cá nhân của anh Khải (thư mục repo `khai-phien-ban-so`), chạy trên OpenClaw (Docker, "bộ não" Codex đăng nhập qua OAuth ChatGPT).
Nhận lệnh qua bot Zalo chính thức (kênh chính) và Telegram (kênh dự phòng); tiếp nhận văn bản giao việc (ảnh, PDF, Word) và bóc tách vào biểu theo dõi trên Google Sheets,
tệp gốc trên Google Drive, lịch trên Google Calendar; nhắc việc chủ động. Web app quản lý gồm Biểu theo dõi, Lịch, Kanban. Giai đoạn sau: chatbot mở rộng và trả lời thay qua Zalo cá nhân
(tài khoản phụ, có hàng chờ duyệt).

- Yêu cầu, tiêu chí nghiệm thu: `docs/SPEC.md`
- Kiến trúc, quyết định, mục còn phải chốt: `docs/PLAN.md`
- Việc đang làm và cách kiểm chứng: `docs/tasks.md`

## Môi trường

- Windows + Docker Desktop (WSL2); thao tác trong Ubuntu WSL.
- OpenClaw cài riêng tại `~/apps/openclaw`, KHÔNG nằm trong repo này. Repo chỉ chứa cấu hình mẫu, workspace của trợ lý, skill, script, web app.
- Lệnh OpenClaw khi Gateway đang chạy: đứng trong `~/apps/openclaw`, gõ `docker compose exec openclaw-gateway node dist/index.js <lệnh>` (đã kiểm chứng với `models list`). `docker compose run --rm openclaw-cli <lệnh>` từng bị chặn ở lần cài đầu (GatewayLockNamespaceError); ngày 05/11/2026 chạy được với `automations runs` khi Gateway đang chạy, có cảnh báo orphan `khai-mcp-google`: không dùng `--remove-orphans`.
- Kiểm tra Gateway: `curl -fsS http://127.0.0.1:28789/healthz`. Cổng 18789 và container `openclaw-bot`, `9router-bot` là việc khác của anh Khải: không dừng, không xóa, không chạy lệnh Docker trong thư mục của chúng; không sửa `COMPOSE_PROJECT_NAME=khai-pbs` trong `.env` (PLAN.md D19).
- Repo đặt trong ổ Ubuntu WSL (ví dụ `~/projects/khai-phien-ban-so`), không đặt ở `/mnt/c/...`.
- OpenClaw đổi lệnh và khóa cấu hình thường xuyên: lệnh hoặc khóa chưa từng dùng trong repo phải đối chiếu https://docs.openclaw.ai trước; không đoán.

## Cách làm việc (bắt buộc)

1. Chỉ làm task được giao trong `docs/tasks.md`. Thấy việc khác cần làm thì ghi vào mục "Phát sinh" của tasks.md, không tự làm.
2. Task sửa từ 3 tệp trở lên hoặc chưa rõ cách làm: trình kế hoạch ngắn (tệp nào, sửa gì, kiểm chứng ra sao) và chờ duyệt.
3. Yêu cầu thiếu hoặc mâu thuẫn: hỏi lại, không đoán. Mục ghi `[CẦN CHỐT]` trong PLAN.md thì không tự quyết.
4. Xong task: chạy đúng bước "Kiểm chứng" ghi trong task, dán lệnh và đầu ra thực tế. Chưa chạy thì không báo "đã xong".
5. Task có sửa `openclaw-workspace/` (SOUL, AGENTS của trợ lý, skill): trước khi báo xong phải chạy phần tương ứng của bộ kiểm thử hồi quy (SPEC mục 7) và dán kết quả.
6. Đánh dấu `[x]` trong tasks.md, thêm một dòng `Ghi nhận:` dưới task (ngày; phiên bản OpenClaw nếu liên quan; lỗi đáng nhớ), đề xuất commit message. Không tự push, không tự sửa lịch sử git.
7. Push (D50): sau MỖI lần commit, câu trả lời phải kết thúc bằng đúng khối nhắc sau, không được bỏ qua:

   ```
   NHẮC PUSH: anh chạy lệnh
   git push
   rồi dán dòng kết quả (dạng ...  main -> main) để tôi xác nhận.
   ```

   Chỉ coi một task là hoàn tất sau khi anh Khải đã xác nhận push xong (dán dòng kết quả). Agent vẫn không tự push.
8. Đầu phiên: chạy `git status -sb`; nếu local đi trước `origin/main` (có commit chưa push) thì nhắc anh Khải push ngay, trước khi làm việc khác.

## Chống rác

- Trước khi tạo tệp hoặc hàm mới: tìm trong repo xem đã có chức năng tương tự chưa; có thì dùng lại hoặc sửa.
- KHÔNG tạo bản sao kiểu `*_v2`, `*_new`, `*_old`, `*_backup`, `*.bak`. Sửa trực tiếp; git giữ lịch sử.
- KHÔNG tạo tệp .md báo cáo, tóm tắt, ghi chú sau mỗi task. Tài liệu dự án chỉ gồm các tệp đang có trong `docs/`.
- Thay thế code cũ thì xóa luôn code, import, cấu hình không còn dùng trong cùng thay đổi.
- KHÔNG thêm thư viện, package, Docker image mới khi chưa hỏi; khi đề xuất phải nêu lý do và phương án không cần thêm.
- Tệp thử nghiệm để trong `tmp/` (đã gitignore) và xóa khi xong task.
- Không sửa ngoài phạm vi task; không định dạng lại cả tệp khi chỉ sửa vài dòng.

## Bảo mật (không có ngoại lệ)

- Không ghi bí mật (token, mật khẩu, khóa API, cookie/phiên đăng nhập Zalo, credentials Google) vào mã nguồn, tài liệu, log, commit. Bí mật chỉ nằm trong `.env` hoặc `secrets/` (đã gitignore).
- Không mount thư mục tài liệu cơ quan hay cả ổ đĩa vào container; chỉ mount thư mục thật sự cần.
- Không mở cổng Gateway ra ngoài `127.0.0.1` khi PLAN.md chưa có quyết định.
- Không đổi `OPENCLAW_IMAGE` sang `latest` hay tự nâng phiên bản; nâng phiên bản theo quy trình PLAN.md mục 6.
- Chỉ văn bản thông thường được đưa vào hệ thống (PLAN.md D13); không dùng văn bản mật làm dữ liệu thử. Tin nhắc trợ lý gửi qua Zalo/Telegram chỉ chứa trích yếu, số ký hiệu, hạn; không chép toàn văn văn bản.
- Thư mục Drive của dự án không chia sẻ cho ai; quyền Google chỉ cấp trên đúng lịch, bảng tính, thư mục của dự án.
- Không tự chạy lệnh xóa dữ liệu (`docker volume rm`, `rm -rf`, xóa dòng Sheets, xóa sự kiện Calendar thật) khi chưa hỏi. Kiểm thử thì dùng dữ liệu có tiền tố `[TEST]` và tự dọn sau đó.

## Hai loại AGENTS.md — không được nhầm

- `./AGENTS.md` (tệp này): quy tắc lập trình.
- `openclaw-workspace/AGENTS.md`, `openclaw-workspace/SOUL.md`: chỉ dẫn cho trợ lý lúc chạy. Đây là sản phẩm của dự án, chỉ sửa khi task yêu cầu; không coi là quy tắc lập trình.
- Luôn khởi chạy agent lập trình từ thư mục gốc của repo.

## Cấu trúc thư mục

```
khai-phien-ban-so/
├── AGENTS.md / CLAUDE.md
├── docs/                 SPEC.md, PLAN.md, tasks.md, WORKFLOW.md
├── deploy/               cấu hình mẫu OpenClaw, docker compose override (không chứa bí mật)
├── openclaw-workspace/   AGENTS.md, SOUL.md của trợ lý; skills/
├── scripts/              script kiểm tra, sao lưu, kết nối Google
├── mcp-google/           server MCP Google (Sheets, Calendar) chạy container riêng (D21)
├── mcp-kho/              server MCP chỉ đọc kho tri thức, container riêng (D21, D56)
├── web-admin/            web app quản lý (Gói 4)
├── secrets/  .env        bí mật — gitignore
└── tmp/                  tệp tạm — gitignore
```

Chỉ tạo thư mục khi có task cần đến nó.

## Quy ước

- Giao tiếp, comment, tài liệu: tiếng Việt có dấu. Tên tệp, biến, hàm: tiếng Anh.
- Lời trợ lý gửi người dùng: tiếng Việt, lịch sự, ngắn gọn.
- Thời gian: múi giờ `Asia/Ho_Chi_Minh`, hiển thị `dd/mm/yyyy HH:mm`.
- Commit theo Conventional Commits, phạm vi theo gói: `feat(goi2): thêm skill quản lý việc`, `fix(goi1): ...`, `docs: ...`, `chore: ...`.
