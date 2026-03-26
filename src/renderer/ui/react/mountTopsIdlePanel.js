import { loadReactRuntime } from "./loadReactRuntime.js";
import { createTopsIdlePanelComponent } from "./TopsIdlePanelComponent.js";

export async function mountTopsIdlePanel(host, props) {
  if (!host) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const TopsIdlePanelComponent = createTopsIdlePanelComponent(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

  const render = (nextProps) => {
    const element = React.createElement(TopsIdlePanelComponent, nextProps || {});
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
