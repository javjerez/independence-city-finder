const btn = document.getElementById('info-btn');
const panel = document.getElementById('info-panel');
const overlay = document.getElementById('info-overlay');

btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !overlay.classList.contains('active');
    overlay.classList.toggle('active', opening);
    panel.classList.toggle('active', opening);
});

document.addEventListener('click', (e) => {
    if (overlay.classList.contains('active') && !panel.contains(e.target) && e.target !== btn) {
        overlay.classList.remove('active');
        panel.classList.remove('active');
    }
});