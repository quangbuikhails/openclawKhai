@AGENTS.md

# Riêng cho Claude Code

- Task nhiều tệp: dùng plan mode, trình kế hoạch trước khi sửa.
- Khi compact: giữ mã task đang làm, danh sách tệp đã sửa, lệnh kiểm chứng và kết quả gần nhất.
- Rà soát: dùng subagent review diff, đối chiếu task trong `docs/tasks.md` và mục tương ứng trong `docs/SPEC.md`. Chỉ báo lỗi ảnh hưởng tính đúng đắn, yêu cầu đã nêu, hoặc vi phạm mục "Chống rác"/"Bảo mật" của AGENTS.md.
