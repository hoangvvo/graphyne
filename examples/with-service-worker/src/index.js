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
  document.querySelector('#query').onclick = () => {
    fetch('/graphql?query={hello}')
      .then((res) => res.json())
      .then((json) => {
        document.querySelector('#result').value = JSON.stringify(
          json,
          null,
          '\t'
        );
      });
  };
};
