function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const users = [
  {
    id: '1',
    name: 'Jane',
    age: 17,
    friends: ['2', '3', '4'],
  },
  { id: '2', name: 'John', age: 16, friends: ['1', '4'] },
  { id: '3', name: 'Alex', age: 18, friends: ['1', '2', '4'] },
  { id: '4', name: 'Jessie', age: 21, friends: ['2', '3'] },
  { id: '5', name: 'Billy', age: 19, friends: [] },
];

const getUser = async (id) => {
  // Simulate delay in database queries
  await sleep(100);
  return users.find((u) => u.id === id);
};

const getBatchUsers = async (ids) => {
  return await Promise.all(ids.map((id) => getUser(id)));
};

exports.getUser = getUser;
exports.getBatchUsers = getBatchUsers;
