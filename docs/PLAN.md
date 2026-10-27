# PLAN — Kiến trúc và quyết định

> Ghi các quyết định kỹ thuật đã chốt và các mục còn chờ chốt.
> Agent không tự quyết các mục `[CẦN CHỐT]`; khi một mục được chốt, chuyển nó xuống bảng "Quyết định đã chốt".

## 1. Kiến trúc tổng thể

```
Bot Zalo chính thức ─┐
Telegram (dự phòng) ─┼─► OpenClaw Gateway (Docker, 127.0.0.1:28789) ─► Codex (OAuth ChatGPT)
Zalo cá nhân (Gói 3) ┘            │
                                  ├─► Google Sheets  (biểu theo dõi: nguồn dữ liệu gốc)
                                  ├─► Google Drive   (tệp văn bản gốc, Gói 2C)
                                  ├─► Google Calendar (lịch hẹn; sự kiện [Nhắc], [Hạn])
                                  └─► Bộ lập lịch của OpenClaw (nhắc nhở, bản tin đầu ngày)

Web app (Gói 4: Biểu, Lịch, Kanban) ─► Google Sheets / Calendar (đọc, ghi) và Gateway (trạng thái kênh)
Điện thoại ─► web app qua mạng riêng (C16), không qua Internet công cộng
```

- OpenClaw cài tại `~/apps/openclaw` (trong ổ Ubuntu WSL, không đặt ở `/mnt/c/...`). Cấu hình và workspace của trợ lý nằm ở `~/.openclaw` (ngoài repo, không commit).
- Máy anh Khải còn một bản OpenClaw khác phục vụ việc riêng (container `openclaw-bot`, mã nguồn ở `D:\bot\docker\openclaw`) và container `9router-bot`. Hai thứ này không thuộc dự án: không dừng, không xóa, không chạy lệnh Docker trong thư mục của chúng, không dùng chung token bot Telegram/Zalo (D19).
- Repo `khai-phien-ban-so` chứa phần riêng của dự án; gắn vào OpenClaw bằng cấu hình, không sửa mã nguồn OpenClaw.
- Repo đặt tại ổ Ubuntu WSL (ví dụ `~/projects/khai-phien-ban-so`). Cách gắn `openclaw-workspace/` làm workspace của trợ lý: xem D20.
- Điểm yếu đã biết: máy chạy Gateway tắt thì mọi kênh dừng; Google Calendar trên điện thoại là lớp dự phòng cho lịch hẹn.

