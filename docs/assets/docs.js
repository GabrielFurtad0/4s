/**
 * TotalTrigo / 4S ERP — Central de Documentação
 * Script compartilhado para navegação, TOC dinâmico, Mermaid e utilitários
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializa Diagramas Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      themeVariables: {
        primaryColor: '#EEF2FF',
        primaryTextColor: '#1E1B4B',
        primaryBorderColor: '#5E43F3',
        lineColor: '#6366F1',
        secondaryColor: '#FEF3C7',
        tertiaryColor: '#ECFDF5'
      },
      flowchart: { curve: 'basis' }
    });
  }

  // 2. Constrói o Índice da Página (TOC) dinamicamente
  const article = document.querySelector('.docs-article');
  const tocList = document.querySelector('#toc-list');

  if (article && tocList) {
    const headings = article.querySelectorAll('h2, h3');
    headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = 'heading-' + index + '-' + heading.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + heading.id;
      a.className = 'toc-link' + (heading.tagName === 'H3' ? ' toc-sub' : '');
      if (heading.tagName === 'H3') {
        a.style.paddingLeft = '12px';
        a.style.fontSize = '11.5px';
      }
      a.textContent = heading.textContent.replace(/^[0-9\.\s]+/, ''); // Remove numeração duplicada se houver
      li.appendChild(a);
      tocList.appendChild(li);
    });

    // Observer para destacar o link ativo no scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          document.querySelectorAll('.toc-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { rootMargin: '0px 0px -75% 0px' });

    headings.forEach(heading => observer.observe(heading));
  }

  // 3. Botão de Copiar Código nos blocos <pre> (ignora diagramas Mermaid)
  document.querySelectorAll('pre:not(.mermaid)').forEach(pre => {
    if (pre.closest('.mermaid-wrapper') || pre.classList.contains('mermaid')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.type = 'button';
    btn.innerHTML = '📋 Copiar';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '✓ Copiado!';
        setTimeout(() => { btn.innerHTML = '📋 Copiar'; }, 2000);
      });
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });

  // 4. Modal Pop-up com Pan & Zoom Fluído e Ocupação de Tela Inteira
  function setupMermaidModal() {
    let modal = document.querySelector('.mermaid-modal-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'mermaid-modal-overlay';
      modal.innerHTML = `
        <div class="mermaid-modal-header">
          <div class="mermaid-modal-title">
            <span>🔍 Visualização Ampliada</span>
            <span class="mermaid-modal-badge">TotalTrigo / 4S ERP</span>
            <span class="mermaid-modal-hint">🖱️ Clique e arraste para mover • Roda do mouse para zoom na seção desejada • Duplo clique para ajustar</span>
          </div>
          <div class="mermaid-modal-actions">
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-out" title="Reduzir (Zoom -)">➖ Reduzir</button>
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-reset" title="Ajustar à Tela Cheia">Ajustar à Tela</button>
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-in" title="Aumentar (Zoom +)">➕ Aumentar</button>
            <button type="button" class="mermaid-modal-btn close" id="btn-modal-close" title="Fechar (Esc)">✕ Fechar</button>
          </div>
        </div>
        <div class="mermaid-modal-body" id="mermaid-modal-body">
          <div class="mermaid-modal-canvas" id="mermaid-modal-canvas">
            <div class="mermaid-modal-card" id="mermaid-modal-card"></div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      const modalBody = modal.querySelector('#mermaid-modal-body');
      const canvas = modal.querySelector('#mermaid-modal-canvas');
      const card = modal.querySelector('#mermaid-modal-card');
      const btnZoomReset = modal.querySelector('#btn-zoom-reset');

      let scale = 1.0;
      let panX = 0;
      let panY = 0;
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let origTotalW = 800;
      let origTotalH = 600;

      function renderTransform() {
        canvas.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
        btnZoomReset.textContent = `${Math.round(scale * 100)}% (Ajustar)`;
      }

      function zoomAt(targetScale, clientX, clientY) {
        const clampedScale = Math.min(10.0, Math.max(0.15, targetScale));
        const rect = modalBody.getBoundingClientRect();
        const mouseX = (clientX !== undefined ? clientX : (rect.left + rect.width / 2)) - rect.left;
        const mouseY = (clientY !== undefined ? clientY : (rect.top + rect.height / 2)) - rect.top;

        panX = mouseX - (mouseX - panX) * (clampedScale / scale);
        panY = mouseY - (mouseY - panY) * (clampedScale / scale);
        scale = clampedScale;
        renderTransform();
      }

      function fitToScreen() {
        const bodyRect = modalBody.getBoundingClientRect();
        const padW = bodyRect.width * 0.94;
        const padH = bodyRect.height * 0.90;

        const scaleW = padW / origTotalW;
        const scaleH = padH / origTotalH;
        scale = Math.min(scaleW, scaleH);

        panX = (bodyRect.width - origTotalW * scale) / 2;
        panY = (bodyRect.height - origTotalH * scale) / 2;
        renderTransform();
      }

      modal.querySelector('#btn-zoom-in').addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAt(scale * 1.3);
      });

      modal.querySelector('#btn-zoom-out').addEventListener('click', (e) => {
        e.stopPropagation();
        zoomAt(scale / 1.3);
      });

      btnZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        fitToScreen();
      });

      function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }

      modal.querySelector('#btn-modal-close').addEventListener('click', closeModal);

      modalBody.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        modalBody.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        renderTransform();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          modalBody.style.cursor = 'grab';
        }
      });

      modalBody.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.18 : 0.85;
        zoomAt(scale * factor, e.clientX, e.clientY);
      }, { passive: false });

      modalBody.addEventListener('dblclick', (e) => {
        e.preventDefault();
        fitToScreen();
      });

      document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('open')) return;
        if (e.key === 'Escape') closeModal();
        if (e.key === '+' || e.key === '=') zoomAt(scale * 1.25);
        if (e.key === '-' || e.key === '_') zoomAt(scale / 1.25);
        if (e.key === '0') fitToScreen();
      });

      modal.openWithDiagram = function(wrapper) {
        const svg = wrapper.querySelector('svg');
        if (!svg) return;

        card.innerHTML = '';
        const clonedSvg = svg.cloneNode(true);
        // Preserva o ID original para que todos os seletores CSS do Mermaid permaneçam ativos!
        card.appendChild(clonedSvg);

        let w = 800;
        let h = 600;
        if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
          w = svg.viewBox.baseVal.width;
          h = svg.viewBox.baseVal.height;
        } else if (svg.getAttribute('viewBox')) {
          const parts = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
          if (parts.length === 4 && parts[2] > 0) {
            w = parts[2];
            h = parts[3];
          }
        } else {
          const b = svg.getBoundingClientRect();
          w = b.width || 800;
          h = b.height || 600;
        }

        clonedSvg.style.width = w + 'px';
        clonedSvg.style.height = h + 'px';
        clonedSvg.style.maxWidth = 'none';
        clonedSvg.style.maxHeight = 'none';

        origTotalW = w + 64;
        origTotalH = h + 64;
        card.style.width = origTotalW + 'px';
        card.style.height = origTotalH + 'px';

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';

        requestAnimationFrame(() => {
          fitToScreen();
        });
      };
    }

    function attachWrappers() {
      document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (!wrapper.querySelector('.mermaid-expand-btn')) {
          const expandBtn = document.createElement('button');
          expandBtn.type = 'button';
          expandBtn.className = 'mermaid-expand-btn';
          expandBtn.innerHTML = '🔍 Expandir Diagrama';
          expandBtn.title = 'Clique para abrir em tela cheia com zoom interativo';
          wrapper.appendChild(expandBtn);

          wrapper.addEventListener('click', () => {
            modal.openWithDiagram(wrapper);
          });
        }
      });
    }

    attachWrappers();
    setTimeout(attachWrappers, 500);
    setTimeout(attachWrappers, 1500);
  }

  setupMermaidModal();
});
