#!/bin/sh -l

set -eu # stop on error

export HOME=/root

node /graphql-bench-pr/src/index.js