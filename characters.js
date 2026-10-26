(() => {
  'use strict';

  const showcase = document.querySelector('#character-showcase');
  const tablist = document.querySelector('#character-tabs');
  const panel = document.querySelector('#character-panel');
  if (!showcase || !tablist || !panel) return;

  const members = [
    { id: 'hitori', name: '后藤一里', role: '主音吉他' },
    { id: 'nijika', name: '伊地知虹夏', role: '鼓手' },
    { id: 'ryo', name: '山田凉', role: '贝斯' },
    { id: 'kita', name: '喜多郁代', role: '吉他与主唱' }
  ].map(member => ({
    ...member,
    tab: tablist.querySelector(`button[data-member="${member.id}"]`),
    view: panel.querySelector(`.character-view[data-character="${member.id}"]`)
  })).filter(member => member.tab && member.view);
  if (!members.length) return;

  const counter = document.querySelector('#character-counter');
  const status = document.querySelector('#character-status');
  let selectedIndex = Math.max(0, members.findIndex(member => member.id === showcase.dataset.member));

  /**
   * Tabs use automatic activation: Left/Right wrap between members, Home/End
   * jump to the ends, and only the active tab is in the normal Tab sequence.
   * Previous/next controls change the character while retaining their focus.
   */
  function selectMember(index, focusTab = false) {
    selectedIndex = (index + members.length) % members.length;
    const selected = members[selectedIndex];

    showcase.dataset.member = selected.id;
    members.forEach((member, memberIndex) => {
      const active = memberIndex === selectedIndex;
      member.tab.setAttribute('aria-selected', String(active));
      member.tab.setAttribute('aria-controls', panel.id);
      member.tab.tabIndex = active ? 0 : -1;
      member.view.hidden = !active;
    });
    panel.setAttribute('aria-labelledby', selected.tab.id);
    selected.view.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    if (counter) counter.textContent = `${String(selectedIndex + 1).padStart(2, '0')} / ${String(members.length).padStart(2, '0')}`;
    if (status) status.textContent = `${selected.name}，${selected.role}`;
    if (focusTab) selected.tab.focus();
  }

  members.forEach((member, index) => {
    member.tab.addEventListener('click', () => selectMember(index));
    member.tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let nextIndex;
      switch (event.key) {
        case 'ArrowLeft': nextIndex = index - 1; break;
        case 'ArrowRight': nextIndex = index + 1; break;
        case 'Home': nextIndex = 0; break;
        case 'End': nextIndex = members.length - 1; break;
        default: return;
      }
      event.preventDefault();
      selectMember(nextIndex, true);
    });
  });

  document.querySelector('#character-prev')?.addEventListener('click', () => selectMember(selectedIndex - 1));
  document.querySelector('#character-next')?.addEventListener('click', () => selectMember(selectedIndex + 1));
  selectMember(selectedIndex);
})();
