// Oráculo: ejecuta un árbol con la librería BehaviorTree.CPP real y vuelca, por tick,
// lo necesario para compararlo con el simulador.
//
// Uso: bt_oracle arbol.xml escenario.txt
//   escenario.txt: una línea por tick con pares id=VALOR (SUCCESS, FAILURE, RUNNING).
// Salida: una línea JSON por tick con el estado de la raíz, las hojas invocadas en orden,
// las acciones interrumpidas, si hubo wake-up y el estado de cada nodo tras el tick.

#include <behaviortree_cpp/bt_factory.h>

#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

using namespace BT;

namespace
{
std::map<std::string, std::string> g_values;
std::vector<std::pair<std::string, std::string>> g_leaf_log;
std::vector<std::string> g_halts;

NodeStatus leafValue(const std::string& id)
{
  auto it = g_values.find(id);
  if(it == g_values.end())
  {
    throw RuntimeError("no value for leaf ", id);
  }
  g_leaf_log.emplace_back(id, it->second);
  if(it->second == "SUCCESS")
    return NodeStatus::SUCCESS;
  if(it->second == "FAILURE")
    return NodeStatus::FAILURE;
  return NodeStatus::RUNNING;
}

class TestCondition : public ConditionNode
{
public:
  TestCondition(const std::string& name, const NodeConfig& cfg) : ConditionNode(name, cfg) {}
  static PortsList providedPorts() { return {}; }
  NodeStatus tick() override { return leafValue(name()); }
};

class TestAction : public SyncActionNode
{
public:
  TestAction(const std::string& name, const NodeConfig& cfg) : SyncActionNode(name, cfg) {}
  static PortsList providedPorts() { return {}; }
  NodeStatus tick() override { return leafValue(name()); }
};

class TestAsyncAction : public StatefulActionNode
{
public:
  TestAsyncAction(const std::string& name, const NodeConfig& cfg)
    : StatefulActionNode(name, cfg)
  {}
  static PortsList providedPorts() { return {}; }
  NodeStatus onStart() override { return leafValue(name()); }
  NodeStatus onRunning() override { return leafValue(name()); }
  void onHalted() override { g_halts.push_back(name()); }
};

std::string json(const std::string& s)
{
  std::string out = "\"";
  for(char c : s)
  {
    if(c == '"' || c == '\\')
      out += '\\';
    out += c;
  }
  return out + "\"";
}
}  // namespace

int main(int argc, char** argv)
{
  if(argc != 3)
  {
    std::cerr << "uso: bt_oracle arbol.xml escenario.txt\n";
    return 2;
  }
  BehaviorTreeFactory factory;
  factory.registerNodeType<TestCondition>("TestCondition");
  factory.registerNodeType<TestAction>("TestAction");
  factory.registerNodeType<TestAsyncAction>("TestAsyncAction");
  auto tree = factory.createTreeFromFile(argv[1]);

  std::ifstream scenario(argv[2]);
  std::string line;
  int tick = 0;
  while(std::getline(scenario, line))
  {
    tick++;
    std::istringstream ss(line);
    std::string pair;
    while(ss >> pair)
    {
      auto eq = pair.find('=');
      g_values[pair.substr(0, eq)] = pair.substr(eq + 1);
    }
    g_leaf_log.clear();
    g_halts.clear();
    std::cout << "{\"tick\":" << tick;
    try
    {
      NodeStatus status = tree.tickExactlyOnce();
      bool wake = tree.sleep(std::chrono::milliseconds(0));
      std::cout << ",\"root\":" << json(toStr(status)) << ",\"wakeup\":" << (wake ? "true" : "false");
      std::cout << ",\"leaves\":[";
      for(size_t i = 0; i < g_leaf_log.size(); i++)
        std::cout << (i ? "," : "") << "[" << json(g_leaf_log[i].first) << ","
                  << json(g_leaf_log[i].second) << "]";
      std::cout << "],\"halts\":[";
      for(size_t i = 0; i < g_halts.size(); i++)
        std::cout << (i ? "," : "") << json(g_halts[i]);
      std::cout << "],\"status\":{";
      bool first = true;
      applyRecursiveVisitor(tree.rootNode(), [&](TreeNode* node) {
        std::cout << (first ? "" : ",") << json(node->name()) << ":" << json(toStr(node->status()));
        first = false;
      });
      std::cout << "}";
    }
    catch(const std::exception& e)
    {
      std::cout << ",\"error\":" << json(e.what());
    }
    std::cout << "}\n";
  }
  return 0;
}
