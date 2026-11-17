const form = document.getElementById("form");
const msg = document.getElementById("msg");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "";
  const pw = document.getElementById("pw");
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw.value }),
    });
    if (res.ok) {
      location.replace("/");
      return;
    }
    const body = await res.json().catch(() => ({}));
    msg.textContent = res.status === 429 ? `Sai quá nhiều lần, thử lại sau ${body.retry_after ?? ""} giây.` : "Sai mật khẩu.";
  } catch {
    msg.textContent = "Không kết nối được máy chủ.";
  }
  pw.value = "";
});
