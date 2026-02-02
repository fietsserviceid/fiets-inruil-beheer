document.addEventListener("DOMContentLoaded", () => {
  const status = document.getElementById("status");
  const app = document.getElementById("app");

  status.textContent = "Beheerpagina geladen.";

  app.innerHTML = `
    <p><strong>Welkom!</strong> De FSID beheerpagina werkt.</p>
    <p>Je kunt nu functionaliteit toevoegen.</p>
  `;
});
