/*
 * Tema Provida para os gráficos (Chart.js).
 * Carregado depois do Chart.js e antes do app.js. Não altera dados: só cores e fonte.
 */
(function () {
  if (!window.Chart) return;

  const C = {
    teal: '#08a5a0', tealLight: '#6fdcd4', navy: '#123b5d',
    amber: '#e8a838', red: '#d1483f', grid: '#e3edf0', text: '#4b6676'
  };
  const fontVar = getComputedStyle(document.documentElement).getPropertyValue('--font-provida').trim();

  Chart.defaults.font.family = fontVar || 'Inter, system-ui, sans-serif';
  Chart.defaults.color = C.text;
  Chart.defaults.borderColor = C.grid;
  if (Chart.defaults.plugins && Chart.defaults.plugins.colors) Chart.defaults.plugins.colors.enabled = false;

  const scale4 = [C.teal, C.tealLight, C.amber, C.red];

  Chart.register({
    id: 'providaTheme',
    beforeUpdate(chart) {
      const id = chart.canvas && chart.canvas.id;
      const ds = chart.data.datasets;
      if (id === 'chart-daily') {
        if (ds[0].type === 'bar') Object.assign(ds[0], { borderColor: C.teal, backgroundColor: C.teal, hoverBackgroundColor: C.navy });
        else Object.assign(ds[0], { borderColor: C.teal, backgroundColor: 'rgba(8,165,160,.12)', pointBackgroundColor: C.teal });
        if (ds[1]) Object.assign(ds[1], { borderColor: C.navy, backgroundColor: 'transparent' });
      } else if (id === 'chart-satisfaction') {
        Object.assign(ds[0], { backgroundColor: scale4, borderColor: '#ffffff' });
      } else if (id === 'chart-recommendation') {
        Object.assign(ds[0], { backgroundColor: scale4 });
      } else if (id === 'chart-questions') {
        Object.assign(ds[0], { backgroundColor: C.teal });
      } else if (id === 'chart-youngs') {
        Object.assign(ds[0], { backgroundColor: C.teal });
        if (ds[1]) Object.assign(ds[1], { backgroundColor: 'rgba(18,59,93,.22)' });
      }
    }
  });
})();