## 2. Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Nền tảng agent: OpenClaw chạy Docker trên Windows (WSL2) | Cài gọn, cô lập với máy |
| D2 | Mô hình AI: Codex qua OAuth ChatGPT | Dùng gói ChatGPT sẵn có, không cần API key |
| D3 | Công việc lưu trên Google Sheets, lịch hẹn trên Google Calendar, tệp văn bản trên Google Drive | Xem được trên điện thoại khi trợ lý không chạy |
| D4 | Kênh chính: bot Zalo chính thức; Telegram làm dự phòng | Kênh chính thức ít rủi ro khóa tài khoản |
| D5 | Zalo cá nhân dùng tài khoản phụ, làm sau cùng (Gói 3) | Thư viện không chính thức, rủi ro cao |
| D6 | Gateway chỉ nghe trên `127.0.0.1` | Không lộ ra mạng ngoài |
| D7 | Thứ tự triển khai: Gói 1 → 2 → 2C → 4 → 2B → 3 (đổi ngày 14/10/2026) | Theo dõi văn bản giao việc là nhu cầu chính: biểu, nhắc, tiếp nhận văn bản và web app Kanban làm trước; chatbot và trả lời thay làm sau |
| D8 | Tài liệu dự án chỉ gồm AGENTS.md, CLAUDE.md và `docs/` (SPEC, PLAN, tasks, WORKFLOW); không có tệp nhật ký riêng, kết quả mỗi task ghi ở dòng `Ghi nhận` trong tasks.md | Một nguồn chỉ dẫn, chống rác tài liệu |
| D9 | Chia vai công cụ: Claude Project trên claude.ai để bàn phương án, soạn tài liệu, đọc log; Codex/Claude Code chạy trong repo để sửa tệp và kiểm chứng | Repo là nguồn gốc; tránh hai nơi cùng sửa |
| D10 | Cố định phiên bản OpenClaw; mỗi lần đưa lên chạy thật có nhãn git, kiểm tra sau triển khai và quay lui khi lỗi (mục 6) | `latest` khiến mỗi lần cập nhật nhận bản mới ngoài kiểm soát; có nhãn mới quay lui được |
| D11 | Bộ kiểm thử hồi quy (SPEC mục 7) chạy lại sau mọi thay đổi hành vi của trợ lý | Sửa một câu chỉ dẫn có thể đổi hành vi ở chỗ khác |
| D12 | Tên sản phẩm: Khải Phiên Bản Số; thư mục repo `khai-phien-ban-so` (thay cho Zalo Agent / `zalo-agent`) | Anh Khải chốt ngày 13/10/2026 |
| D13 | Được gửi văn bản thông thường (không mật) cho trợ lý qua cả bot Zalo và Telegram; văn bản Mật, Tối mật, Tuyệt mật tuyệt đối không | Anh Khải chốt 14/10/2026, cam kết tự kiểm soát; chấp nhận Telegram không mã hóa đầu cuối |
| D14 | Biểu theo dõi 14 cột (mục 4), thay cho bảng 10 cột đề xuất trước; người phụ trách mặc định là anh Khải; văn bản nhiều nhiệm vụ ghi một dòng, liệt kê nhiệm vụ ở Ghi chú | Anh Khải chốt 14/10/2026 (thay C3) |
| D15 | Ngày nhắc việc = Hạn hoàn thành − 3 ngày (trống thì theo Thời hạn trong văn bản); rơi vào thứ Bảy, Chủ nhật thì lùi về thứ Sáu | Anh Khải chốt 14/10/2026 |
| D16 | Kanban 4 cột: Chưa xử lý, Đang xử lý, Chờ ý kiến, Đã xong; Hủy ẩn | Anh Khải chốt 14/10/2026 |
| D17 | Mỗi việc có hạn tạo hai sự kiện cả ngày trên lịch "Công việc": [Nhắc] và [Hạn] | Điện thoại vẫn báo khi máy chạy trợ lý tắt; anh Khải đồng ý 14/10/2026 |
| D18 | Web app xem và thao tác được trên điện thoại, qua mạng riêng, không mở ra Internet công cộng (cách cụ thể: C16) | Anh Khải đồng ý 14/10/2026 |
| D19 | Bản OpenClaw của dự án chạy cách ly với bản đang có sẵn trên máy: tên dự án Compose `khai-pbs` (ghi trong `~/apps/openclaw/.env`); Gateway `127.0.0.1:28789`, cầu nối `127.0.0.1:28790`, MS Teams `127.0.0.1:28978`; `docker-compose.yml` đã thêm `127.0.0.1:` vào cả ba cổng (tệp gốc lưu ở `docker-compose.yml.bak`); đăng nhập Codex riêng; bot Telegram/Zalo riêng | Anh Khải đồng ý 15/10/2026; cài xong và kiểm tra 15/10/2026 (G1-02) |
| D20 | Gắn `openclaw-workspace/` vào OpenClaw bằng script chép một chiều (`scripts/dong-bo-workspace.sh`) từ repo sang `~/.openclaw/workspace`, không mount trực tiếp. Script chỉ chép `SOUL.md`, `AGENTS.md`, `skills/`; không ghi đè `USER.md`, `IDENTITY.md`, `BOOTSTRAP.md`, bộ nhớ và `.git/` của workspace; có `--dry-run`. Quay lui: `git checkout <nhãn cũ> -- openclaw-workspace/` rồi chạy lại script (mục 6) | Workspace thật hiện có git riêng và `USER.md` (theo anh Khải, 16/10/2026); `MEMORY.md`, `memory/` sẽ phát sinh khi chạy. Mount trực tiếp sẽ trộn hai lịch sử git và để trợ lý tự sửa thẳng vào repo; chép một chiều giữ repo sạch, xem được `diff` trước khi ghi. Trang https://docs.openclaw.ai/concepts/agent-workspace (đọc 16/10/2026) không nói gì về mount | Anh Khải chốt 16/10/2026 (G1-04) |
| D21 | C1: trợ lý đọc, ghi Google Sheets và Calendar qua một server MCP nhỏ do dự án tự viết, chạy ở container riêng trong mạng Docker `khai-pbs` (HTTP, không mở cổng ra ngoài); khóa Google chỉ mount vào container này và nằm ở `secrets/`, Gateway không giữ khóa. Điều kiện: spike G2-01B xác nhận runtime Codex gọi được công cụ MCP khi `exec` bị deny; không đạt thì quay lại bàn. Image, package cụ thể phải trình và được anh duyệt trước khi thêm (AGENTS.md). Mã dùng lại được cho web app Gói 4 | Khóa Google không nằm cùng chỗ với trợ lý còn `functions.exec` (C18); mã tự viết đọc hết được, chỉ có đúng các thao tác cần Spike G2-01B xác nhận 19/10/2026 (điều kiện đạt). | Anh Khải chốt 19/10/2026 (thay C1) |
| D22 | C4: nhắc trước giờ hẹn 30 phút; bản tin đầu ngày 07:30 thứ Hai đến thứ Sáu (lịch hôm nay, việc đến hạn, việc quá hạn gộp chung); không có tổng kết tuần; Telegram chỉ nhận tin chủ động khi bot Zalo gửi lỗi | Đỡ trùng tin, đúng nhịp làm việc cơ quan | Anh Khải chốt 19/10/2026 (thay C4) |
| D23 | C8: thêm, sửa, hủy việc và lịch hẹn: nhắc lại và chờ chủ xác nhận rồi mới ghi; ổn định thì xét lại cho phép ghi ngay kèm hoàn tác | Hiểu sai ngày giờ là lỗi hay gặp; spike G2-01B cho thấy trợ lý tự hỏi xác nhận đúng cách | Anh Khải chốt 19/10/2026 (thay C8) |
| D25 | Luật ghi trên Google Calendar (thay luật tiền tố `[TEST]` của spike): mọi sự kiện server tạo mang `extendedProperties.private.owner="khai-pbs"`; sửa, dời, xóa chỉ cho sự kiện có dấu này, kiểm ở server trước khi ghi, ở cả test lẫn prod; sự kiện chủ tự tạo chỉ đọc. Không công cụ nào nhận ID lịch (lịch cố định theo `CALENDAR_ID` trong env). `cal_list` chỉ trả tiêu đề, giờ và `by_assistant`, không trả mô tả, địa điểm, người tham dự. Tạo sự kiện có giờ kiểm trùng giờ trước (chỉ tính sự kiện có giờ), trùng thì từ chối trừ khi chủ xác nhận lại. Nhắc đặt ở cấp lịch (thông báo mặc định của lịch "Công việc"), không đặt trên sự kiện | Quyền chia sẻ lịch của Google không hạn chế theo từng sự kiện, nên Service Account sửa được cả sự kiện chủ tự tạo nếu server không chặn; dấu `owner` mô hình không đặt được. Nhắc đặt riêng trên từng sự kiện qua API không hiển thị cho chủ lịch (kiểm chứng 20/10/2026), nên bỏ; chuông theo D26 | Anh Khải chốt 20/10/2026 (G2-05) |
| D24 | C11: chỉ số đo kết quả: không việc nào có hạn bị quá hạn mà chưa được nhắc trước ít nhất 1 ngày; thêm một việc qua Zalo dưới 30 giây; đo 4 tuần dùng thật sau nghiệm thu Gói 2 | Theo SPEC mục 1 | Anh Khải chốt 19/10/2026 (thay C11) |
| D26 | C2: dùng Service Account `khai-mcp-google` cho Sheets và Calendar (khóa chỉ nằm ở `secrets/` và container `khai-mcp-google`); chuông nhắc theo thông báo mặc định cấp lịch "Công việc" (sự kiện có giờ: 30 phút trước; cả ngày: 09:00), công cụ `cal_*` không đặt nhắc riêng. Drive (Gói 2C) vẫn quyết ở G2C-01, nhiều khả năng cần OAuth `drive.file` | Kết quả phép thử: (1) 20/10/2026: sự kiện do Service Account tạo hiện trên Google Calendar iPhone và báo theo mốc thông báo mặc định của lịch; nhắc đặt riêng trên từng sự kiện qua API không hiển thị cho chủ lịch. (2) 27/10/2026, sau khi gỡ nhắc riêng khỏi server (commit 3715175), sự kiện `[TEST]` bắt đầu 16:31, mốc mặc định của lịch "trước 2 phút": iPhone khóa màn hình có chuông lúc 16:29 và hiện ngoài màn hình khóa; lịch lúc đó còn mốc "vào thời điểm diễn ra sự kiện" nên báo thêm lúc 16:31. (3) Cùng ngày, sự kiện bắt đầu 11:09: Chrome (tab Google Lịch mở) báo, iPhone không báo; nguyên nhân chưa xác định (nghi iPhone chưa đồng bộ khi chưa mở ứng dụng), kiểm chứng lại ở G2-06 bằng sự kiện tạo khi ứng dụng không mở vài giờ. Đã dọn thông báo mặc định lịch `[TEST]` chỉ còn 30 phút trước (có giờ) và 09:00 (cả ngày) | Anh Khải chốt 27/10/2026 (thay C2, G2-05) |

