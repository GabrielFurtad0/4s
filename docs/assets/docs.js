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

  // 4. Modal Pop-up com Zoom e Pan para Diagramas Mermaid
  function setupMermaidModal() {
    let modal = document.querySelector('.mermaid-modal-overlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'mermaid-modal-overlay';
      modal.innerHTML = `
        <div class="mermaid-modal-header">
          <div class="mermaid-modal-title">
            <span>🔍 Visualização Ampliada do Diagrama</span>
            <span class="mermaid-modal-badge">TotalTrigo / 4S ERP</span>
          </div>
          <div class="mermaid-modal-actions">
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-out" title="Reduzir (Zoom -)">➖ Reduzir</button>
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-reset" title="Tamanho Padrão (100%)">100%</button>
            <button type="button" class="mermaid-modal-btn" id="btn-zoom-in" title="Aumentar (Zoom +)">➕ Aumentar</button>
            <button type="button" class="mermaid-modal-btn close" id="btn-modal-close" title="Fechar (Esc)">✕ Fechar</button>
          </div>
        </div>
        <div class="mermaid-modal-body" id="mermaid-modal-body">
          <div class="mermaid-modal-content" id="mermaid-modal-content"></div>
        </div>
      `;
      document.body.appendChild(modal);

      let currentScale = 1.0;
      const modalContent = modal.querySelector('#mermaid-modal-content');
      const modalBody = modal.querySelector('#mermaid-modal-body');
      const btnZoomReset = modal.querySelector('#btn-zoom-reset');

      function updateScale(newScale) {
        currentScale = Math.min(3.5, Math.max(0.4, Math.round(newScale * 10) / 10));
        modalContent.style.transform = `scale(${currentScale})`;
        btnZoomReset.textContent = `${Math.round(currentScale * 100)}%`;
      }

      modal.querySelector('#btn-zoom-in').addEventListener('click', (e) => {
        e.stopPropagation();
        updateScale(currentScale + 0.25);
      });

      modal.querySelector('#btn-zoom-out').addEventListener('click', (e) => {
        e.stopPropagation();
        updateScale(currentScale - 0.25);
      });

      btnZoomReset.addEventListener('click', (e) => {
        e.stopPropagation();
        updateScale(1.0);
      });

      function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }

      modal.querySelector('#btn-modal-close').addEventListener('click', closeModal);

      // Fecha ao clicar fora do conteúdo
      modalBody.addEventListener('click', (e) => {
        if (e.target === modalBody) {
          closeModal();
        }
      });

      // Fecha com a tecla Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
          closeModal();
        }
      });

      // Zoom com a roda do mouse (scroll)
      modalBody.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        updateScale(currentScale + delta);
      }, { passive: false });
    }

    const modalContent = modal.querySelector('#mermaid-modal-content');

    function openDiagramModal(wrapper) {
      const svg = wrapper.querySelector('svg');
      if (!svg) return;

      modalContent.innerHTML = '';
      const clonedSvg = svg.cloneNode(true);
      clonedSvg.removeAttribute('id');
      clonedSvg.style.width = '100%';
      clonedSvg.style.height = 'auto';
      clonedSvg.style.maxHeight = '78vh';
      clonedSvg.style.maxWidth = '88vw';
      modalContent.appendChild(clonedSvg);

      modalContent.style.transform = 'scale(1.0)';
      const btnZoomReset = modal.querySelector('#btn-zoom-reset');
      if (btnZoomReset) btnZoomReset.textContent = '100%';

      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    // Anexa o botão flutuante e listener de clique aos diagramas
    function attachWrappers() {
      document.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (!wrapper.querySelector('.mermaid-expand-btn')) {
          const expandBtn = document.createElement('button');
          expandBtn.type = 'button';
          expandBtn.className = 'mermaid-expand-btn';
          expandBtn.innerHTML = '🔍 Expandir Diagrama';
          expandBtn.title = 'Clique para abrir o diagrama em tela cheia com zoom';
          wrapper.appendChild(expandBtn);

          // Clique no wrapper ou botão abre o modal
          wrapper.addEventListener('click', () => {
            openDiagramModal(wrapper);
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
