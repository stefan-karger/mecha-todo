import { render } from "@solidjs/web";
import { App } from "./app/App";
import { PRODUCT_NAME } from "./config/product";
import "./styles/app.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element is missing.");
}

document.title = PRODUCT_NAME;
render(() => <App />, root);
