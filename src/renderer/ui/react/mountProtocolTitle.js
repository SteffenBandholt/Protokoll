import { loadReactRuntime } from "./loadReactRuntime.js";
import { createProtocolTitleComponent } from "./ProtocolTitleComponent.js";

export async function mountProtocolTitle(host, model) {
  if (!host) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const ProtocolTitleComponent = createProtocolTitleComponent(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

  const render = (nextModel) => {
    const element = React.createElement(ProtocolTitleComponent, { model: nextModel });
    if (root) root.render(element);
    else ReactDOM.render(element, host);
  };

  render(model);

  return {
    render,
    unmount() {
      if (root) root.unmount();
      else ReactDOM.unmountComponentAtNode(host);
    },
  };
}
