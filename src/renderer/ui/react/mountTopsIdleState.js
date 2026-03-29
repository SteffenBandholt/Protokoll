import { loadReactRuntime } from "./loadReactRuntime.js";
import { createTopsIdleStateComponent } from "./TopsIdleStateComponent.js";

export async function mountTopsIdleState(host, props) {
  if (!host) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const TopsIdleStateComponent = createTopsIdleStateComponent(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

  const render = (nextProps) => {
    const element = React.createElement(TopsIdleStateComponent, nextProps || {});
    if (root) root.render(element);
    else ReactDOM.render(element, host);
  };

  render(props);

  return {
    render,
    unmount() {
      if (root) root.unmount();
      else ReactDOM.unmountComponentAtNode(host);
    },
  };
}
