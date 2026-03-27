import { loadReactRuntime } from "./loadReactRuntime.js";
import { createTopsListComponent } from "./TopsListComponent.js";

export async function mountTopsList(host, props) {
  if (!host) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const TopsListComponent = createTopsListComponent(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

  const render = (nextProps) => {
    const element = React.createElement(TopsListComponent, nextProps || {});
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
