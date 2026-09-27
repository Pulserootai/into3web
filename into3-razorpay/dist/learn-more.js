(() => {
 const pages={original:'lp1',introduction:'lp2',scientific:'lp3'};
 const origin=new URLSearchParams(location.search).get('from');const page=pages[origin]||pages.original;
 document.querySelectorAll('[data-page-return]').forEach(a=>a.href=page);
 document.querySelectorAll('[data-offer-return]').forEach(a=>a.href=page+'#founders');
 const number=String(window.INTO3_CONFIG?.whatsappNumber||'').replace(/[^0-9]/g,'');
 if(/^[1-9][0-9]{7,14}$/.test(number)){
  document.querySelectorAll('[data-demo-whatsapp]').forEach(link=>{
  link.href='https://wa.me/'+number+'?text='+encodeURIComponent('Hi Into3, I would like to see a product demo before deciding on founding-family access. Please share the demo options and availability.');
  link.removeAttribute('aria-disabled');link.target='_blank';link.rel='noopener noreferrer';
  });
  document.querySelector('[data-demo-note]').textContent='Opens WhatsApp with a prepared demo request. Review it and send when you are ready.';
 }
})();