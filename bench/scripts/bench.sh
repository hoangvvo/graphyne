yarn install
node bench $(node -r fs -p 'fs.readFileSync("./scripts/args.txt").toString()') --silent --all-packages --write