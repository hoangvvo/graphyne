const BASE_URL = 'https://pokeapi.co/api/v2';

module.exports = {
  Query: {
    pokemon(parent, { name, id }) {
      if (name) {
        return global
          .fetch(BASE_URL + '/pokemon/' + name)
          .then((res) => (res.ok ? res.json() : null));
      }
      if (id) {
        return global
          .fetch(BASE_URL + '/pokemon/' + id)
          .then((res) => (res.ok ? res.json() : null));
      } else {
        return null;
      }
    },
  },
};
