document.addEventListener("DOMContentLoaded", () => {

  document.querySelectorAll("pre").forEach(pre => {

    const code = pre.querySelector("code");

    if (!code) {
      return;
    }

    const button = document.createElement("button");

    button.className = "copy-code-button";
    button.type = "button";

    button.setAttribute("aria-label", "Copiar código");
    button.title = "Copiar al portapapeles";

    button.textContent = "📋";

    button.addEventListener("click", async () => {

      try {

        await navigator.clipboard.writeText(code.innerText);

        button.textContent = "✓";
        button.title = "Copiado";

        setTimeout(() => {
          button.textContent = "📋";
          button.title = "Copiar al portapapeles";
        }, 1500);

      } catch (error) {

        console.error("No se pudo copiar el código:", error);

      }

    });

    pre.appendChild(button);

  });

});