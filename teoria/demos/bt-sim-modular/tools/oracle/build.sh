#!/usr/bin/env bash
# Compila BehaviorTree.CPP 4.x y el oráculo. Requiere git, cmake, ninja (o make) y g++.
# Uso: tools/oracle/build.sh [directorio_de_trabajo]   (por defecto ./.oracle)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-.oracle}"
mkdir -p "$WORK" && cd "$WORK"
[ -d btcpp ] || git clone --depth 1 https://github.com/BehaviorTree/BehaviorTree.CPP.git btcpp
cmake -S btcpp -B build -DCMAKE_BUILD_TYPE=Release -DBTCPP_SHARED_LIBS=OFF \
  -DBTCPP_BUILD_TOOLS=OFF -DBTCPP_EXAMPLES=OFF -DBUILD_TESTING=OFF \
  -DBTCPP_GROOT_INTERFACE=OFF -DBTCPP_SQLITE_LOGGING=OFF
cmake --build build -j
g++ -std=c++17 -O1 "$HERE/oracle.cpp" -I btcpp/include \
  -L build -L build/3rdparty/tinyxml2 -L build/3rdparty/minitrace \
  -lbehaviortree_cpp -ltinyxml2 -lminitrace -lpthread -ldl -o bt_oracle
echo "Oráculo listo: $(pwd)/bt_oracle"
echo "Pruebas: BTCPP_ORACLE=$(pwd)/bt_oracle npm test"