## 3. Mục cần chốt

| # | Nội dung | Gói | Ghi chú |
|---|---|---|---|
| C5 | Danh sách người được trả lời và quy tắc vào hàng chờ duyệt | 3 | |
| C6 | Công nghệ, xác thực của web app; cách web app ghi vào Sheets khi kéo thẻ Kanban | 4 | Mặc định dự kiến React + Vite; một máy chủ nhỏ chạy cùng máy, dùng chung thông tin xác thực Google ở `secrets/`, trình duyệt không giữ khóa Google; có đăng nhập |
| C7 | Có chuyển lên VPS để chạy liên tục không | Sau 2 | |
| C10 | Gói 3: có trả lời trong nhóm không | 3 | Đề xuất: tắt; nếu bật thì chỉ nhóm được chọn, chỉ khi được nhắc tên |
| C12 | Nhà cung cấp tìm kiếm web | 2B | Tài liệu OpenClaw: DuckDuckGo không cần khóa nhưng là tích hợp thử nghiệm, không chính thức, có thể hỏng hoặc bị chặn; Brave Search dùng API (cần khóa) được khuyến nghị cho dùng thật. Đề xuất: thử DuckDuckGo, hay hỏng thì chuyển Brave (chi phí cần kiểm chứng) |
| C13 | Cách tạo tệp Word | 2B | OpenClaw không có công cụ tạo .docx dựng sẵn. Đề xuất: một skill gọi script cố định trong workspace (không cho trợ lý chạy lệnh tùy ý); cần kiểm chứng image OpenClaw có sẵn Python/Node và thư viện tạo .docx hay phải thêm (thêm phụ thuộc phải duyệt) |
| C14 | Nhà cung cấp tạo ảnh | 2B | Tài liệu OpenClaw: công cụ `image_generate` dùng được OpenAI qua đăng nhập ChatGPT/Codex, không cần khóa riêng, nhưng dùng chung hạn mức. Đề xuất: dùng OpenAI qua OAuth |
| C15 | Giới hạn thư mục trợ lý được đọc, gửi tệp (`tools.fs.workspaceOnly`) | 2B | Mặc định `false`: trợ lý gửi được mọi tệp nó đọc được. Đề xuất: `true` để chỉ gửi tệp trong workspace và thư mục tạm |
| C16 | Cách mở web app từ điện thoại | 4 | Phương án: (a) mạng riêng ảo Tailscale giữa máy chạy trợ lý và điện thoại, không mở cổng nào ra Internet (đề xuất); (b) đường hầm Cloudflare Tunnel kèm lớp đăng nhập Cloudflare Access; (c) mở cổng trên router: không dùng. Chi tiết, chi phí cần kiểm chứng khi làm |
| C17 | Đọc tệp Word, PDF scan trong OpenClaw: dùng khả năng đọc tệp sẵn có hay script chuyển đổi riêng | 2C | Cần khảo sát ở G2C-01; bot Zalo mặc định nhận tệp ≤ 5 MB |
| C18 | Xử lý `functions.exec`/`functions.wait` của trợ lý (không loại được bằng `deny`, `profile`, `tools.allow`) | Trước G2-02 | Phương án: (a) thử `tools.exec.mode` = `ask`/`auto` rồi kiểm chứng; (b) nối kênh mà chấp nhận rủi ro, chỉ chủ ra lệnh, văn bản thông thường; (c) tra thêm sandbox OpenClaw khi Gateway chạy trong Docker. Đề xuất: (a) trước, không nối kênh khi chưa quyết **Cập nhật 19/10/2026:** `functions.exec` là Code Mode mà công cụ MCP đi qua; tắt nó sẽ mất MCP (D21). Phương án (a) `tools.exec.mode` vẫn chưa thử. |
| C19 | Bot Zalo cũ (`openclaw-bot`) dùng bot Zalo nào; bot của dự án phải riêng, không dùng chung token | Trước G2-02 | Anh Khải xác định bot cũ dùng loại và token nào |

