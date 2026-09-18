import { render } from "@solidjs/web";
import { App } from "./app/App";
import { BadgeShowcase } from "./app/BadgeShowcase";
import { PRODUCT_NAME } from "./config/product";
import "./styles/app.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Application root element is missing.");
}

const badgeRoute = window.location.pathname.replace(/\/$/, "") === "/badge";

document.title = badgeRoute ? `Badge review | ${PRODUCT_NAME}` : PRODUCT_NAME;
document.documentElement.classList.toggle("badge-route", badgeRoute);
document.body.classList.toggle("badge-route", badgeRoute);
render(() => (badgeRoute ? <BadgeShowcase /> : <App />), root);
