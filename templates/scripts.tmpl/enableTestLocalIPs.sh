#!/bin/bash

#
# Copyright © 2019 Lisk Foundation
#
# See the LICENSE file at the top-level directory of this distribution
# for licensing information.
#
# Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
# no part of this software, including this file, may be copied, modified,
# propagated, or distributed except according to the terms contained in the
# LICENSE file.
#
# Removal or modification of this copyright notice is prohibited.
#
#
if [[ $(uname -s) != "Darwin" ]]; then
  echo "Only Darwin is supported"
  exit 1
fi

for i in $( seq $1 $2 ); do
  sudo ifconfig lo0 alias "127.0.0.$i"
done
