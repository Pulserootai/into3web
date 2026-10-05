const captureTabs = [...document.querySelectorAll('[data-capture]')];
function selectCapture(tab, moveFocus = false) {
  for (const candidate of captureTabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    document.getElementById(candidate.getAttribute('aria-controls')).hidden = !selected;
  }
  if (moveFocus) tab.focus();
}
for (const [index, tab] of captureTabs.entries()) {
  tab.addEventListener('click', () => selectCapture(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % captureTabs.length;
    if (event.key === 'ArrowLeft') next = (index + captureTabs.length - 1) % captureTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = captureTabs.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      selectCapture(captureTabs[next], true);
    }
  });
}