## 4. Biểu theo dõi công việc (đã chốt D14)

Bảng tính "Khải Phiên Bản Số – Biểu theo dõi", trang `bieu`. Tiêu đề cột hiển thị tiếng Việt (anh xem, sửa trên điện thoại); mã cột tiếng Anh dùng trong mã nguồn.

| # | Tiêu đề cột | Mã cột | Kiểu, giá trị | Ai điền |
|---|---|---|---|---|
| 1 | STT | `stt` | Số tăng dần | Tự động |
| 2 | Ngày nhận | `received_date` | dd/mm/yyyy | Tự động (ngày gửi cho trợ lý), sửa được |
| 3 | Tên văn bản | `doc_title` | Trích yếu | Trợ lý bóc tách |
| 4 | Số ký hiệu | `doc_number` | Ví dụ 123/UBND-KT | Trợ lý bóc tách |
| 5 | Cơ quan ban hành | `issuer` | Văn bản | Trợ lý bóc tách (cột đề xuất thêm, bỏ được) |
| 6 | Nội dung cần xử lý | `action_required` | Tóm tắt việc anh phải làm | Trợ lý bóc tách, anh sửa |
| 7 | Người phụ trách | `owner` | Mặc định "Bùi Quang Khải" | Tự động |
| 8 | Hạn hoàn thành | `due_date` | dd/mm/yyyy | Anh đặt (trợ lý đề xuất) |
| 9 | Ưu tiên | `priority` | Cao / Thường | Anh đặt (trợ lý đề xuất) |
| 10 | Trạng thái | `status` | Chưa xử lý / Đang xử lý / Chờ ý kiến / Đã xong / Hủy | Mặc định "Chưa xử lý"; đổi qua chat, Kanban hoặc sửa tay |
| 11 | Ghi chú | `note` | Văn bản; văn bản nhiều nhiệm vụ thì liệt kê ở đây | Trợ lý, anh |
| 12 | Link tài liệu | `doc_link` | Link tệp trên Google Drive | Tự động |
| 13 | Thời hạn yêu cầu trong văn bản | `doc_deadline` | dd/mm/yyyy | Trợ lý bóc tách |
| 14 | Ngày nhắc việc | `remind_date` | dd/mm/yyyy | Tự động theo D15 |

