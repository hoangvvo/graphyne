node_version=$(node --version)
benchmark_title=$(cat << EOF
## Results

- __Machine:__ $(uname -a) | $(node -r os -p "\`\${os.cpus().length} vCPUs | \${Math.ceil(os.totalmem() / (Math.pow(1024, 3)))}GB\`").
- __Method:__ \`autocannon $(node -r fs -p 'fs.readFileSync("./bench/scripts/args.txt").toString()') localhost:4001\` (two rounds; one to warm-up, one to measure).
- __Node:__ \`$node_version\`
- __Run:__ $(date)
EOF
)
benchmark_table=$(node ./bench/compare --table --includeLinks)
strip_readme=$(node -r fs -p 'fs.readFileSync("./bench/README.md", "utf-8").split(/## Results/)[0]')
git checkout master
echo "${strip_readme:?}\n\n${benchmark_title:?}\n\n${benchmark_table}" > ./bench/README.md
git add ./bench/README.md
git config --local user.email "action@github.com"
git config --local user.name "GitHub Action"
git commit -m "Update benchmark results" -a