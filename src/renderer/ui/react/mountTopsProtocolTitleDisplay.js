import { loadReactRuntime } from "./loadReactRuntime.js";
import { createTopsProtocolTitleDisplay } from "./TopsProtocolTitleDisplay.js";

export async function mountTopsProtocolTitleDisplay(host, props) {
  if (!host) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const TopsProtocolTitleDisplay = createTopsProtocolTitleDisplay(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;

  const render = (nextProps) => {
    const element = React.createElement(TopsProtocolTitleDisplay, nextProps || {});
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