Công thức Ngày nhắc việc: một công thức mảng đặt ở `N2` (Hạn hoàn thành ở cột H, Thời hạn trong văn bản ở cột M), tự tính cho mọi dòng, kể cả khi anh sửa tay hoặc thêm dòng. Máy chủ MCP không bao giờ ghi vào cột N:

```
=ARRAYFORMULA(IF((H2:H="")*(M2:M=""),"",LET(r,IF(H2:H<>"",H2:H,M2:M)-3,IF(WEEKDAY(r,2)=6,r-1,IF(WEEKDAY(r,2)=7,r-2,r)))))
```

Chưa kiểm chứng `LET` bên trong `ARRAYFORMULA` trên Sheets; nếu không chạy thì thử `MAP`/`BYROW`, phương án cuối là máy chủ ghi công thức theo từng dòng (G2-04). Bảng tính đặt ngôn ngữ Việt Nam, múi giờ `Asia/Ho_Chi_Minh`.

Trang `log` (Truy vết): `time`, `channel` (`zalo` / `telegram` / `web` / `ui`; `ui` là Control UI của OpenClaw), `action` (`them` / `sua` / `doi_trang_thai` / `doi_han` / `huy`), `stt`, `summary`.

Quy ước:
- Không xóa dòng; việc bỏ chuyển `Hủy`.
- `status`, `priority` dùng danh sách thả xuống.
- Định dạng: tô đỏ nhạt khi quá Hạn hoàn thành mà chưa `Đã xong`/`Hủy`; tô vàng nhạt khi hôm nay ≥ Ngày nhắc việc mà chưa `Đã xong`/`Hủy`. Anh sửa tay trên Sheets thì không có dòng `log` (ghi vào "Phát sinh" để Gói 4 xét).
- Việc không có văn bản (giao miệng, tự đặt) vẫn ghi vào biểu, các cột 3–5, 12, 13 để trống.

