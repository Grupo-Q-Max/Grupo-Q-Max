document.addEventListener('DOMContentLoaded', () => {
  // Quiz runner logic
  const panels = [...document.querySelectorAll('[data-question]')];
  let current = 0;

  function show(i) {
    panels[current]?.classList.remove('active');
    current = Math.max(0, Math.min(i, panels.length - 1));
    panels[current]?.classList.add('active');
    const bar = document.querySelector('#progressBar');
    if (bar) bar.style.width = `${((current + 1) / panels.length) * 100}%`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  panels.forEach((p, i) => {
    p.querySelector('.next')?.addEventListener('click', () => {
      const controls = [...p.querySelectorAll('input,textarea')];
      if (controls.some(c => !c.checkValidity())) {
        controls.find(c => !c.checkValidity())?.reportValidity();
        return;
      }
      show(i + 1);
    });
    p.querySelector('.prev')?.addEventListener('click', () => show(i - 1));
  });
  if (panels.length) show(0);

  const stage = document.querySelector('.quiz-stage');
  if (stage && +stage.dataset.limit) {
    const end = new Date(stage.dataset.started.replace(' ', 'T')).getTime() + (+stage.dataset.limit * 60000);
    const timer = document.querySelector('#timer');
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      if (timer) timer.textContent = `◷ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (left <= 0) document.querySelector('#quizForm')?.requestSubmit();
    };
    tick();
    setInterval(tick, 1000);
  }

  // Quiz Builder (Admin)
  const builder = document.querySelector('#questionsBuilder');
  const tpl = document.querySelector('#questionTemplate');

  function getCards() {
    if (!builder) return [];
    return [...builder.children].filter(el => el.classList.contains('question-builder'));
  }

  function highlightCard(card) {
    if (!card) return;
    card.classList.remove('just-moved');
    void card.offsetWidth; // trigger reflow
    card.classList.add('just-moved');
    setTimeout(() => card.classList.remove('just-moved'), 700);
  }

  function reindex() {
    if (!builder) return;
    const cards = getCards();
    const total = cards.length;

    cards.forEach((card, i) => {
      // 1. Update Question Number in Title
      const numEl = card.querySelector('.q-number');
      if (numEl) numEl.textContent = i + 1;

      // 2. Update Question Header Action Buttons (Up/Down)
      const upBtn = card.querySelector('.move-question-up');
      if (upBtn) {
        upBtn.disabled = (i === 0);
        upBtn.classList.toggle('disabled', i === 0);
      }
      const downBtn = card.querySelector('.move-question-down');
      if (downBtn) {
        downBtn.disabled = (i === total - 1);
        downBtn.classList.toggle('disabled', i === total - 1);
      }

      // 3. Update Question Main Inputs
      const textarea = card.querySelector('textarea');
      if (textarea) textarea.name = `questions[${i}][text]`;

      const typeSelect = card.querySelector('.question-type');
      if (typeSelect) typeSelect.name = `questions[${i}][type]`;

      const ptsInput = card.querySelector('input[type="number"]');
      if (ptsInput) ptsInput.name = `questions[${i}][points]`;

      // 4. Update Option Rows
      const rows = card.querySelectorAll('.option-row');
      let hasCheckedRadio = false;

      rows.forEach((row, j) => {
        const radio = row.querySelector('input[type="radio"]');
        if (radio) {
          radio.name = `questions[${i}][correct]`;
          radio.value = j;
          if (radio.checked) hasCheckedRadio = true;
        }

        const textInput = row.querySelector('input[type="text"], input:not([type="radio"])');
        if (textInput) {
          textInput.name = `questions[${i}][options][]`;
          if (!textInput.getAttribute('type')) {
            textInput.setAttribute('type', 'text');
          }
        }
      });

      // If single choice has options but none is checked, check the first option
      const isText = typeSelect && typeSelect.value === 'text';
      if (!isText && rows.length > 0 && !hasCheckedRadio) {
        const firstRadio = rows[0].querySelector('input[type="radio"]');
        if (firstRadio) firstRadio.checked = true;
      }
    });
  }

  function addOption(card, text = '', isChecked = false) {
    const list = card?.querySelector('.option-list');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'option-row';
    const checkedAttr = isChecked ? ' checked' : '';
    row.innerHTML = `
      <input type="radio" required${checkedAttr} title="Marcar como alternativa correta">
      <input type="text" value="${text.replace(/"/g, '&quot;')}" placeholder="Texto da alternativa" required>
      <button type="button" class="remove-option" title="Remover alternativa">×</button>
    `;
    list.append(row);
    reindex();
  }

  function toggleCard(card) {
    if (!card) return;
    const typeSelect = card.querySelector('.question-type');
    const isText = typeSelect?.value === 'text';
    const list = card.querySelector('.option-list');
    const btn = card.querySelector('.add-option');
    const pts = card.querySelector('input[type="number"]');

    if (isText) {
      if (list) list.style.display = 'none';
      if (btn) btn.style.display = 'none';
      if (pts) {
        pts.value = 0;
        pts.closest('label').style.display = 'none';
      }
      if (list) {
        list.querySelectorAll('input').forEach(inp => {
          inp.required = false;
        });
      }
    } else {
      if (list) list.style.display = '';
      if (btn) btn.style.display = '';
      if (pts) {
        pts.closest('label').style.display = '';
        if (Number(pts.value) <= 0) pts.value = 1;
      }
      if (list) {
        // If switched to multiple-choice and no options exist, populate 2 default options
        if (list.children.length === 0) {
          addOption(card, '', true);
          addOption(card, '', false);
        }
        list.querySelectorAll('input[type="text"], input:not([type="radio"])').forEach(inp => {
          inp.required = true;
        });
        list.querySelectorAll('input[type="radio"]').forEach(inp => {
          inp.required = true;
        });
      }
    }
  }

  function moveCard(card, direction) {
    if (!card || !builder) return;

    // Remember radio selections before swapping DOM nodes
    const cards = getCards();
    const checkedStates = cards.map(c => {
      const radios = [...c.querySelectorAll('.option-row input[type="radio"]')];
      return radios.findIndex(r => r.checked);
    });

    if (direction === 'up') {
      const prev = card.previousElementSibling;
      if (prev && prev.classList.contains('question-builder')) {
        prev.before(card);
      }
    } else if (direction === 'down') {
      const next = card.nextElementSibling;
      if (next && next.classList.contains('question-builder')) {
        next.after(card);
      }
    }

    // Restore radio selections after DOM move
    const newCards = getCards();
    newCards.forEach((c) => {
      const oldIndex = cards.indexOf(c);
      if (oldIndex !== -1 && checkedStates[oldIndex] !== -1) {
        const radios = [...c.querySelectorAll('.option-row input[type="radio"]')];
        if (radios[checkedStates[oldIndex]]) {
          radios[checkedStates[oldIndex]].checked = true;
        }
      }
    });

    reindex();
    highlightCard(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Drag & Drop Setup
  if (builder) {
    let draggedCard = null;

    builder.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.drag-handle');
      if (handle) {
        const card = handle.closest('.question-builder');
        if (card) {
          card.setAttribute('draggable', 'true');
        }
      }
    });

    document.addEventListener('mouseup', () => {
      builder.querySelectorAll('.question-builder[draggable="true"]').forEach(c => {
        c.setAttribute('draggable', 'false');
      });
    });

    builder.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.question-builder');
      if (!card || card.getAttribute('draggable') !== 'true') {
        e.preventDefault();
        return;
      }
      draggedCard = card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    });

    builder.addEventListener('dragend', () => {
      if (draggedCard) {
        draggedCard.classList.remove('dragging');
        draggedCard.setAttribute('draggable', 'false');
        highlightCard(draggedCard);
        draggedCard = null;
      }
      builder.querySelectorAll('.question-builder.drag-over').forEach(c => c.classList.remove('drag-over'));
      reindex();
    });

    builder.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!draggedCard) return;

      const targetCard = e.target.closest('.question-builder');
      if (!targetCard || targetCard === draggedCard) return;

      const rect = targetCard.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (e.clientY > midpoint) {
        targetCard.after(draggedCard);
      } else {
        targetCard.before(draggedCard);
      }
    });

    builder.addEventListener('drop', (e) => {
      e.preventDefault();
      if (draggedCard) {
        draggedCard.classList.remove('dragging');
        draggedCard.setAttribute('draggable', 'false');
        highlightCard(draggedCard);
        draggedCard = null;
      }
      builder.querySelectorAll('.question-builder.drag-over').forEach(c => c.classList.remove('drag-over'));
      reindex();
    });

    // Builder click events (delegated)
    builder.addEventListener('click', (e) => {
      const card = e.target.closest('.question-builder');

      // Move Up
      if (e.target.closest('.move-question-up')) {
        moveCard(card, 'up');
        return;
      }

      // Move Down
      if (e.target.closest('.move-question-down')) {
        moveCard(card, 'down');
        return;
      }

      // Remove Question
      if (e.target.closest('.remove-question')) {
        if (!card) return;
        const text = card.querySelector('textarea')?.value.trim();
        if (!text || confirm('Tem certeza que deseja excluir esta pergunta?')) {
          card.remove();
          reindex();
          if (!getCards().length) {
            document.querySelector('#addQuestion')?.click();
          }
        }
        return;
      }

      // Add Option
      if (e.target.matches('.add-option')) {
        if (card) addOption(card);
        return;
      }

      // Remove Option
      if (e.target.closest('.remove-option')) {
        const row = e.target.closest('.option-row');
        const list = row?.closest('.option-list');
        if (list && list.querySelectorAll('.option-row').length <= 2) {
          alert('Uma pergunta de múltipla escolha precisa de pelo menos 2 alternativas.');
          return;
        }
        const wasChecked = row?.querySelector('input[type="radio"]')?.checked;
        row?.remove();
        reindex();
        if (wasChecked && list) {
          const firstRadio = list.querySelector('.option-row input[type="radio"]');
          if (firstRadio) firstRadio.checked = true;
        }
        return;
      }
    });

    // Type change event
    builder.addEventListener('change', (e) => {
      if (e.target.matches('.question-type')) {
        toggleCard(e.target.closest('.question-builder'));
      }
    });

    // Add Question Button
    document.querySelector('#addQuestion')?.addEventListener('click', () => {
      if (!tpl || !builder) return;
      const node = tpl.content.firstElementChild.cloneNode(true);
      builder.append(node);
      addOption(node, '', true);
      addOption(node, '', false);
      reindex();
      toggleCard(node);
      highlightCard(node);
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.querySelector('textarea')?.focus();
    });

    // Initial setup on page load
    getCards().forEach(toggleCard);
    reindex();
    if (!getCards().length) {
      document.querySelector('#addQuestion')?.click();
    }
  }

  // Quiz Editor Form Submission Validation
  const quizForm = document.querySelector('#quizEditor');
  quizForm?.addEventListener('submit', (e) => {
    const cards = getCards();
    if (cards.length === 0) {
      e.preventDefault();
      alert('Adicione pelo menos uma pergunta ao quiz.');
      return;
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const isText = card.querySelector('.question-type')?.value === 'text';
      if (!isText) {
        const rows = card.querySelectorAll('.option-row');
        if (rows.length < 2) {
          e.preventDefault();
          alert(`A Pergunta ${i + 1} precisa ter pelo menos 2 alternativas.`);
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        const radios = [...card.querySelectorAll('.option-row input[type="radio"]')];
        const hasChecked = radios.some(r => r.checked);
        if (!hasChecked && radios.length > 0) {
          radios[0].checked = true;
        }
      }
    }
  });
});
