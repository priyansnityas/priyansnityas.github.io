// Apply the saved theme before the stylesheet paints to avoid a theme flash.
try {
  const theme=localStorage.getItem('pocket-ledger-theme')||'auto';
  if(theme==='dark')document.body.classList.add('dark-theme');
  else if(theme==='light')document.body.classList.add('light-theme');
} catch {}
