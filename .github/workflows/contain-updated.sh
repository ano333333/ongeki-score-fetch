#!/bin/bash

# read paths from stdin until an empty line
paths=()
while IFS= read -r line; do
  [[ -z "$line" ]] && break
  paths+=("$line")
done

echo "paths: ${paths[@]}"

# read target from stdin (1 line)
read -r target

echo "target: $target"

# initialize an array for directories
arr=()

# extract the part before the first '/' and store in arr
for path in "${paths[@]}"; do
  dir="${path%%/*}"
  arr+=("$dir")
done

# check if target is in arr
found=false
for dir in "${arr[@]}"; do
  if [[ "$dir" == "$target" ]]; then
    found=true
    break
  fi
done

echo "$found"
