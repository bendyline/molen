const search = document.querySelector('#search');
const filters = [...document.querySelectorAll('[data-filter]')];
const list = document.querySelector('#examples');
const examples = [...list.querySelectorAll('li')].map((element) => ({
  element,
  text: element.textContent.toLowerCase(),
  category: element.dataset.category,
}));
const count = document.querySelector('#result-count');
const emptyState = document.querySelector('#empty-state');
let category = 'all';

function updateExamples() {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;

  for (const example of examples) {
    const matches =
      (category === 'all' || example.category === category) &&
      terms.every((term) => example.text.includes(term));
    example.element.hidden = !matches;
    if (matches) visible += 1;
  }

  for (const button of filters) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === category));
  }

  count.textContent = `${visible} ${visible === 1 ? 'example' : 'examples'}`;
  list.hidden = visible === 0;
  emptyState.hidden = visible !== 0;
}

for (const button of filters) {
  button.addEventListener('click', () => {
    category = button.dataset.filter;
    updateExamples();
  });
}

search.addEventListener('input', updateExamples);
document.querySelector('#reset-filters').addEventListener('click', () => {
  search.value = '';
  category = 'all';
  updateExamples();
  search.focus();
});

document.querySelector('.search').hidden = false;
document.querySelector('.toolbar').hidden = false;
updateExamples();
