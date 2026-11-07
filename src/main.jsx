import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Provider } from "./lib/store";
import "./styles.css";
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="error-screen">
        <h1>No se pudo mostrar esta vista</h1>
        <p>
          Tus datos guardados permanecen en este navegador. Recarga la página
          para intentarlo de nuevo.
        </p>
        <button onClick={() => location.reload()}>Recargar</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);
