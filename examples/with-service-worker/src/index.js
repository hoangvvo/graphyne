import { createClient } from '@urql/core';

const urqlClient = createClient({ url: '/graphql' });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/worker.js')
    .then(function (registration) {
      console.log('Registration successful, scope is:', registration.scope);
    })
    .catch(function (error) {
      console.log('Service worker registration failed, error:', error);
    });
}

window.onload = () => {
  function printResult(json, duration) {
    document.querySelector('#result').value = JSON.stringify(
      json,
      null,
      '  '
    );
    document.querySelector('#result-ms').innerText = duration.toFixed();
  }
  function resetResult() {
    document.querySelector('#result').value = null;
  }
  document.querySelector('#queryFetch').onclick = async () => {
    resetResult();
    const t0 = performance.now();
    const res = await fetch('/graphql?query={hello}');
    const t1 = performance.now();
    printResult(await res.json(), t1 - t0);
  };
  document.querySelector('#queryUrql').onclick = async () => {
    resetResult();
    const t0 = performance.now();
    const result = await urqlClient.query('{ hello }').toPromise();
    const t1 = performance.now();
    printResult({ data: result.data }, t1 - t0);
  };
};
