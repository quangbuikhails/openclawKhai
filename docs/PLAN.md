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
Điện thoại ─► web app qua mạng riêng (D48), không qua Internet công cộng
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
| D18 | Web app xem và thao tác được trên điện thoại, qua mạng riêng, không mở ra Internet công cộng (cách cụ thể: C16) (đã chốt: D48) | Anh Khải đồng ý 14/10/2026 |
| D19 | Bản OpenClaw của dự án chạy cách ly với bản đang có sẵn trên máy: tên dự án Compose `khai-pbs` (ghi trong `~/apps/openclaw/.env`); Gateway `127.0.0.1:28789`, cầu nối `127.0.0.1:28790`, MS Teams `127.0.0.1:28978`; `docker-compose.yml` đã thêm `127.0.0.1:` vào cả ba cổng (tệp gốc lưu ở `docker-compose.yml.bak`); đăng nhập Codex riêng; bot Telegram/Zalo riêng | Anh Khải đồng ý 15/10/2026; cài xong và kiểm tra 15/10/2026 (G1-02) |
| D20 | Gắn `openclaw-workspace/` vào OpenClaw bằng script chép một chiều (`scripts/dong-bo-workspace.sh`) từ repo sang `~/.openclaw/workspace`, không mount trực tiếp. Script chỉ chép `SOUL.md`, `AGENTS.md`, `skills/`; không ghi đè `USER.md`, `IDENTITY.md`, `BOOTSTRAP.md`, bộ nhớ và `.git/` của workspace; có `--dry-run`. Quay lui: `git checkout <nhãn cũ> -- openclaw-workspace/` rồi chạy lại script (mục 6) | Workspace thật hiện có git riêng và `USER.md` (theo anh Khải, 16/10/2026); `MEMORY.md`, `memory/` sẽ phát sinh khi chạy. Mount trực tiếp sẽ trộn hai lịch sử git và để trợ lý tự sửa thẳng vào repo; chép một chiều giữ repo sạch, xem được `diff` trước khi ghi. Trang https://docs.openclaw.ai/concepts/agent-workspace (đọc 16/10/2026) không nói gì về mount | Anh Khải chốt 16/10/2026 (G1-04) |
| D21 | C1: trợ lý đọc, ghi Google Sheets và Calendar qua một server MCP nhỏ do dự án tự viết, chạy ở container riêng trong mạng Docker `khai-pbs` (HTTP, không mở cổng ra ngoài); khóa Google chỉ mount vào container này và nằm ở `secrets/`, Gateway không giữ khóa. Điều kiện: spike G2-01B xác nhận runtime Codex gọi được công cụ MCP khi `exec` bị deny; không đạt thì quay lại bàn. Image, package cụ thể phải trình và được anh duyệt trước khi thêm (AGENTS.md). Mã dùng lại được cho web app Gói 4 | Khóa Google không nằm cùng chỗ với trợ lý còn `functions.exec` (C18); mã tự viết đọc hết được, chỉ có đúng các thao tác cần Spike G2-01B xác nhận 19/10/2026 (điều kiện đạt). | Anh Khải chốt 19/10/2026 (thay C1) |
| D22 | C4: nhắc trước giờ hẹn 30 phút; bản tin đầu ngày 07:30 thứ Hai đến thứ Sáu (lịch hôm nay, việc đến hạn, việc quá hạn gộp chung); không có tổng kết tuần; Telegram chỉ nhận tin chủ động khi bot Zalo gửi lỗi | Đỡ trùng tin, đúng nhịp làm việc cơ quan | Anh Khải chốt 19/10/2026 (thay C4) |
| D23 | C8: thêm, sửa, hủy việc và lịch hẹn: nhắc lại và chờ chủ xác nhận rồi mới ghi; ổn định thì xét lại cho phép ghi ngay kèm hoàn tác | Hiểu sai ngày giờ là lỗi hay gặp; spike G2-01B cho thấy trợ lý tự hỏi xác nhận đúng cách | Anh Khải chốt 19/10/2026 (thay C8) |
| D25 | Luật ghi trên Google Calendar (thay luật tiền tố `[TEST]` của spike): mọi sự kiện server tạo mang `extendedProperties.private.owner="khai-pbs"`; sửa, dời, xóa chỉ cho sự kiện có dấu này, kiểm ở server trước khi ghi, ở cả test lẫn prod; sự kiện chủ tự tạo chỉ đọc. Không công cụ nào nhận ID lịch (lịch cố định theo `CALENDAR_ID` trong env). `cal_list` chỉ trả tiêu đề, giờ và `by_assistant`, không trả mô tả, địa điểm, người tham dự. Tạo sự kiện có giờ kiểm trùng giờ trước (chỉ tính sự kiện có giờ), trùng thì từ chối trừ khi chủ xác nhận lại. Nhắc đặt ở cấp lịch (thông báo mặc định của lịch "Công việc"), không đặt trên sự kiện | Quyền chia sẻ lịch của Google không hạn chế theo từng sự kiện, nên Service Account sửa được cả sự kiện chủ tự tạo nếu server không chặn; dấu `owner` mô hình không đặt được. Nhắc đặt riêng trên từng sự kiện qua API không hiển thị cho chủ lịch (kiểm chứng 20/10/2026), nên bỏ; chuông theo D26 | Anh Khải chốt 20/10/2026 (G2-05) |
| D24 | C11: chỉ số đo kết quả: không việc nào có hạn bị quá hạn mà chưa được nhắc trước ít nhất 1 ngày; thêm một việc qua Zalo dưới 30 giây; đo 4 tuần dùng thật sau nghiệm thu Gói 2 | Theo SPEC mục 1 | Anh Khải chốt 19/10/2026 (thay C11) |
| D26 | C2: dùng Service Account `khai-mcp-google` cho Sheets và Calendar (khóa chỉ nằm ở `secrets/` và container `khai-mcp-google`); chuông nhắc theo thông báo mặc định cấp lịch "Công việc" (sự kiện có giờ: 30 phút trước; cả ngày: 09:00), công cụ `cal_*` không đặt nhắc riêng. Drive (Gói 2C): xem D39 | Kết quả phép thử: (1) 20/10/2026: sự kiện do Service Account tạo hiện trên Google Calendar iPhone và báo theo mốc thông báo mặc định của lịch; nhắc đặt riêng trên từng sự kiện qua API không hiển thị cho chủ lịch. (2) 27/10/2026, sau khi gỡ nhắc riêng khỏi server (commit 3715175), sự kiện `[TEST]` bắt đầu 16:31, mốc mặc định của lịch "trước 2 phút": iPhone khóa màn hình có chuông lúc 16:29 và hiện ngoài màn hình khóa; lịch lúc đó còn mốc "vào thời điểm diễn ra sự kiện" nên báo thêm lúc 16:31. (3) 27/10 11:09 (lịch `[TEST]`): Chrome báo, iPhone không báo. (4) 28/10/2026 trên lịch thật "Công việc" đã chuyển `CAL_MODE=prod`: sự kiện `[TEST]` do Service Account tạo lúc 10:33 (bắt đầu 11:15): iPhone không báo lúc 10:45; sau khi anh Khải tắt Chế độ Nguồn điện thấp và bật Làm mới ứng dụng trong nền (10:52), sự kiện `[TEST]` kiểm tra API (tạo khoảng 10:58, không mở ứng dụng, bắt đầu 11:40) báo đúng 30 phút trước lúc 11:10; nguyên nhân nhiều khả năng là hai cài đặt này (chưa kiểm chứng riêng từng cái); Nguồn điện thấp có thể làm mất chuông lịch nên bản tin và nhắc việc qua Zalo, Telegram vẫn là lớp chính, xem xét ở G2-06. Đã dọn thông báo mặc định lịch `[TEST]` chỉ còn 30 phút trước (có giờ) và 09:00 (cả ngày) | Anh Khải chốt 27/10/2026 (thay C2, G2-05) |
| D27 | C20: bản tin sáng, nhắc 14:00 và đối chiếu lịch chạy bằng job `openclaw automations … --command` (không gọi mô hình). Job do anh Khải tạo bằng CLI trong container hoặc trang Tự động hóa của Control UI; agent giữ deny `automations`, `cron` | Không dính 429; nội dung cố định; không mô hình nào đọc trích yếu văn bản khi chạy ngầm. Kết quả thử 28/10/2026 (G2-06a, OpenClaw 2026.10.3, docs đối chiếu v2026.10.7): tạo job bằng CLI không bị chặn quyền; job `--command` chạy trong Gateway, không gọi mô hình, nội dung in ra lưu ở `summary` của `automations runs`; cron `--tz Asia/Ho_Chi_Minh --exact` chạy đúng giờ; Gateway có `node`, `curl` và thấy `khai-mcp-google`. Chưa kiểm: bản tin dài có bị cắt ở `summary` không; job `--command` có chạy bù khi Gateway tắt qua giờ chạy không | Anh Khải chốt 28/10/2026 (G2-06) |
| D28 | C21: [Nhắc], [Hạn] do server `khai-mcp-google` đồng bộ. Sự kiện mang `extendedProperties.private`: `owner`, `stt`, `kind`. `task_add`, `task_set_due`, `task_set_status` tự đồng bộ sau khi ghi Sheets thành công; có `task_sync_calendar(stt)`, `task_sync_all` và job đối chiếu 06:30 thứ Hai đến thứ Sáu. Server không ghi cột N | Mô hình không phải nhớ gọi thêm; sửa tay trên Sheets được vá bằng job đối chiếu | Anh Khải chốt 28/10/2026 (G2-06) |
| D29 | C22: nhắc 14:00 từ thứ Hai đến thứ Sáu, chỉ việc có Hạn hoàn thành là hôm nay chưa `Đã xong`/`Hủy`; không có việc thì không gửi | Lấy từ bản nháp skill `nhac-viec`; SPEC chưa có, được bổ sung | Anh Khải chốt 28/10/2026 (G2-06) |
| D30 | C23: bản tin 07:30 từ thứ Hai đến thứ Sáu có ba mục riêng: Hạn hôm nay, Đến ngày nhắc, Quá hạn; kèm lịch hôm nay có giờ | SPEC viết "việc đến hạn", chưa rõ nghĩa | Anh Khải chốt 28/10/2026 (G2-06) |
| D31 | C24: trước khi chốt C18, thử lịch nhắc chỉ bằng job `--no-deliver` kèm `automations runs` và qua phiên Control UI; không nối kênh thật. Tin tới kênh kiểm ở G2-07 | Giữ điều kiện chặn C18 | Anh Khải chốt 28/10/2026 (G2-06) |
| D32 | C18: chấp nhận có điều kiện cho Gói 2. Căn cứ: agent main có profile messaging, deny gồm exec, process, terminal, browser, gateway, secrets, plugins, group:nodes, sessions_spawn, subagents; hai phép thử trên Control UI ngày 31/10/2026 (yêu cầu chạy lệnh shell: trợ lý nói không có công cụ shell, tệp không được tạo; hỏi kích thước openclaw.json: nói không có công cụ truy cập hệ thống tệp). Điều kiện: chỉ ID số tài khoản anh Khải được nhắn (allowlist, dmPolicy allowlist); tắt nhóm (groupPolicy disabled) ở mọi kênh; chưa nhận văn bản từ người khác; không đưa bí mật vào workspace; có cách ngắt khẩn cấp ghi trong README. Xem lại ngay trước Gói 2C và khi nối Zalo cá nhân | Chưa chứng minh: cầu nối Code Mode của MCP (functions.exec) không đọc, ghi tệp host; Codex app-server chưa siết (plugins.entries.codex.config.appServer chưa đặt, mặc định approvalPolicy never, sandbox danger-full-access); approvals get cho hiệu lực security=full, ask=off | Anh Khải chốt 31/10/2026 (thay C18) |
| D33 | C19: bot Zalo cũ openclaw-bot dùng Zalo cá nhân, anh Khải vẫn dùng hằng ngày; không đụng. Bot chính thức của dự án tạo ở bot.zaloplatforms.com, token riêng; Zalo cá nhân của dự án là tài khoản phụ riêng (điện thoại phụ), không dùng tài khoản chính hay tài khoản của openclaw-bot | Bot của dự án phải riêng, không dùng chung token hay tài khoản với bot cũ | Anh Khải chốt 31/10/2026 (thay C19) |
| D34 | Nới D5: Zalo cá nhân (tài khoản phụ) được dùng sớm làm kênh bổ sung thứ ba ở Gói 2, thêm vào chứ không thay bot chính thức (D4 giữ nguyên); việc trả lời thay người khác vẫn để Gói 3 | Anh Khải muốn dùng Zalo cá nhân vì tiện; bot chính thức vẫn là lớp ổn định cho nhắc việc (D24). Rủi ro: thư viện không chính thức, tài khoản phụ có thể bị khóa, phiên đăng nhập nằm trong trạng thái OpenClaw (cùng khu vực C18) | Anh Khải chốt 31/10/2026 |
| D35 | C26: khi bot Zalo giao tin lỗi, Telegram nhận thông báo lỗi giao tin (tên job, giờ chạy), không kèm nội dung bản tin; chủ nhắn Telegram "Hôm nay có gì?" để xem bản tin. Không gửi song song. Cấu hình mỗi job giao tin: `--failure-alert --failure-alert-channel telegram --failure-alert-to <ID Telegram> --failure-alert-after 1` | Cơ chế báo lỗi của OpenClaw chỉ nêu nguyên nhân, không chép nội dung; dự phòng thật cho hạn việc là sự kiện [Nhắc], [Hạn] trên Calendar (D17); không thêm mã chưa kiểm chứng. Kiểm 02/11/2026 (OpenClaw 2026.10.3): Zalo trả lỗi chat_id sai thì Telegram nhận thông báo | Anh Khải chốt 02/11/2026 (C26) |
| D36 | G2-02c (Zalo cá nhân, tài khoản phụ) hoãn sang sau khi Gói 4 nghiệm thu; nghiệm thu Gói 2 không gồm kênh này. Thứ tự còn lại: 2C → 4 → G2-02c → 2B → 3. D34 giữ nguyên (Zalo cá nhân là kênh bổ sung), chỉ lùi thời điểm; C25 chốt khi làm G2-02c | SPEC ghi Gói 2 không phụ thuộc kênh này; bot Zalo chính thức và Telegram đủ dùng; ưu tiên tiếp nhận văn bản (2C) và web app (4) | Anh Khải chốt 10/11/2026 |
| D37 | Kênh tiếp nhận văn bản (Gói 2C): ảnh gửi qua bot Zalo hoặc Telegram; PDF (kể cả bản scan) và Word chỉ gửi qua Telegram. Bot Zalo chính thức không nhận PDF, Word: plugin bỏ qua tin không hỗ trợ (`message.unsupported.received`), trợ lý im lặng. Giới hạn: ảnh qua Zalo theo `channels.zalo.mediaMaxMb` (mặc định 5 MB); tệp qua Telegram tối đa 20 MB (giới hạn Bot API) | Zalo Bot Platform chỉ có tin chữ, ảnh, sticker, thoại (docs đóng gói trong openclaw@2026.10.3). Thử 10/11/2026: PDF qua Zalo trợ lý im lặng; ảnh qua cả hai kênh đúng đủ 5 trường | Anh Khải chốt 10/11/2026 (G2C-01) |
| D38 | C17: dùng khả năng đọc sẵn có, không thêm bộ chuyển đổi. Ảnh đưa thẳng vào mô hình; PDF thành file block (trang scan render thành ảnh), không cần nới quyền. Word (.docx) chưa đọc được: trợ lý báo và đề nghị gửi PDF hoặc ảnh từng trang. Tool `pdf` (group:media) chỉ thêm qua `tools.alsoAllow` khi PDF đọc kém, quyết cùng C15 | Thử 10/11/2026 (OpenClaw 2026.10.3): ảnh 1 trang, 2 trang và PDF scan đúng đủ 5 trường; DOCX trợ lý báo chưa đọc được và đề nghị gửi PDF/ảnh. Viết bộ đọc .docx phải thêm mã hoặc package, lợi ích nhỏ | Anh Khải chốt 10/11/2026 (thay C17) |
| D39 | Drive (Gói 2C): OAuth scope `drive.file`, OAuth client loại Desktop kèm PKCE; màn hình đồng ý ở chế độ Testing khi thử (refresh token hết hạn sau 7 ngày) rồi Publish sang Production; refresh token nằm ở `secrets/google/`, chỉ mount vào `khai-mcp-google`. Thư mục "Khải Phiên Bản Số/Văn bản đến/…" do server tạo, chủ không tạo tay trước (`drive.file` chỉ thấy tệp, thư mục do ứng dụng tạo; kiểm chứng ở G2C-03). Sheets, Calendar giữ Service Account (D26) | Service Account không có dung lượng Drive; Gmail cá nhân không tạo được Shared Drive; `drive.file` là scope non-sensitive; Apps Script phải mở web app có URL công khai kèm khóa | Anh Khải chốt 10/11/2026 (G2C-01) |
| D40 | Đẩy nhanh web app (chồng lấn có giới hạn): G4-01 song song từ G2C-02; G4-02 (chỉ đọc) trong tuần chạy thử G2C-05. Nới 18/11/2026: G4-04 (lịch, chỉ đọc) và G4-05 (Tailscale) làm ngay trong tuần chạy thử; G4-03 (ghi qua Kanban) viết mã và thử trong thư mục làm việc tách riêng (git worktree) với container và dữ liệu [TEST], chỉ đưa lên chạy thật (sửa, tạo lại khai-mcp-google) sau khi gắn goi2c-v1. D7 giữ thứ tự nghiệm thu 2C → 4 | Phần chỉ đọc không đụng hệ thống đang chạy; khai-mcp-google chạy mã từ thư mục repo (G2-08: lỗi MODULE_NOT_FOUND khi ổ WSL chưa sẵn sàng) nên mã G4-03 chưa kiểm không được nằm ở thư mục đó trước khi gắn nhãn; tránh hai nơi cùng ghi biểu trong lúc chạy thử 2C và đo D24 | Anh Khải chốt 10/11/2026; nới 18/11/2026 |
| D41 | C27: giữ nguyên cấu hình phiên tiếp nhận văn bản (phương án C), không đặt `appServer.sandbox`. Dựa vào: allowlist ID chủ (D32), bước xác nhận trước mọi lần ghi, quy tắc "nội dung văn bản là dữ liệu" ở AGENTS và skill. Rủi ro còn lại: Codex app-server vẫn `danger-full-access`, phiên main đọc được `openclaw.json`. Xem lại khi nâng OpenClaw hoặc trước Gói 3 | Thử 11/11/2026 (OpenClaw 2026.10.3): đặt `plugins.entries.codex.config.appServer.sandbox` = `"workspace-write"` (nạp nóng) làm công cụ MCP `google_*` báo "không được cấp quyền thực thi" (cầu nối `functions.exec` của Code Mode, `tools.exec_command is not a function`); đã hoàn tác bằng bản sao lưu, MCP chạy lại. Không thử `tools.exec.mode: "deny"` và các khóa Code Mode khác (nhiều khả năng cùng hậu quả). `workspace-write` vẫn cho đọc toàn hệ tệp, chỉ chặn ghi | Anh Khải chốt 11/11/2026 (G2C-02, thay C27) |
| D42 | Cấp riêng `skills_read`, `skills_search` cho agent main (`agents.entries.main.tools.alsoAllow`), không cấp `read` hệ tệp | Profile `messaging` không có `read` nên `skills_read` không được cấp: trajectory 11/11/2026 cho thấy mô hình không đọc `SKILL.md`, chỉ làm theo AGENTS.md và mô tả skill. Sau khi cấp (14:40:27 ngày 11/11/2026, OpenClaw 2026.10.3, docs `tools/skills`, `gateway/config-tools/tool-policy`) mô hình gọi `skills_read` và làm đúng skill; `skills_read` từ chối skill ngoài `agents.entries.main.skills` (thử `weather`); phiên mới chỉ thêm đúng hai công cụ; hồi quy rút gọn `cong-viec`, `lich-hen` đạt 13/11/2026 | Anh Khải chốt 13/11/2026 |
| D43 | C28: đưa tệp gốc từ Gateway tới `khai-mcp-google` bằng phương án A: gắn `~/.openclaw/workspace/media/inbound` chỉ đọc vào `/inbox`; công cụ `drive_save_document` nhận mã tệp (phần sau `media://inbound/` trong ghi chú media), không nhận đường dẫn. Kiểm: mã đúng dạng, `realpath` nằm trong `/inbox`, không liên kết tượng trưng, thư mục có tệp đánh dấu của Gateway, đuôi jpg/jpeg/png/pdf/docx, đúng chữ ký tệp; tối đa 20 tệp, 25 MB. Tên tệp dùng ngày nhận; thư mục `Khải Phiên Bản Số/Văn bản đến/<năm>/<tháng 2 chữ số>`; thư mục và tệp do server tạo mang `appProperties.owner=khai-pbs`, tệp thêm `sha256` để chống trùng. `drive_trash` chỉ chuyển thùng rác tệp có `owner=khai-pbs`, skill phải hỏi xác nhận. Thứ tự sau "ok": `drive_save_document` → `task_add` (kèm `doc_link`) → server đồng bộ [Nhắc]/[Hạn] (D28); chỉ nói "đã lưu" khi cả hai bước thành công | Gateway lưu tệp gốc ở `media/inbound` và ghi mã vào ghi chú media; không cho mô hình chọn đường dẫn. Rủi ro còn lại: server đọc được mọi tệp trong `inbound`, không chỉ tệp của lượt đang xử lý (chỉ chủ gọi được công cụ, D32); gắn chỉ đọc nên không ghi hay xóa được. Dọn bằng `scripts/don-media-inbound.sh` (mặc định chỉ liệt kê) | Anh Khải chốt 14/11/2026 (G2C-03) |
| D44 | C29: giữ màn hình đồng ý OAuth ở chế độ Testing, đăng nhập lại Drive 7 ngày/lần; xem lại Publish sang Production khi có tên miền đã xác minh. Script đăng nhập ghi `obtained_at`; `post-deploy-check.sh` cảnh báo từ ngày thứ 5; hết hạn thì công cụ trả "Drive cần đăng nhập lại" và không ghi gì. Thay phần "rồi Publish sang Production" của D39 | Google đòi trang chủ và chính sách riêng tư trên tên miền đã xác minh mới cho Publish; anh Khải không Publish được (14/11/2026). Refresh token Testing hết hạn sau 7 ngày | Anh Khải chốt 14/11/2026 (G2C-03) |
| D45 | C30: "cập nhật dòng cũ" khi trùng Số ký hiệu (phương án B): thêm công cụ ghi `task_update_doc`, chỉ sửa các cột C (Tên văn bản), E (Cơ quan ban hành), F (Nội dung cần xử lý), I (Ưu tiên), K (Ghi chú), L (Link tài liệu), M (Thời hạn trong văn bản) theo STT; ghi một lần bằng `values:batchUpdate` (đủ hoặc không), log `sua`, tự đồng bộ [Nhắc]/[Hạn] sau khi ghi; không ghi cột N, không đổi Số ký hiệu, Trạng thái, Ngày nhận; ngày định dạng `dd/MM/yyyy`. Tệp mới tải bằng `drive_save_document`, cột L trỏ tệp mới, không `drive_trash` tệp cũ. Hạn hoàn thành đổi qua `task_set_due`. Trợ lý chỉ nêu các trường thay đổi (cũ → mới) và chờ "ok" | Dòng cũ giữ trạng thái và lịch sử; tệp cũ còn trên Drive, khôi phục được; tách công cụ để không mở rộng `task_set_status`, `task_set_due` | Anh Khải chốt 15/11/2026 (G2C-04) |
| D46 | C31: tra theo số ký hiệu khi cập nhật qua chat (phương án A): `task_list` khớp đúng toàn chuỗi trước; không có dòng nào và chỉ khi tham số `prefix_fallback=true` (mặc định false; chỉ skill `cong-viec` truyền) và chủ gõ số trơn (không có "/") thì khớp phần trước dấu "/" của Số ký hiệu; gõ đủ số mà không khớp đúng thì báo không tìm thấy, không fallback. Kết quả ghi `match` (`exact`, `prefix`, `null`); nhiều dòng thì hỏi chủ, tối đa 5 dòng. Kiểm trùng khi tiếp nhận (`tiep-nhan-van-ban` mục 3) giữ khớp đúng | Số trơn "123" là cách chủ gọi văn bản; fallback cho số đủ dễ nhầm với văn bản cùng số của cơ quan khác | Anh Khải chốt 15/11/2026 (G2C-04) |
| D47 | C6: web app theo kiến trúc lai. Máy chủ web riêng `web-admin` đọc Sheets, Calendar bằng service account chỉ đọc mới (khóa ở `secrets/google-ro/`, scope `spreadsheets.readonly`, `calendar.readonly`; quyền Người xem trên bảng tính, quyền xem chi tiết trên lịch "Công việc"); web chỉ trả tiêu đề và giờ của sự kiện lịch (giống `cal_list`, D25), không trả mô tả, địa điểm, người tham dự. Mọi lần ghi (từ G4-03) đi qua `khai-mcp-google` bằng `WEB_TOKEN` riêng, chỉ mở `task_set_status`, có kiểm trạng thái cũ trước khi ghi (compare-and-set), channel `web`; web không thêm dòng. Giao diện không thêm package: JavaScript thuần (ES module), `node:http`, `node:crypto`, chạy trên image OpenClaw đã ghim; xét lại ở G4-06 nếu phạm vi phình. Xác thực hai lớp: mạng riêng (D48) rồi mật khẩu một người dùng (băm scrypt) kèm cookie phiên HttpOnly, SameSite=Strict; giới hạn số lần đăng nhập; kiểm Origin khi ghi; mật khẩu băm, khóa phiên, `WEB_TOKEN` ở `secrets/web-admin.env`; trình duyệt không giữ khóa Google, token Gateway. Thăm dò: trình duyệt hỏi 10–15 giây, máy chủ đệm 15 giây (đọc Sheets khoảng 4 lần/phút), xử lý 429 bằng chờ rồi đọc lại. G4-02 chỉ đọc: container `web-admin` không có `MCP_GOOGLE_TOKEN`, `BRIEF_TOKEN`, `WEB_TOKEN`, không mount `secrets/mcp-google.env`, không có đường mạng tới `khai-mcp-google`; `read_only`, `cap_drop ALL`, `no-new-privileges`; bind `127.0.0.1:<cổng chưa dùng>`, không dùng 18789, 18790, 20128, 28789, 28790, 28978 | Một nơi ghi duy nhất; G4-02 không đụng dịch vụ đang chạy trong tuần thử 2C (D40); không thêm chuỗi phụ thuộc; chỉ đọc được Google bảo đảm. Chưa kiểm chứng: cookie `Secure` khi mở qua `http://127.0.0.1`; SA riêng có hạn mức "mỗi người dùng" tách khỏi SA hiện tại không; hạn mức Calendar API. Đã kiểm: cookie `Secure` qua `tailscale serve`: đạt 18/11/2026 (G4-05) | Anh Khải chốt 17/11/2026 (G4-01) |
| D48 | C16: Tailscale cài trên Windows (không cài trong WSL, không sidecar), gói Personal miễn phí, đăng ký bằng Gmail cá nhân (anh Khải chấp nhận cách hiểu "phi thương mại": một cá nhân, dùng cho trợ lý riêng, không kinh doanh); bật MagicDNS, chứng chỉ HTTPS; `tailscale serve` đúng một cổng của `web-admin` trong mạng riêng, không Funnel; ACL chỉ cho điện thoại tới đúng cổng đó; không mở cổng router; không dùng Cloudflare Tunnel (cần tên miền, thành dịch vụ có hostname công khai, trái D18) | `docker ps` ngày 17/11/2026: `openclaw-gateway`, `openclaw-bot`, `9router-bot` đều chỉ bind 127.0.0.1 (`khai-mcp-google` không publish cổng), nên Tailscale trên Windows không làm lộ chúng; dịch vụ Windows nghe 0.0.0.0 do ACL một cổng chặn. Chưa kiểm chứng: Docker Desktop chuyển `127.0.0.1:<cổng>` sang localhost Windows để `tailscale serve` dùng; tên header danh tính của Tailscale Serve. Đã kiểm 18/11/2026: Docker Desktop chuyển `127.0.0.1:28801` sang localhost Windows: đạt; header danh tính Tailscale Serve: web không dùng | Anh Khải chốt 17/11/2026 (G4-01) |
| D49 | Phạm vi thiết kế Gói 4 (đối chiếu ba ảnh `tmp/thiet-ke/`): bỏ ô "Văn bản vừa nhận, chờ anh xác nhận"; bỏ "Thêm lịch hẹn bằng lời" và nút Phân tích khỏi Gói 4 (web không gọi mô hình); bỏ chân thẻ nguồn ("Zalo · văn bản"); ẩn các mục thanh bên ngoài SPEC (Tổng quan, Hội thoại, Báo cáo, Nhật ký, Việc định kỳ, Hàng chờ duyệt); nhật ký trên Kanban chỉ hiện dòng log của trợ lý và web (sửa tay không có log, đúng SPEC); thẻ tóm tắt và bộ lọc "Cần làm ngay" giữ (định nghĩa ở SPEC); bố cục điện thoại do agent dựng từ ba ảnh, anh duyệt bằng ảnh chụp ở G4-02; lịch có màn tháng và tuần, hiện đủ thứ Hai đến Chủ nhật; màn "Tài khoản và kênh" chốt ở G4-06 (lưu ý G2-02c hoãn sau Gói 4 theo D36, phần Zalo phụ trong SPEC Gói 4 phải sửa khi tới G4-06). Cổng hiển thị trên giao diện là cổng của dự án (28789), không phải 18789 | Giữ giao diện trong phạm vi SPEC; web không gọi mô hình | Anh Khải chốt 17/11/2026 (G4-01) |

