const users = [
  {
    id: 1,
    name: 'Jane',
    age: 17,
  },
  { id: 2, name: 'John', age: 16 },
  { id: 3, name: 'alex', age: 18 },
];

exports.getUsers = async (ids) => {
  // Do a database batch queries here
  return ids.map((id) => users[id] || null);
};
