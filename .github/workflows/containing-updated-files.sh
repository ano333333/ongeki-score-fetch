#!/bin/bash

# ======================================================================
# ディレクトリに、HEAD^1 ~ HEADで更新されたファイルが含まれるかを得る
# --target: 対象ディレクトリ名
# ======================================================================


# パラメータの初期化
target=""

# コマンドライン引数の解析
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --target) target="$2"; shift ;;
        *) echo "不明なオプション: $1" >&2; exit 1 ;;
    esac
    shift
done

# targetパラメータが指定されているか確認
if [[ -z "$target" ]]; then
    echo "--targetパラメータは必須です。" >&2
    exit 1
fi

# ディレクトリの配列を初期化
arr=()

# 最初の'/'の前の部分を抽出してarrに格納
for path in `git diff --name-only HEAD^1 HEAD`
do
  splits=(${path//\// })
  arr+=(${splits[0]})
done

# targetがarrに含まれているか確認
found=false
for dir in "${arr[@]}"; do
  if [[ "$dir" == "$target" ]]; then
    found=true
    break
  fi
done

echo "$found"
