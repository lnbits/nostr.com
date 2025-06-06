import { render } from "solid-js/web"

import App from "./src/App.jsx"
import "./src/base.css"

export function renderModal(root: HTMLElement, onClose: () => void) {
  render(() => <App onClose={onClose} />, root)
}
