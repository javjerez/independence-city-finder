// RESIZE HANDLE LOGIC

/*
    Dragging the handle writes a new value to #app's --split variable.
    No module dependencies.
*/

const app = document.getElementById('app');
const handle = document.getElementById('resize-handle');

/* Position the handle to sit on the column boundary on load */
function syncHandlePosition() {
    const splitPx = app.getBoundingClientRect().width
    * (parseFloat(getComputedStyle(app).getPropertyValue('--split')) / 100);
    handle.style.left = splitPx + 'px';
}

syncHandlePosition();

handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);

    handle.addEventListener('pointermove', onDrag);
    handle.addEventListener('pointerup', onDrop, { once: true });
});

function onDrag(e) {
    const totalWidth = app.getBoundingClientRect().width;
    const newSplit = Math.min(Math.max(e.clientX / totalWidth * 100, 20), 80);
    app.style.setProperty('--split', newSplit.toFixed(2) + '%');
    handle.style.left = e.clientX + 'px';
}

function onDrop() {
    handle.removeEventListener('pointermove', onDrag);
}

window.addEventListener('resize', syncHandlePosition);
