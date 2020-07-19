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

  self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting()); // Activate worker immediately
  });
  
  self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim()); // Become available to all pages
  });
}

window.onload = () => {
  function printResult(json, duration) {
    const value = typeof json === 'object' ? JSON.stringify(json, null, '  ') : json;
    document.querySelector('#result').value = value;
    document.querySelector('#result-ms').innerText = duration.toFixed();
  }
  function resetResult() {
    document.querySelector('#result').value = null;
  }
  // Via fetch
  document.querySelector('#queryFetch').onclick = async () => {
    resetResult();
    const t0 = performance.now();
    const res = await fetch('/graphql?query={hello}');
    printResult(await res.json(), performance.now() - t0);
  };
  // Via urql
  document.querySelector('#queryUrql').onclick = async () => {
    resetResult();
    const t0 = performance.now();
    const result = await urqlClient.query('{ hello }').toPromise();
    printResult({ data: result.data }, performance.now() - t0);
  };
  // Via service worker postMessage
  
  document.querySelector('#queryMessage').onclick = () => {
    let t0 = 0;
    const listenToResult = (event) => {
      printResult(event.data, performance.now() - t0);
      navigator.serviceWorker.removeEventListener('message', listenToResult);
    }
    t0 = performance.now();
    navigator.serviceWorker.addEventListener('message', listenToResult);
    navigator.serviceWorker.controller.postMessage({
      query: '{ hello }'
    });
  }
};
