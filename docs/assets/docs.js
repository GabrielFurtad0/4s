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
});
