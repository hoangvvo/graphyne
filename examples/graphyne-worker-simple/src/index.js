function createWorker() {
  const worker = new Worker("./worker.js");
  return worker;
}

createWorker();