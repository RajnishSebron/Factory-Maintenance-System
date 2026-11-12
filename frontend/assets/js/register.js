(() => {
  "use strict";
  const form = document.getElementById("register-form");
  const message = document.getElementById("form-message");
  const submit = document.getElementById("register-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "Creating your Viewer account…";
    message.className = "form-message";
    submit.disabled = true;
    try {
      await PM_API.post("/auth/register", {
        full_name: document.getElementById("full-name").value.trim(),
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
