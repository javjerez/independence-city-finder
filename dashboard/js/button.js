const btn = document.getElementById("info-btn");
const panel = document.getElementById("info-panel");

btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
});

document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target)) {
        panel.hidden = true;
    }
});