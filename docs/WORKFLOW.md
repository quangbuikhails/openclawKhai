# WORKFLOW — Cách anh Khải làm việc với agent lập trình

Tệp này dành cho người, không phải quy tắc cho agent.

## Ba công cụ, ba vai

| Công cụ | Dùng để | Không dùng để |
|---|---|---|
| Claude Project (claude.ai) | Bàn phương án, chốt mục `[CẦN CHỐT]`, soạn và sửa SPEC/PLAN/tasks, đọc log lỗi, hướng dẫn các bước anh tự làm (quét QR, đăng nhập, cấp quyền) | Sửa tệp trong repo |
| Codex hoặc Claude Code (trong repo) | Làm từng task, sửa tệp, chạy kiểm chứng | Bàn lại phạm vi, tự quyết mục `[CẦN CHỐT]` |
| Anh Khải | Duyệt kế hoạch, chạy lệnh cần đăng nhập, commit, nghiệm thu | — |

Repo là bản gốc. Sau mỗi lần commit có sửa `AGENTS.md` hoặc `docs/`, tải lại tệp đó lên Claude Project và xóa bản cũ, để hai nơi không lệch nhau.

## Vòng lặp cho mỗi task

1. **Chọn task** trong `docs/tasks.md`, chuyển lên mục "Đang làm".
2. **Mở phiên mới** từ thư mục gốc repo (`claude` hoặc `codex`). Mỗi task một phiên.
3. **Giao việc**, ví dụ:
   > Đọc AGENTS.md. Làm task G1-03 trong docs/tasks.md. Trình kế hoạch trước khi sửa.
4. **Duyệt kế hoạch**: đúng tệp chưa, có tạo tệp thừa không, có thêm thư viện không.
5. **Cho triển khai**, rồi yêu cầu chạy bước "Kiểm chứng" và dán kết quả thật.
6. **Rà soát**: xem `git diff`; với task lớn, mở phiên mới (hoặc subagent) chỉ để review.
7. **Commit** khi kiểm chứng đạt. Chưa đạt thì chưa commit.
8. **Bàn giao**: task dở dang thì để ở mục "Đang làm" kèm một dòng còn vướng gì; task xong có dòng `Ghi nhận`. Phiên sau (kể cả chat mới trong Claude Project) đọc hai chỗ này là nắm được tình hình.

## Khi nào dừng và làm lại

- Đã sửa agent 2 lần cùng một lỗi mà vẫn sai → dừng (`/clear` hoặc mở phiên mới), viết lại yêu cầu rõ hơn, kèm điều vừa rút ra.
- Agent bắt đầu sửa ngoài phạm vi → dừng ngay (Esc), nhắc lại phạm vi.
- Muốn thử cách làm rủi ro → tạo nhánh git trước (`git switch -c thu-nghiem-...`).

## Đưa lên chạy thật và khi có sự cố

- Mỗi lần đồng bộ thư mục trợ lý hoặc nâng OpenClaw: làm đủ 6 bước ở PLAN.md mục 6, ghi một dòng vào bảng phiên bản.
- Kiểm tra sau triển khai không đạt: quay lui trước, tìm nguyên nhân sau.
- Sự cố khi dùng thật: ghi vào mục "Phát sinh" theo mẫu 4 dòng; nếu cần sửa thì thành task mới, đi lại từ đầu vòng lặp.

## Khi yêu cầu thay đổi

Sửa `docs/SPEC.md` trước → cập nhật `docs/PLAN.md` nếu ảnh hưởng kiến trúc → thêm hoặc sửa task trong `docs/tasks.md` → mới giao agent làm.

## Dọn dẹp định kỳ (sau mỗi gói)

Giao agent:
> Rà soát toàn repo: tìm tệp không được tham chiếu, code không dùng, thư viện không dùng, tệp tạm còn sót. Chỉ liệt kê kèm bằng chứng, chưa xóa.

Duyệt danh sách, rồi mới cho xóa và commit riêng: `chore: dọn dẹp sau gói N`.

## Giữ AGENTS.md gọn

- Agent cứ lặp lại một lỗi → thêm một dòng quy tắc ngắn.
- Một quy tắc agent đã tự làm đúng mà không cần nhắc → cân nhắc bỏ.
- Mục tiêu: AGENTS.md không quá khoảng 100 dòng.