## 3. Mục cần chốt

| # | Nội dung | Gói | Ghi chú |
|---|---|---|---|
| C5 | Danh sách người được trả lời và quy tắc vào hàng chờ duyệt | 3 | |
| C7 | Có chuyển lên VPS để chạy liên tục không | Sau 2 | |
| C10 | Gói 3: có trả lời trong nhóm không | 3 | Đề xuất: tắt; nếu bật thì chỉ nhóm được chọn, chỉ khi được nhắc tên |
| C12 | Nhà cung cấp tìm kiếm web | 2B | Tài liệu OpenClaw: DuckDuckGo không cần khóa nhưng là tích hợp thử nghiệm, không chính thức, có thể hỏng hoặc bị chặn; Brave Search dùng API (cần khóa) được khuyến nghị cho dùng thật. Đề xuất: thử DuckDuckGo, hay hỏng thì chuyển Brave (chi phí cần kiểm chứng) |
| C13 | Cách tạo tệp Word | 2B | OpenClaw không có công cụ tạo .docx dựng sẵn. Đề xuất: một skill gọi script cố định trong workspace (không cho trợ lý chạy lệnh tùy ý); cần kiểm chứng image OpenClaw có sẵn Python/Node và thư viện tạo .docx hay phải thêm (thêm phụ thuộc phải duyệt) |
| C14 | Nhà cung cấp tạo ảnh | 2B | Tài liệu OpenClaw: công cụ `image_generate` dùng được OpenAI qua đăng nhập ChatGPT/Codex, không cần khóa riêng, nhưng dùng chung hạn mức. Đề xuất: dùng OpenAI qua OAuth |
| C15 | Giới hạn thư mục trợ lý được đọc, gửi tệp (`tools.fs.workspaceOnly`) | 2B | Mặc định `false`: trợ lý gửi được mọi tệp nó đọc được. Đề xuất: `true` để chỉ gửi tệp trong workspace và thư mục tạm |
| C25 | Plugin cho Zalo cá nhân (G2-02c) | 2 | Phương án: (a) `@openclaw/zalouser@2026.10.3` (OpenClaw phát hành, phụ thuộc zca-js 2.2.0, chưa đọc mã, gói ~16 MB); (b) `openclaw-zalo-connect` (plugin cộng đồng, MIT, cũng dùng zca-js, đang chạy ở bot cũ của anh Khải, README ghi cần OpenClaw >=2026.5.7, chưa biết tương thích 2026.10.3, có denyFrom và chống tiêm lệnh). Chưa chọn; chốt trước G2-02c (hoãn sau Gói 4, D36), sau khi đọc mã cả hai |

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
| 16/11/2026 | (chưa gắn nhãn) | 2026.10.3 | G2C-04: `task_update_doc`, `task_list` `prefix_fallback`, skill `cong-viec` quy tắc 11, `tiep-nhan-van-ban` mục 5A, D45, D46 | Đạt (16/11/2026) |
| 15/11/2026 | (chưa gắn nhãn) | 2026.10.3 | G2C-03: Drive (`drive_save_document`, `drive_trash`), `task_add` kèm link, định dạng ngày khi ghi, D43, D44 | Đạt (15/11/2026) |
| 11/11/2026 | (chưa gắn nhãn) | 2026.10.3 | G2C-02: skill `tiep-nhan-van-ban`, AGENTS.md mục 5, `task_list` lọc `doc_number`, D42 | Đạt (13/11/2026) |
| 10/11/2026 | `goi2-v1` | 2026.10.3 (59cb447) | Nghiệm thu Gói 2: bot Zalo chính thức, Telegram dự phòng, biểu theo dõi, lịch hẹn, ba job nhắc việc (G2-02b, G2-03, G2-04 đến G2-07) | Đạt (10/11/2026) |
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
