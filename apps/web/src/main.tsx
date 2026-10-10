import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getQueryClient } from "./libs/tanstack-query/query-client";
import { createAppRouter } from "./router";
import "./styles.css";

const queryClient = getQueryClient();
const router = createAppRouter(queryClient);

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
