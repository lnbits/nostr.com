import { render } from "solid-js/web"

import App from "./App.jsx"
import "./base.css"

export function renderModal(root: HTMLElement, onClose: () => void) {
  render(() => <App onClose={onClose} />, root)
}
