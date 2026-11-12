(() => {
  "use strict";
  const form = document.getElementById("login-form");
  const message = document.getElementById("form-message");
  const submit = document.getElementById("login-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "Signing in…";
    message.className = "form-message";
    submit.disabled = true;
    try {
      await PM_API.post("/auth/login", {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      });
      window.location.href = "/index.html";
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("error");
    } finally {
      submit.disabled = false;
    }
  });
})();
