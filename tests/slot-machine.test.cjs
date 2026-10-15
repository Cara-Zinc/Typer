const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { join } = require("node:path");
const { setImmediate } = require("node:timers/promises");
const ts = require("typescript");

// Exercise the real component handlers with deterministic hooks and timers.
// No DOM or Tauri runtime is required for these persistence regressions.
const source = ts.transpileModule(
  readFileSync(join(__dirname, "../src/modes/habits/SlotMachine.tsx"), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
).outputText;

function createMachine(acquire) {
  const slots = [];
  let cursor = 0;
  let tree;
  let nextTimer = 0;
  const timers = new Map();
  const spends = [];
  const rewards = ["apple", "pear", "plum"].map((id) => ({
    id, name: id, rarity: 1,
  }));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => {
        slots[index] = typeof value === "function" ? value(slots[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback: (callback) => callback,
    useEffect: () => {},
    useMemo: (factory) => factory(),
  };
  const mocks = {
    react,
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "lucide-react": { Coins: "Coins" },
    "../../components/RewardIcon": { RewardIcon: "RewardIcon" },
    "../../state/HabitsContext": {
      useHabits: () => ({ tokens: 100, spend: async (cost) => { spends.push(cost); return true; } }),
    },
    "../../state/InventoryContext": { useInventory: () => ({ acquire }) },
    "./rewards": { SHOP_REWARDS: rewards },
  };
  const window = {
    setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return ++nextTimer; },
    clearInterval() {},
  };
  const exports = {};
  // Inject Math rather than mutate the process-global random generator.
  const random = Object.create(Math);
  new Function("require", "exports", "window", "Math", source)(
    (name) => {
      assert.ok(name in mocks, `Unexpected import: ${name}`);
      return mocks[name];
    }, exports, window, random,
  );
  function render() { cursor = 0; tree = exports.SlotMachine(); }
  render();
  return {
    spends,
    button() { render(); return find(tree, (node) => node.type === "button"); },
    text() { render(); return text(tree); },
    async spin(values = [0, 0, 0]) {
      let index = 0;
      random.random = () => values[index++];
      const button = this.button();
      assert.equal(button.props.disabled, false, "another spin should be available");
      await button.props.onClick();
      assert.equal(this.button().props.disabled, true, "spinning should be busy");
      for (const callback of [...timers.values()]) callback();
      timers.clear();
      await setImmediate();
      render();
    },
  };
}

function element(type, props) { return { type, props }; }
function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  return [node.props?.children].flat(Infinity).map(text).join(" ");
}

for (const failure of ["null", "reject"]) {
  test(`${failure} acquisition exits evaluating and permits a later successful spin`, async () => {
    const calls = [];
    const machine = createMachine(async (...args) => {
      calls.push(args);
      if (calls.length > 1) return { rewardId: "apple", owned: 3 };
      if (failure === "reject") throw new Error("disk unavailable");
      return null;
    });
    await machine.spin();
    assert.deepEqual(calls, [["apple", 3]], "jackpot must use one batched acquisition");
    assert.equal(machine.button().props.disabled, false);
    assert.match(machine.text(), /Inventory write failed/);
    assert.doesNotMatch(machine.text(), /JACKPOT|Won 3|Spinning/);
    assert.deepEqual(machine.spends, [10], "failure must not charge again or automatically retry");

    await machine.spin();
    assert.deepEqual(calls, [["apple", 3], ["apple", 3]]);
    assert.match(machine.text(), /JACKPOT/);
    assert.match(machine.text(), /Won 3 × apple/);
    assert.doesNotMatch(machine.text(), /Inventory write failed/);
    assert.equal(machine.button().props.disabled, false);
  });
}

test("two matches award one copy in one acquisition", async () => {
  const calls = [];
  const machine = createMachine(async (...args) => { calls.push(args); return {}; });
  await machine.spin([0, 0, 0.5]);
  assert.deepEqual(calls, [["apple", 1]]);
  assert.match(machine.text(), /Won 1 × apple/);
  assert.equal(machine.button().props.disabled, false);
});

test("no matches skip acquisition and leave the machine available", async () => {
  const calls = [];
  const machine = createMachine(async (...args) => { calls.push(args); return {}; });
  await machine.spin([0, 0.5, 0.9]);
  assert.deepEqual(calls, []);
  assert.doesNotMatch(machine.text(), /Spinning|WIN|Error/);
  assert.equal(machine.button().props.disabled, false);
});

test("pending acquisition keeps the machine busy until the batch is saved", async () => {
  let finish;
  const saved = new Promise((resolve) => { finish = resolve; });
  const machine = createMachine(() => saved);
  await machine.spin();
  assert.equal(machine.button().props.disabled, true);
  assert.match(machine.text(), /Spinning/);
  finish({ rewardId: "apple", owned: 3 });
  await setImmediate();
  assert.equal(machine.button().props.disabled, false);
  assert.match(machine.text(), /JACKPOT/);
});
