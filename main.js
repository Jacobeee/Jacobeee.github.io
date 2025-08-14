// main.js - shared JS for color scheme toggle

function setTextColorRecursive(element, color) {
    if (element.nodeType === Node.ELEMENT_NODE) {
        element.style.color = color;
        for (let child of element.childNodes) {
            setTextColorRecursive(child, color);
        }
    }
}

window.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggle-theme');
    let customMode = false;
    if (toggleBtn) {
        toggleBtn.onclick = function() {
            customMode = !customMode;
            const yellow = 'rgb(255,225,0)';
            const black = '#222';
            if (customMode) {
                document.body.style.backgroundColor = 'rgb(0,0,128)';
                document.body.style.color = yellow;
                setTextColorRecursive(document.body, yellow);
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.style.background = '#32557f';
                    tab.style.color = '#fff';
                    tab.style.borderTop = '3px solid #32557f';
                });
                document.querySelectorAll('.panels').forEach(panel => {
                    panel.style.backgroundColor = 'rgb(0,0,128)';
                    panel.style.boxShadow = '0 2rem 2rem rgb(255, 225, 0)';
                });
            } else {
                document.body.style.backgroundColor = '#fff';
                document.body.style.color = black;
                setTextColorRecursive(document.body, black);
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.style.background = '#eee';
                    tab.style.color = black;
                    tab.style.borderTop = '3px solid #888';
                });
                document.querySelectorAll('.panels').forEach(panel => {
                    panel.style.backgroundColor = '#f5f5f5';
                    panel.style.boxShadow = '0 2rem 2rem #888';
                });
            }
        };
    }
});