**Google Drive (Gói 2C):** thư mục riêng "Khải Phiên Bản Số/Văn bản đến/<năm>/<tháng>", không chia sẻ cho ai. Tên tệp: `<yyyy-mm-dd>_<số ký hiệu, thay / bằng ->_<trích yếu rút gọn>.<đuôi gốc>`. Nhiều ảnh của một văn bản: ghép thành một tệp PDF nếu làm được, không thì để chung một thư mục con.

**Google Calendar (D17):** sự kiện cả ngày "[Nhắc] <số ký hiệu> – <trích yếu>" vào Ngày nhắc việc và "[Hạn] …" vào Hạn hoàn thành; mô tả sự kiện ghi STT và link tệp. Đổi hạn thì dời sự kiện; Đã xong hoặc Hủy thì gỡ hai sự kiện.

## 5. Bí mật và nơi lưu

| Bí mật | Nơi lưu |
|---|---|
| Token Gateway | `~/apps/openclaw/.env` (do script cài đặt sinh ra); không in ra, không gửi vào chat |
| Đăng nhập Codex (OAuth ChatGPT) và cấu hình OpenClaw | `~/.openclaw` và thư mục bí mật xác thực `~/.openclaw-auth-profile-secrets` (mặc định của `docker-compose.yml`); ngoài repo |
| Token bot Zalo, bot Telegram | Cấu hình OpenClaw hoặc `.env`, không đưa vào repo |
| Thông tin xác thực Google | `secrets/` (gitignore) |
| Phiên đăng nhập Zalo cá nhân | Volume của OpenClaw, không sao chép ra ngoài |

## 6. Triển khai, sao lưu, quay lui

**Phiên bản cố định.** `OPENCLAW_IMAGE` trong `~/apps/openclaw/.env` cố định theo digest thay cho `latest`, dạng `ghcr.io/openclaw/openclaw@sha256:<digest>`; cách lấy digest xem `deploy/README.md` (G1-03). Bản đang chạy: 2026.10.3, mã 59cb447, digest `sha256:70b8dbd23f8d27a206f43f9828fdebc87289e50d56dc55177354c9270d764026`.

**Mỗi lần đưa lên chạy thật** (đồng bộ thư mục trợ lý hoặc nâng phiên bản OpenClaw):

