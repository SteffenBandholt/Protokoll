// src/renderer/utils/async.js

export function fireAndForget(taskFn, label = "fireAndForget") {
  try {
    const run = typeof taskFn === "function" ? taskFn : null;
    if (!run) return;
    Promise.resolve()
      .then(() => run())
      .catch((err) => {
        console.warn(label, err);
      });
  } catch (err) {
    console.warn(label, err);
  }
}
