import { loadReactRuntime } from "./loadReactRuntime.js";
import { createTopsEditorComponent } from "./TopsEditorComponent.js";

export async function mountTopsEditor(container, props) {
  if (!container) return null;

  const { React, ReactDOM } = await loadReactRuntime();
  const TopsEditorComponent = createTopsEditorComponent(React);
  const root = ReactDOM.createRoot ? ReactDOM.createRoot(container) : null;

  const render = (nextProps) => {
    const element = React.createElement(TopsEditorComponent, nextProps || {});
    if (root) root.render(element);
    else ReactDOM.render(element, container);
  };

  render(props);

  return {
    render,
    unmount() {
      if (root) root.unmount();
      else ReactDOM.unmountComponentAtNode(container);
    },
  };
}