1. Bộ kiểm thử hồi quy (SPEC mục 7) đạt ở phần áp dụng.
2. Sao lưu thư mục cấu hình và workspace của OpenClaw.
3. Gắn nhãn git cho trạng thái sắp triển khai: `<gói>-v<số>`, ví dụ `goi2-v1`.
4. Triển khai. Nâng OpenClaw: đọc ghi chú phát hành, sửa `OPENCLAW_IMAGE` sang phiên bản mới, `docker compose pull openclaw-gateway openclaw-cli`, `docker compose up -d openclaw-gateway`, `doctor`.
5. Kiểm tra sau triển khai: SPEC mục 7.3 (`scripts/` có script chạy phần lệnh).
6. Không đạt thì quay lui ngay, không sửa nóng: trả `OPENCLAW_IMAGE` về phiên bản cũ rồi `up -d`; trả thư mục trợ lý về nhãn trước (`git checkout <nhãn cũ> -- openclaw-workspace/`) rồi đồng bộ lại; nếu cần, khôi phục bản sao lưu ở bước 2. Ghi sự cố vào mục "Phát sinh" của tasks.md.

**Bảng phiên bản đã triển khai** (mới nhất ở trên):

| Ngày | Nhãn git | Phiên bản OpenClaw | Thay đổi | Kiểm tra 7.3 |
|---|---|---|---|---|
| 20/10/2026 | (chưa gắn nhãn) | 2026.10.3 | G2-04: server MCP `google`, skill `cong-viec` | Đạt (16 giây) |
| 15/10/2026 | (chưa gắn nhãn) | 2026.10.3 (59cb447), `sha256:70b8dbd23f8d…` | Cài lần đầu theo D19 (G1-02); mô hình mặc định `openai/gpt-6-astra` | Chưa áp dụng |

**Sao lưu**
- Sao lưu thư mục cấu hình và workspace của OpenClaw trước mỗi lần triển khai và định kỳ; không sao lưu lên dịch vụ công khai.
- Dữ liệu việc và lịch đã nằm trên Google nên không cần sao lưu riêng.

## 7. Tài liệu tham chiếu

| Tài liệu | Nơi | Ghi chú |
|---|---|---|
| Hướng dẫn dựng Zalo Agent bằng OpenClaw | https://claude.ai/code/artifact/1d7491e0-aed2-4bf9-ab44-33991d86f12a | Đường dẫn cài đặt trong hướng dẫn có thể khác; theo PLAN: OpenClaw ở `~/apps/openclaw` |
| Sổ tay triển khai Khải Phiên Bản Số – từng bước | https://claude.ai/code/artifact/beeb7d46-cf97-4534-89d7-4355a6b12f8a | Các bước anh tự làm, câu giao việc, kiểm chứng theo từng task; đã cập nhật thứ tự D7, Gói 2C, Gói 4 |
| Bản thiết kế "Khải Phiên Bản Số – Web quản lý" | https://claude.ai/artifact/E6c2CgbxKv2SxCe3Nskjrb | Giao diện Gói 4; làm trước màn A Biểu theo dõi, B Kanban, C Lịch công việc |
| Bảng phân vai kênh Telegram/Zalo | `Kenh_Telegram_Zalo_Agent.xlsx` trong Claude Project | Bảy bước dựng Telegram, lưu ý pháp lý |
| Bản nháp SOUL, AGENTS của trợ lý và 5 skill (thêm `tiep-nhan-van-ban`) | Thư mục `ban-nhap/` trong Claude Project, ngoài repo | Đầu vào cho G1-04, G2-04 → G2-06, Gói 2C và Gói 3 |
| Tài liệu OpenClaw | https://docs.openclaw.ai | Đối chiếu trước khi dùng lệnh, khóa cấu hình mới |
| Công cụ dựng sẵn (tìm kiếm, tải trang web, chạy lệnh) | https://docs.openclaw.ai/gateway/config-tools/built-in-tools | Gói 2B |
| Tìm kiếm DuckDuckGo | https://docs.openclaw.ai/tools/duckduckgo-search | C12 |
| Tạo ảnh | https://docs.openclaw.ai/tools/image-generation | C14 |
| Gửi tệp, ảnh vào chat | https://docs.openclaw.ai/help/faq/media-and-attachments | C13, C15 |
